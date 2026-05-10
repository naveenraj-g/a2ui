/**
 * POST /api/workflow/submit
 *
 * Executes the HTTP action for a workflow step — the form submission leg.
 * Instead of going through MCP, this route calls the FHIR server directly
 * using the URL declared in the step's action definition.
 *
 * Flow:
 *   1. Resolve the target step from the re-sent WorkflowDefinition.
 *   2. Match the submitted actionName to the step's actions[] array.
 *      Falls back to actions[0] if no exact match (most form steps have one action).
 *   3. Obtain a fresh JWT from Better Auth.
 *   4. Unpack formData — A2UI forms dispatch { formData: "<JSON string>" } as the
 *      action context, so we JSON.parse if the formData key holds a string.
 *   5. Strip empty/null fields, then interpolate the action URL with sessionContext
 *      values (e.g. $patient_id → 42).
 *   6. Call the FHIR endpoint with Bearer auth and the cleaned payload.
 *   7. Map the response through the step's context.outputs definition to extract
 *      named values (e.g. response.id → patient_id in sessionContext).
 *   8. Return success + the merged sessionContext + nextStepIndex so the client
 *      can immediately advance to the next step without an extra round trip.
 *
 * Request body:
 *   {
 *     workflow: WorkflowDefinition,
 *     stepIndex: number,
 *     actionName: string,          // matches WorkflowAction.tool_name
 *     formData: Record<string, unknown>,
 *     sessionContext?: Record<string, unknown>
 *   }
 *
 * Response (success):
 *   { success: true, data, nextStepIndex: number | null, sessionContext }
 *
 * Response (failure):
 *   { success: false, error: string }
 */

import type { WorkflowDefinition } from "@/types/workflow";
import { getJWTToken, sortedSteps, resolveUrl, extractOutputs, cleanFormData } from "../_lib";

export async function POST(req: Request) {
  const {
    workflow,
    stepIndex,
    actionName,
    formData,
    sessionContext = {},
  }: {
    workflow: WorkflowDefinition;
    stepIndex: number;
    actionName: string;       // matches the tool_name of the action to execute
    formData: Record<string, unknown>;
    sessionContext?: Record<string, unknown>;
  } = await req.json();

  const steps = sortedSteps(workflow.workflow_steps);
  const step = steps[stepIndex];

  if (!step) {
    return Response.json({ success: false, error: "Step not found" }, { status: 404 });
  }

  // Prefer the action whose tool_name matches the dispatched actionName,
  // but fall back to the first action for steps with a single action.
  const action =
    step.actions.find((a) => a.tool_name === actionName) ?? step.actions[0];

  if (!action) {
    return Response.json(
      { success: false, error: "No action defined for this step" },
      { status: 400 },
    );
  }

  try {
    const token = await getJWTToken();

    // A2UI forms serialise their field values as a JSON string inside
    // context.formData. Parse it back if that's what arrived.
    const rawFields =
      typeof formData.formData === "string"
        ? (JSON.parse(formData.formData) as Record<string, unknown>)
        : formData;

    const cleaned = cleanFormData(rawFields);

    // Interpolate path params: e.g. ".../patients/$patient_id/identifiers"
    // uses patient_id from sessionContext (set after step 1 completed).
    const url = resolveUrl(action.url, { ...sessionContext, ...cleaned });

    const res = await fetch(url, {
      method: action.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // GET requests must not carry a body per HTTP spec.
      body: action.method !== "GET" ? JSON.stringify(cleaned) : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ success: false, error: errText || `HTTP ${res.status}` });
    }

    const data: Record<string, unknown> = await res.json();

    // Pull declared output fields from the FHIR response and merge them into
    // sessionContext so later steps can reference them (e.g. patient_id for URL params).
    const outputs = extractOutputs(step.context.outputs, data);
    const updatedContext = { ...sessionContext, ...cleaned, ...outputs };

    // null means this was the last step in the workflow.
    const nextStepIndex = stepIndex + 1 < steps.length ? stepIndex + 1 : null;

    return Response.json({
      success: true,
      data,
      nextStepIndex,
      sessionContext: updatedContext,
    });
  } catch (error) {
    console.error(`[workflow/submit] Step ${stepIndex} action "${actionName}" failed:`, error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Submission failed",
      },
      { status: 500 },
    );
  }
}
