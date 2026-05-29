/**
 * POST /api/workflow
 *
 * Entry point for the workflow system. Receives a plain-text user message,
 * forwards it to the external AI agent, and returns the first step of the
 * workflow that the agent selected.
 *
 * Flow:
 *   1. Obtain a short-lived JWT from Better Auth (forwarding the session cookie).
 *   2. POST the user message to AGENT_API_URL with Bearer auth.
 *      The agent interprets intent and returns a WorkflowDefinition JSON.
 *   3. Sort workflow_steps by sequence_number and take step[0].
 *   4. If the first step declares a context_resolver, run it now so the client
 *      receives any pre-fetched FHIR data alongside the step definition.
 *   5. Return the full workflow object + first step to the client.
 *      The client stores the workflow in Zustand and renders the step.
 *
 * The full workflow JSON travels back to the client and is re-sent with each
 * subsequent /step and /submit call. No server-side workflow state is kept.
 *
 * Request body:  { message: string, sessionContext?: Record<string, unknown> }
 * Response:      { type: "workflow_step", workflow, stepIndex, step, stepData, sessionContext }
 *             or { type: "error", message: string }
 */

import type { WorkflowDefinition } from "@/types/workflow";
import {
  getJWTToken,
  sortedSteps,
  runContextResolver,
  runContextResolvers,
  extractOutputs,
} from "./_lib";
import { getServerSession } from "@/modules/server/auth/get-session";

// ** Testing **
import create_patient_workflow from "@/modules/client/ai-hub/workflows/patient/create_patient.json";
import view_vitals_dashboard from "@/modules/client/ai-hub/workflows/vitals/view_vitals_dashboard.json";
import view_vitals_table from "@/modules/client/ai-hub/workflows/vitals/view_vitals_table.json";
import book_appointment from "@/modules/client/ai-hub/workflows/appointment/book_appointment.json";
import create_organization from "@/modules/client/ai-hub/workflows/organization/create_organization.json";

const AGENT_API_URL = process.env.AGENT_API_URL!;

export async function POST(req: Request) {
  const {
    message,
    sessionContext = {},
  }: { message: string; sessionContext?: Record<string, unknown> } =
    await req.json();

  if (!message?.trim()) {
    return Response.json(
      { type: "error", message: "Empty message" },
      { status: 400 },
    );
  }

  try {
    // Fetch a fresh JWT so the agent can verify the caller's identity.
    // Also read the session to seed user_id and org_id into context — the FHIR server
    // expects these in the POST body (not derived from the JWT on the server side).
    const [token, authSession] = await Promise.all([
      getJWTToken(),
      getServerSession(),
    ]);

    // Ask the external agent which workflow matches the user's intent.
    // The agent returns a complete WorkflowDefinition JSON.
    // const agentRes = await fetch(AGENT_API_URL, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({
    //     query: message,
    //     session_id:
    //       (sessionContext.session_id as string | undefined) ??
    //       crypto.randomUUID(),
    //   }),
    //   cache: "no-store",
    // });

    // if (!agentRes.ok) {
    //   throw new Error(`Agent API error: ${agentRes.status}`);
    // }

    // const workflow: WorkflowDefinition = await agentRes.json();

    // ** Testing **
    const workflow: WorkflowDefinition = create_organization as WorkflowDefinition;

    // Guarantee deterministic ordering regardless of how the agent serialises steps.
    const steps = sortedSteps(workflow.workflow_steps);
    const firstStep = steps[0];

    if (!firstStep) {
      return Response.json(
        { type: "error", message: "Workflow has no steps" },
        { status: 500 },
      );
    }

    let stepData: Record<string, unknown> = {};
    let mergedContext: Record<string, unknown> = {
      ...sessionContext,
      // Seed identity values so every workflow step can use $user_id / $org_id in
      // URLs and validation schemas without asking the user to enter them manually.
      ...(authSession?.user?.id ? { user_id: authSession.user.id } : {}),
      ...(authSession?.session?.activeOrganizationId
        ? { org_id: authSession.session.activeOrganizationId }
        : {}),
    };

    // Some steps need to pre-fetch a resource before showing the form.
    // context_resolvers (plural) runs multiple fetches in parallel;
    // context_resolver (singular) is the legacy single-fetch path.
    if (firstStep.context_resolvers?.length) {
      stepData = await runContextResolvers(
        firstStep.context_resolvers,
        mergedContext,
        token,
      );
      const extracted = firstStep.context?.outputs
        ? extractOutputs(firstStep.context.outputs, stepData)
        : {};
      mergedContext = { ...mergedContext, ...stepData, ...extracted };
    } else if (firstStep.context_resolver) {
      stepData = await runContextResolver(
        firstStep.context_resolver,
        mergedContext,
        token,
      );
      const extracted = firstStep.context?.outputs
        ? extractOutputs(firstStep.context.outputs, stepData)
        : {};
      mergedContext = { ...mergedContext, ...stepData, ...extracted };
    }

    return Response.json({
      type: "workflow_step",
      workflow, // full definition — client caches this for the whole workflow session
      stepIndex: 0,
      step: firstStep,
      stepData, // pre-fetched FHIR data for the first step, if any
      sessionContext: mergedContext,
    });
  } catch (error) {
    console.error("[workflow] Failed to start workflow:", error);
    return Response.json(
      { type: "error", message: "Failed to start workflow" },
      { status: 500 },
    );
  }
}
