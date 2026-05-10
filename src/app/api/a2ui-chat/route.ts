import { detectIntent } from "../test/intent-agent";
import { uiSchemas } from "../test/ui-schema-registry";
import { workflows, getWorkflowStep } from "../test/workflow-registry";
import { resolveContextArgs } from "../test/workflow-types";
import { createMCPClient } from "@ai-sdk/mcp";

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

interface ChatRequest {
  message?: string;
  workflow?: string;
  step?: string;
  sessionContext?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const body: ChatRequest = await req.json();
  const { message, workflow, step, sessionContext = {} } = body;

  try {
    // ─── WORKFLOW STEP EXECUTION (direct step request) ───
    if (workflow && step) {
      return await executeWorkflowStep(workflow, step, sessionContext);
    }

    // ─── INTENT DETECTION (from user message) ───
    if (!message?.trim()) {
      return Response.json(
        { type: "error", message: "Empty message" },
        { status: 400 },
      );
    }

    const intent = await detectIntent(message);

    // ASK MODE — return a text response
    if (intent.operation === "ASK") {
      return Response.json({
        type: "text",
        message: `I understand you're asking: "${message}". This is a plain text response.`,
      });
    }

    // WORKFLOW DETECTED — start a workflow from its entry step
    if (intent.workflow) {
      const wf = workflows[intent.workflow];
      if (wf) {
        // Extract any entity IDs from the message into context
        const contextFromMessage = extractParamsFromMessage(message);
        const mergedContext = { ...sessionContext, ...contextFromMessage };

        return await executeWorkflowStep(wf.id, wf.entryStep, mergedContext);
      }
    }

    // REGULAR SCHEMA FLOW (no workflow)
    const schema = uiSchemas[intent.schema as keyof typeof uiSchemas];

    if (!schema) {
      return Response.json({
        type: "fallback",
        message: "No UI schema available for this request",
      });
    }

    // POST operation -> return schema only
    if (schema.method === "POST") {
      return Response.json({
        type: "ui",
        ui: schema.schema,
        data: null,
      });
    }

    // GET operation -> fetch data using MCP
    const client = await getMCPClient();
    const mcpTools = await client.tools();
    const tool = mcpTools[schema.tool];

    if (!tool) {
      return Response.json(
        {
          type: "fallback",
          message: `MCP tool "${schema.tool}" not found`,
        },
        { status: 404 },
      );
    }

    const rawData = await tool.execute({}, { messages: [], toolCallId: "" });
    const mcpResponse = rawData as {
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
    const extractedData = mcpResponse.structuredContent ?? {};

    return Response.json({
      type: "ui",
      ui: schema.schema,
      data: extractedData,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        type: "error",
        message: "Failed to process request",
      },
      { status: 500 },
    );
  }
}

// ─── WORKFLOW STEP EXECUTION ───

async function executeWorkflowStep(
  workflowId: string,
  stepId: string,
  sessionContext: Record<string, unknown>,
) {
  const stepDef = getWorkflowStep(workflowId, stepId);

  if (!stepDef) {
    return Response.json(
      {
        type: "error",
        message: `Workflow step "${workflowId}/${stepId}" not found`,
      },
      { status: 404 },
    );
  }

  const schema = uiSchemas[stepDef.schema as keyof typeof uiSchemas];

  // GET step — call MCP tool, merge result into context, return UI with data
  if (stepDef.method === "GET" && stepDef.tool) {
    const client = await getMCPClient();
    const mcpTools = await client.tools();
    const tool = mcpTools[stepDef.tool];

    if (!tool) {
      return Response.json(
        {
          type: "fallback",
          message: `MCP tool "${stepDef.tool}" not found`,
        },
        { status: 404 },
      );
    }

    // Resolve context arguments (e.g., $context.patient_id → actual value)
    const toolArgs = stepDef.contextArgs
      ? resolveContextArgs(stepDef.contextArgs, sessionContext)
      : {};

    const rawData = await tool.execute(toolArgs, {
      messages: [],
      toolCallId: "",
    });
    const mcpResponse = rawData as {
      structuredContent?: Record<string, unknown>;
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    if (mcpResponse.isError) {
      const errorText =
        mcpResponse.content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n") || "Tool execution failed";

      return Response.json({
        type: "error",
        message: errorText,
      });
    }

    const extractedData = mcpResponse.structuredContent ?? {};
    // Merge fetched data into session context for next steps
    const mergedContext = { ...sessionContext, ...extractedData };

    return Response.json({
      type: "ui",
      ui: schema?.schema ?? null,
      data: extractedData,
      workflow: {
        name: workflowId,
        currentStep: stepId,
        nextStep: stepDef.nextStep ?? null,
        sessionContext: mergedContext,
      },
    });
  }

  // POST step — return schema only (form), client will submit via /submit endpoint
  return Response.json({
    type: "ui",
    ui: schema?.schema ?? null,
    data: stepDef.prefillFromContext ? sessionContext : null,
    workflow: {
      name: workflowId,
      currentStep: stepId,
      nextStep: stepDef.nextStep ?? null,
      sessionContext,
    },
  });
}

// ─── HELPERS ───

/** Extract numeric IDs from natural language messages */
function extractParamsFromMessage(message: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Match patterns like "patient 123", "patient id 5", "patient #42"
  const idMatch = message.match(/(?:patient|id)\s*#?\s*(\d+)/i);
  if (idMatch) {
    params.patient_id = parseInt(idMatch[1], 10);
  }

  return params;
}
