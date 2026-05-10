import { generateObject } from "ai"
import { z } from "zod"
import { groq } from "@ai-sdk/groq"
import { getWorkflowDescriptions } from "./workflow-registry"

const model = groq("meta-llama/llama-4-scout-17b-16e-instruct")

const intentSchema = z.object({
  schema: z.string().nullable(),
  operation: z.enum(["GET", "POST", "ASK"]),
  workflow: z.string().nullable()
})

export async function detectIntent(message: string) {
  const workflowList = getWorkflowDescriptions()

  const { object } = await generateObject({
    model,
    schema: intentSchema,
    prompt: `
Determine which predefined UI schema should be used.

Available schemas:
- create_patient
- list_patients

Available workflows (multi-step flows):
${workflowList}

Rules:
- GET operations fetch data
- POST operations only return schema
- ASK means normal conversation
- If the request matches a workflow, set workflow to the workflow id and schema to null
- If the request mentions updating/editing with an ID or entity, extract the workflow id
- Only set workflow if the request clearly matches a multi-step flow

User request:
${message}
`
  })

  return object
}