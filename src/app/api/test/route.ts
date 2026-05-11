import { createMCPClient } from "@ai-sdk/mcp";
import { NextRequest } from "next/server";

const token = process.env.MCP_TOKEN || "";

let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

async function getMCPClient() {
  if (!mcpClient) {
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: process.env.FHIR_MCP_URL!,
        headers: { Authorization: `Bearer ${token.trim()}` },
      },
    });
  }
  return mcpClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const client = await getMCPClient();

    const tools = await client.tools();

    return Response.json({
      success: true,
      tools,
      input: body,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}
