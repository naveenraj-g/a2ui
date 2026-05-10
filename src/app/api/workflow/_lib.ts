import type { WorkflowStepDefinition, StepContextOutput } from "@/types/workflow";
import { getAgentToken } from "@/modules/server/auth/agent-token";

export { getAgentToken };

export function sortedSteps(steps: WorkflowStepDefinition[]): WorkflowStepDefinition[] {
  return [...steps].sort((a, b) => a.sequence_number - b.sequence_number);
}

export function resolveUrl(template: string, context: Record<string, unknown>): string {
  return template.replace(/\$(\w+)/g, (_, key) => String(context[key] ?? ""));
}

export function extractOutputs(
  outputs: Record<string, StepContextOutput>,
  response: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(outputs)) {
    result[key] = def.field ? response[def.field] : response;
  }
  return result;
}

export function cleanFormData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== "" && value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function runContextResolver(
  resolver: NonNullable<WorkflowStepDefinition["context_resolver"]>,
  sessionContext: Record<string, unknown>,
  token: string,
): Promise<Record<string, unknown>> {
  const url = resolveUrl(resolver.url, sessionContext);
  const res = await fetch(url, {
    method: resolver.method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Context resolver failed: ${res.status}`);
  return res.json();
}
