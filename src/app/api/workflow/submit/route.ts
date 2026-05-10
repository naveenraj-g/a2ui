import type { WorkflowDefinition } from "@/types/workflow";
import { getAgentToken, sortedSteps, resolveUrl, extractOutputs, cleanFormData } from "../_lib";

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
    actionName: string;
    formData: Record<string, unknown>;
    sessionContext?: Record<string, unknown>;
  } = await req.json();

  const steps = sortedSteps(workflow.workflow_steps);
  const step = steps[stepIndex];

  if (!step) {
    return Response.json({ success: false, error: "Step not found" }, { status: 404 });
  }

  const action =
    step.actions.find((a) => a.tool_name === actionName) ?? step.actions[0];

  if (!action) {
    return Response.json(
      { success: false, error: "No action defined for this step" },
      { status: 400 },
    );
  }

  try {
    const token = await getAgentToken();

    // Resolve formData: A2UI forms send context.formData as a JSON string
    const rawFields =
      typeof formData.formData === "string"
        ? (JSON.parse(formData.formData) as Record<string, unknown>)
        : formData;

    const cleaned = cleanFormData(rawFields);
    const url = resolveUrl(action.url, { ...sessionContext, ...cleaned });

    const res = await fetch(url, {
      method: action.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: action.method !== "GET" ? JSON.stringify(cleaned) : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ success: false, error: errText || `HTTP ${res.status}` });
    }

    const data: Record<string, unknown> = await res.json();

    const outputs = extractOutputs(step.context.outputs, data);
    const updatedContext = { ...sessionContext, ...cleaned, ...outputs };

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
