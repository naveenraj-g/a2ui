import { createMCPClient } from "@ai-sdk/mcp"

const token = `
  eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIyMVRsdG1uME1tREJRR1N5SXZvZWg5bkpQQjl2QTE0U3NPSFZCbFFOeFJZIn0.eyJleHAiOjE3NzI3MjI3NTksImlhdCI6MTc3MjcyMjQ1OSwianRpIjoib25ydHJvOmZmZGE0NGZmLTYwMzQtMzk5My01NDJmLTUzMGQ5MThkZGJjOCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9yZWFsbXMvbm9uYW1lIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjkyZDUwMzg2LTBmMDctNDMyYy04MWZlLTk1MWI0NmIxYWVhOCIsInR5cCI6IkJlYXJlciIsImF6cCI6Im5vbmFtZSIsInNpZCI6IkRfb0c1LXRnNVZfOGkyU2dVQ281NGNETiIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtbm9uYW1lIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsibm9uYW1lIjp7InJvbGVzIjpbInBhdGllbnQiXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlRlc3QgVXNlciIsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3QiLCJnaXZlbl9uYW1lIjoiVGVzdCIsImZhbWlseV9uYW1lIjoiVXNlciIsImVtYWlsIjoidGVzdHVzZXIuZ25yQGdtYWlsLmNvbSJ9.lEiPnKv0yd7M27O_iWQDZANRv8_v3W7nt1GFPHQHWebuLAzG21i5FqY22KAX60TUYa-n-nnZrxwMMpDiCHgjIiD3627W2KlRY8je5p0kIRVxdoHSzQWJMdZ1vkmP6qjySKbchjN3LbrN7JsZYKYC7QyTlEpjVi2qkDpXwVZ--TeWOv9uNNAcF987prj-JuJ-aEtsdVZj5SXpuX-V5f4uKI2TgCMiSAE2phLaRjCSIL3ul2Sv0A4fxlqsBINL1A2uQ4CxIbu0Gl630_3DFtP9ByYX4HJgq7dbgn9bJa0CzXe8qYym8Zx71Y1uQTpLo8hpeemFpuhGDma5k7DQtBk-Hg
  `

const mcpClient = await createMCPClient({
  transport: {
    type: "http",
    url: "http://localhost:8002/mcp",
    headers: { Authorization: `Bearer ${token.trim()}` }
  }
})

export async function POST(req: Request) {
  const { tool, args }: { tool: string; args: Record<string, unknown> } = await req.json()

  if (!tool) {
    return Response.json(
      { error: "Missing required field: tool" },
      { status: 400 }
    )
  }

  try {
    const mcpTools = await mcpClient.tools()
    const mcpTool = mcpTools[tool]

    if (!mcpTool) {
      return Response.json(
        { error: `MCP tool "${tool}" not found` },
        { status: 404 }
      )
    }

    const result = await mcpTool.execute(args ?? {}, { messages: [], toolCallId: "" })

    return Response.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error(`Error executing tool "${tool}":`, error)

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to execute tool"
      },
      { status: 500 }
    )
  }
}
