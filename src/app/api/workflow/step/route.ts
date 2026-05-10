import type { WorkflowDefinition } from "@/types/workflow";
import { getAgentToken, sortedSteps, runContextResolver } from "../_lib";

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

  const steps = sortedSteps(workflow.workflow_steps);
  const step = steps[stepIndex];

  if (!step) {
    return Response.json({ type: "error", message: "Step not found" }, { status: 404 });
  }

  try {
    const token = await getAgentToken();
    let stepData: Record<string, unknown> = {};
    let mergedContext = { ...sessionContext };

    if (step.context_resolver) {
      stepData = await runContextResolver(step.context_resolver, mergedContext, token);
      mergedContext = { ...mergedContext, ...stepData };
    }

    return Response.json({
      type: "workflow_step",
      step,
      stepIndex,
      stepData,
      sessionContext: mergedContext,
    });
  } catch (error) {
    console.error(`[workflow/step] Failed to load step ${stepIndex}:`, error);
    return Response.json({ type: "error", message: "Failed to load step" }, { status: 500 });
  }
}
