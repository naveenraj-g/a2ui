import type { WorkflowDefinition } from "@/types/workflow";
import { getAgentToken, sortedSteps, runContextResolver } from "./_lib";

const AGENT_API_URL = process.env.AGENT_API_URL!;

export async function POST(req: Request) {
  const {
    message,
    sessionContext = {},
  }: { message: string; sessionContext?: Record<string, unknown> } = await req.json();

  if (!message?.trim()) {
    return Response.json({ type: "error", message: "Empty message" }, { status: 400 });
  }

  try {
    const token = await getAgentToken();

    const agentRes = await fetch(AGENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
      cache: "no-store",
    });

    if (!agentRes.ok) {
      throw new Error(`Agent API error: ${agentRes.status}`);
    }

    const workflow: WorkflowDefinition = await agentRes.json();
    const steps = sortedSteps(workflow.workflow_steps);
    const firstStep = steps[0];

    if (!firstStep) {
      return Response.json({ type: "error", message: "Workflow has no steps" }, { status: 500 });
    }

    let stepData: Record<string, unknown> = {};
    let mergedContext = { ...sessionContext };

    if (firstStep.context_resolver) {
      stepData = await runContextResolver(firstStep.context_resolver, mergedContext, token);
      mergedContext = { ...mergedContext, ...stepData };
    }

    return Response.json({
      type: "workflow_step",
      workflow,
      stepIndex: 0,
      step: firstStep,
      stepData,
      sessionContext: mergedContext,
    });
  } catch (error) {
    console.error("[workflow] Failed to start workflow:", error);
    return Response.json({ type: "error", message: "Failed to start workflow" }, { status: 500 });
  }
}
