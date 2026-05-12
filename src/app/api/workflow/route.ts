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
  extractOutputs,
} from "./_lib";
import create_patient_workflow from "@/modules/client/ai-hub/workflows/patient/create_patient.json";

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
    const token = await getJWTToken();

    // Ask the external agent which workflow matches the user's intent.
    // The agent returns a complete WorkflowDefinition JSON.
    // const agentRes = await fetch(AGENT_API_URL, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({ message }),
    //   cache: "no-store",
    // });

    // if (!agentRes.ok) {
    //   throw new Error(`Agent API error: ${agentRes.status}`);
    // }

    // const workflow: WorkflowDefinition = await agentRes.json();
    const workflow: WorkflowDefinition = create_patient_workflow;

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
    let mergedContext = { ...sessionContext };

    // Some steps need to pre-fetch a resource before showing the form
    // (e.g. the update-patient step fetches the current Patient record).
    if (firstStep.context_resolver) {
      stepData = await runContextResolver(
        firstStep.context_resolver,
        mergedContext,
        token,
      );
      // Also apply context.outputs to map raw response fields to named context keys
      // (e.g. response.id → patient_id). This lets context steps pass typed values
      // to subsequent steps without relying on raw field names.
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
