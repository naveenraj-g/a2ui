import { UIMessage, streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { detectIntent } from "./intent-agent"
import { uiSchemas } from "./ui-schema-registry"
import { groq } from "@ai-sdk/groq"
import { createMCPClient } from "@ai-sdk/mcp"

const model = groq("llama-3.3-70b-versatile")

const token = `
  eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIyMVRsdG1uME1tREJRR1N5SXZvZWg5bkpQQjl2QTE0U3NPSFZCbFFOeFJZIn0.eyJleHAiOjE3NzI4ODUwMTUsImlhdCI6MTc3Mjg4NDcxNSwianRpIjoib25ydHJvOmE4ODQ1YThjLTc4YzgtNWJmNy1kMDExLTBmMjU3Yzk1MzQyNyIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9yZWFsbXMvbm9uYW1lIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjkyZDUwMzg2LTBmMDctNDMyYy04MWZlLTk1MWI0NmIxYWVhOCIsInR5cCI6IkJlYXJlciIsImF6cCI6Im5vbmFtZSIsInNpZCI6InNJM2ZXV1A5c1M4eGJzTVNTVExCcXY2SyIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtbm9uYW1lIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsibm9uYW1lIjp7InJvbGVzIjpbInBhdGllbnQiXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlRlc3QgVXNlciIsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3QiLCJnaXZlbl9uYW1lIjoiVGVzdCIsImZhbWlseV9uYW1lIjoiVXNlciIsImVtYWlsIjoidGVzdHVzZXIuZ25yQGdtYWlsLmNvbSJ9.CjbPk4s0qsB0AEger9B9IpbG8r1FLAl2pPJ2J0fFWZJEmzp0vgmic_iUDXlZd5uS41TTQYLBOPHThwFS0Zv-xRLBedmpGxP_1xPbUBQnVWNAve79j7UNATAUY77aj7u_5Dee6jdDztk4jlxcUzd4HSHHbNoHqANwXXRhnVvfjQrssy4844OPHMkTvCk8FJrJJQ5MXOpnXLQ4xpohbEFisYVVyPYaR5CPRmCXszj4My4T0HFSqxo1EXZYllbLogCIglnGH5F34SfX31T3Tp6BqsQfEl8NSu3eY4_KpGs8SZ5RNmt2LctDpyJuf86um9P6UItKPrFRfNLO8gVm2THBSA
  `

const mcpClient = await createMCPClient({
  transport: {
    type: "http",
    url: "http://localhost:8002/mcp",

    // optional: configure HTTP headers
    headers: { Authorization: `Bearer ${token.trim()}` }
  }
})

/**
 * Helper: wrap a JSON payload as a Vercel AI SDK UI message stream response.
 * Sends the JSON-stringified payload as a single text part so `useChat` can parse it.
 */
function jsonAsStreamResponse(payload: Record<string, unknown>) {
  const textContent = JSON.stringify(payload)

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      async execute({ writer }) {
        const partId = crypto.randomUUID()
        writer.write({ type: "text-start", id: partId })
        writer.write({ type: "text-delta", id: partId, delta: textContent })
        writer.write({ type: "text-end", id: partId })
      },
    }),
  })
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()
  
  const userMessage = messages[messages.length - 1].role === "user" ? messages[messages.length - 1].parts.filter(part => part.type === "text").map(part => (part as { type: "text"; text: string }).text).join("") : ""

  try {
    const intent = await detectIntent(userMessage)

    // ASK MODE — stream from the LLM
    if (intent.operation === "ASK") {
      const response = streamText({
        model,
        system: "Your are an AI assistant",
        messages: await convertToModelMessages(messages)
      })

      return response.toUIMessageStreamResponse()
    }

    const schema = uiSchemas[intent.schema as keyof typeof uiSchemas]

    if (!schema) {
      return jsonAsStreamResponse({
        type: "fallback",
        message: "No UI schema available for this request"
      })
    }

    // POST operation -> return schema only
    if (schema.method === "POST") {
      return jsonAsStreamResponse({
        type: "ui",
        ui: schema.schema,
        data: null
      })
    }

    // GET operation -> fetch data using MCP
    const mcpTools = await mcpClient.tools()

    const tool = mcpTools[schema.tool]

    if (!tool) {
      return jsonAsStreamResponse({
        type: "fallback",
        message: `MCP tool "${schema.tool}" not found`
      })
    }
    
    const data = await tool.execute({}, { messages: [], toolCallId: "" })

    return jsonAsStreamResponse({
      type: "ui",
      ui: schema.schema,
      data
    })
  } catch (error) {
    console.error(error)

    return jsonAsStreamResponse({
      type: "error",
      message: "Failed to process request"
    })
  }
}