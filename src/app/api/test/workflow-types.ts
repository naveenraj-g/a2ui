export interface WorkflowStep {
  /** UI schema key from the schema registry */
  schema: string;
  /** Whether this step fetches data (GET) or shows a form (POST) */
  method: "GET" | "POST";
  /** MCP tool name to call (for GET steps or POST submit steps) */
  tool?: string;
  /** Maps context keys to MCP tool arguments. Values starting with "$context." are resolved from sessionContext */
  contextArgs?: Record<string, string>;
  /** Next step ID after this step completes */
  nextStep?: string;
  /** Whether to pre-fill the form with data from sessionContext */
  prefillFromContext?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  entryStep: string;
  steps: Record<string, WorkflowStep>;
}

/**
 * Resolve context argument values.
 * "$context.patient_id" → reads patient_id from sessionContext
 * Literal values are passed through as-is.
 */
export function resolveContextArgs(
  contextArgs: Record<string, string>,
  sessionContext: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(contextArgs)) {
    if (typeof value === "string" && value.startsWith("$context.")) {
      const contextKey = value.slice("$context.".length);
      resolved[key] = sessionContext[contextKey];
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}
