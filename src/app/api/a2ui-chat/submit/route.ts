import { createMCPClient } from "@ai-sdk/mcp";
import { getWorkflowStep } from "../../test/workflow-registry";

const token = process.env.MCP_TOKEN || "";

let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

async function getMCPClient() {
  if (!mcpClient) {
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: "http://localhost:8002/mcp",
        headers: { Authorization: `Bearer ${token.trim()}` },
      },
    });
  }
  return mcpClient;
}

interface SubmitRequest {
  actionName: string;
  context: Record<string, unknown>;
  // Workflow state from the client
  activeWorkflow?: string;
  currentStep?: string;
  sessionContext?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const {
    actionName,
    context,
    activeWorkflow,
    currentStep,
    sessionContext = {},
  }: SubmitRequest = await req.json();

  if (!actionName) {
    return Response.json(
      { success: false, error: "Missing actionName" },
      { status: 400 },
    );
  }

  // The action name from the form dispatch maps directly to the MCP tool name
  const toolName = actionName;

  try {
    const client = await getMCPClient();
    const mcpTools = await client.tools();
    const tool = mcpTools[toolName];

    if (!tool) {
      return Response.json(
        { success: false, error: `MCP tool "${toolName}" not found` },
        { status: 404 },
      );
    }

    // Parse form data and remove empty/null/undefined fields
    const rawData = JSON.parse(context.formData as string) ?? {};
    const cleanedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (value !== "" && value !== undefined && value !== null) {
        cleanedData[key] = value;
      }
    }

    const result = await tool.execute(cleanedData, {
      messages: [],
      toolCallId: "",
    });

    // MCP tool returns { content, isError } — check if the tool reported an error
    const mcpResult = result as {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
    if (mcpResult.isError) {
      const errorText =
        mcpResult.content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n") || "Tool execution failed";

      return Response.json({
        success: false,
        toolName,
        error: errorText,
      });
    }

    // Determine workflow continuation
    let workflowInfo = null;
    if (activeWorkflow && currentStep) {
      const stepDef = getWorkflowStep(activeWorkflow, currentStep);
      if (stepDef) {
        const mergedContext = {
          ...sessionContext,
          ...cleanedData,
          ...(mcpResult.structuredContent ?? {}),
        };
        workflowInfo = {
          name: activeWorkflow,
          currentStep,
          nextStep: stepDef.nextStep ?? null,
          sessionContext: mergedContext,
        };
      }
    }

    return Response.json({
      success: true,
      toolName,
      data: mcpResult.structuredContent ?? result,
      workflow: workflowInfo,
    });
  } catch (error) {
    console.error(`Error executing tool "${toolName}":`, error);
    return Response.json(
      {
        success: false,
        toolName,
        error:
          error instanceof Error ? error.message : "Failed to execute tool",
      },
      { status: 500 },
    );
  }
}
