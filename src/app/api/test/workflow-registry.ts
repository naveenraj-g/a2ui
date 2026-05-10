import updatePatient from "@/workflows/update_patient.json"
import type { WorkflowDefinition, WorkflowStep } from "./workflow-types"

// Register all workflow JSON configs here
const workflowConfigs: WorkflowDefinition[] = [
  updatePatient as unknown as WorkflowDefinition,
]

// Index by ID for fast lookup
export const workflows: Record<string, WorkflowDefinition> = {}
for (const wf of workflowConfigs) {
  workflows[wf.id] = wf
}

/** Get a specific step from a workflow */
export function getWorkflowStep(
  workflowId: string,
  stepId: string
): WorkflowStep | null {
  const wf = workflows[workflowId]
  if (!wf) return null
  return wf.steps[stepId] ?? null
}

/** Get the list of workflow IDs and descriptions for the intent agent prompt */
export function getWorkflowDescriptions(): string {
  return workflowConfigs
    .map((wf) => `- ${wf.id}: ${wf.description || wf.name}`)
    .join("\n")
}
