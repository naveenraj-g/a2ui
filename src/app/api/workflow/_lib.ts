/**
 * Shared utilities for the /api/workflow route family.
 *
 * All three routes (route.ts, step/route.ts, submit/route.ts) import from here
 * to avoid duplicating token fetching, URL interpolation, and data-mapping logic.
 *
 * Token strategy: every server-side request to the FHIR server or the external
 * agent uses a short-lived JWT obtained from Better Auth's JWT plugin endpoint.
 * The token is fetched fresh per request by forwarding the current session cookie,
 * so it always reflects the caller's identity and expiry.
 */

import type { WorkflowStepDefinition, StepContextOutput, ContextResolverDef } from "@/types/workflow";
import { getJWTToken } from "@/modules/server/auth/jwt-token";

// Re-export so route files only need to import from this one file.
export { getJWTToken };

/**
 * Returns workflow steps sorted by sequence_number ascending.
 * The workflow JSON from the external agent makes no ordering guarantee,
 * so we always sort before indexing by position.
 */
export function sortedSteps(steps: WorkflowStepDefinition[]): WorkflowStepDefinition[] {
  return [...steps].sort((a, b) => a.sequence_number - b.sequence_number);
}

/**
 * Interpolates `$variable` placeholders in a URL template using values from
 * the session context.
 *
 * Example:
 *   template: "https://fhir.example.com/patients/$patient_id/identifiers"
 *   context:  { patient_id: 42 }
 *   result:   "https://fhir.example.com/patients/42/identifiers"
 *
 * Unknown keys are replaced with an empty string to avoid leaving raw
 * placeholders in the URL.
 */
export function resolveUrl(template: string, context: Record<string, unknown>): string {
  const merged: Record<string, unknown> = {
    fhir_server_url: process.env.FHIR_SERVER_URL ?? "",
    ...context,
  };
  return template.replace(/\$(\w+)/g, (_, key) => String(merged[key] ?? ""));
}

/**
 * Maps a FHIR response onto the step's declared output contract.
 *
 * Each entry in `outputs` optionally specifies a `field` — the top-level
 * response key to pluck. When `field` is absent the entire response object
 * is stored under the output key (useful for storing a whole resource).
 *
 * Example:
 *   outputs:  { patient_id: { type: "integer", field: "id" } }
 *   response: { id: 7, name: [...] }
 *   result:   { patient_id: 7 }
 */
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

/**
 * Strips empty, null, and undefined values from form data before sending to
 * the FHIR server. Optional fields left blank by the user should not be
 * included in the request body rather than sent as empty strings.
 */
export function cleanFormData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== "" && value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Runs multiple context resolvers in parallel and merges all results into a
 * single flat object. Each resolver writes under its own `context_key` (or
 * directly at the top level when `context_key` is absent).
 */
export async function runContextResolvers(
  resolvers: ContextResolverDef[],
  sessionContext: Record<string, unknown>,
  token: string,
): Promise<Record<string, unknown>> {
  const results = await Promise.all(
    resolvers.map((r) => runContextResolver(r, sessionContext, token)),
  );
  return Object.assign({}, ...results);
}

/**
 * Executes a step's `context_resolver` — a preliminary GET (or POST) against
 * the FHIR server to hydrate the latest resource state before the form is shown.
 *
 * For example, before showing the "Add Identifier" form the resolver fetches
 * the current Patient so the UI can display existing data alongside the form.
 *
 * The resolved response is merged into sessionContext by the caller so
 * subsequent steps and URL interpolations have access to the fetched fields.
 *
 * Throws if the FHIR server returns a non-2xx status.
 */
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
    signal: resolver.timeout_ms ? AbortSignal.timeout(resolver.timeout_ms) : undefined,
  });
  if (!res.ok) throw new Error(`Context resolver failed: ${res.status}`);
  const body = await res.json();
  return resolver.context_key ? { [resolver.context_key]: body } : body;
}
