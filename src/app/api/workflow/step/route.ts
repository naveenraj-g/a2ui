/**
 * POST /api/workflow/step
 *
 * Loads a specific step within an in-progress workflow session. Called by the
 * client after a successful form submission to advance to the next step, or
 * when the user skips an optional step.
 *
 * The client re-sends the full WorkflowDefinition JSON (received from /api/workflow)
 * along with the target stepIndex and the accumulated sessionContext. No workflow
 * state is stored server-side; the client is the single source of truth.
 *
 * Flow:
 *   1. Sort steps by sequence_number and look up the requested index.
 *   2. Obtain a fresh JWT from Better Auth.
 *   3. If the step declares a context_resolver, execute it against the FHIR server
 *      to hydrate the latest resource state (e.g. re-fetch the Patient before
 *      showing the "Add Telecom" form). The resolved data is merged into
 *      sessionContext and returned as stepData so the client can pre-fill fields.
 *   4. Return the step definition + any fetched data.
 *
 * Request body:  { workflow: WorkflowDefinition, stepIndex: number, sessionContext?: Record<string, unknown> }
 * Response:      { type: "workflow_step", step, stepIndex, stepData, sessionContext }
 *             or { type: "error", message: string }
 */

import type { WorkflowDefinition } from "@/types/workflow";
import { getJWTToken, sortedSteps, runContextResolver, extractOutputs } from "../_lib";

export async function POST(req: Request) {
  const {
    workflow,
    stepIndex,
    sessionContext = {},
  }: {
    workflow: WorkflowDefinition;
    stepIndex: number;
    sessionContext?: Record<string, unknown>;
  } = await req.json();

  // Sort steps so the index is always relative to sequence_number order.
  const steps = sortedSteps(workflow.workflow_steps);
  const step = steps[stepIndex];

  if (!step) {
    return Response.json({ type: "error", message: "Step not found" }, { status: 404 });
  }

  try {
    const token = await getJWTToken();
    let stepData: Record<string, unknown> = {};
    let mergedContext = { ...sessionContext };

    // Run the context_resolver if this step requires pre-fetched FHIR data.
    // For example, the "Add Address" step re-fetches the Patient resource to
    // confirm it still exists before rendering the address form.
    if (step.context_resolver) {
      stepData = await runContextResolver(step.context_resolver, mergedContext, token);
      const extracted = step.context?.outputs
        ? extractOutputs(step.context.outputs, stepData)
        : {};
      mergedContext = { ...mergedContext, ...stepData, ...extracted };
    }

    return Response.json({
      type: "workflow_step",
      step,
      stepIndex,
      stepData,        // data fetched by the context_resolver, empty object if none
      sessionContext: mergedContext,
    });
  } catch (error) {
    console.error(`[workflow/step] Failed to load step ${stepIndex}:`, error);
    return Response.json({ type: "error", message: "Failed to load step" }, { status: 500 });
  }
}
