# A2UI — Server-Side Architecture

The server side is a set of four Next.js API routes under `src/app/api/workflow/`. Together they form a **stateless workflow engine**: every request re-sends the full `WorkflowDefinition` JSON, so no server-side workflow state is kept between calls. The client is the single source of truth.

---

## Route Map

```
POST /api/workflow              ← user message → start workflow, run step 1
POST /api/workflow/step         ← advance to any step (run its context resolvers)
POST /api/workflow/submit       ← execute a step's HTTP action (call FHIR server)
GET  /api/workflow/terminology  ← proxy for live terminology search (SNOMED/LOINC/etc.)
```

---

## 1. `POST /api/workflow` — Start a Workflow

**File:** `src/app/api/workflow/route.ts`

### What it does

1. Receives `{ message, sessionContext? }` from the chat UI.
2. Obtains a short-lived JWT from Better Auth (forwarded session cookie).
3. POSTs `{ query, session_id }` to the external AI agent (`AGENT_API_URL`). The agent interprets the user's intent and returns a complete `WorkflowDefinition` JSON.
4. Sorts the workflow steps by `sequence_number`.
5. Takes `steps[0]` (the first step).
6. Runs any `context_resolvers` declared on the first step **server-side before responding** — so terminology value sets, FHIR lookups, etc. are ready when the form renders.
7. Returns the full workflow + first step + pre-fetched data to the client.

### Request

```json
{
  "message": "register patient",
  "sessionContext": {}
}
```

### Response

```json
{
  "type": "workflow_step",
  "workflow": { /* full WorkflowDefinition — client caches this */ },
  "stepIndex": 0,
  "step": { /* WorkflowStepDefinition */ },
  "stepData": { /* pre-fetched FHIR data, empty object if none */ },
  "sessionContext": { /* merged context after resolver outputs */ }
}
```

### Agent request format

```json
{
  "query": "register patient",
  "session_id": "<uuid from sessionContext or crypto.randomUUID()>"
}
```

---

## 2. `POST /api/workflow/step` — Load a Specific Step

**File:** `src/app/api/workflow/step/route.ts`

### What it does

Called by the client after a successful form submission to advance to the next step, or when a step is auto-advanced (e.g. `step_type: "context"`). The client re-sends the full `WorkflowDefinition` (no server-side storage needed).

1. Sorts steps and looks up `steps[stepIndex]`.
2. Gets a fresh JWT.
3. Runs the step's `context_resolvers` (plural, parallel) or `context_resolver` (singular, backward-compat) against the FHIR server.
4. Merges resolver output into `sessionContext`.
5. Returns step definition + fetched data.

### Request

```json
{
  "workflow": { /* full WorkflowDefinition */ },
  "stepIndex": 1,
  "sessionContext": { "patient_id": 42 }
}
```

### Response

```json
{
  "type": "workflow_step",
  "step": { /* WorkflowStepDefinition */ },
  "stepIndex": 1,
  "stepData": { /* data fetched by resolvers */ },
  "sessionContext": { /* updated context */ }
}
```

---

## 3. `POST /api/workflow/submit` — Execute a Step's Action

**File:** `src/app/api/workflow/submit/route.ts`

### What it does

This is the form submission leg. It calls the FHIR server directly using the URL declared in the step's `actions[]` array.

1. Resolves the target step from the re-sent `WorkflowDefinition`.
2. Matches `actionName` to `step.actions[].tool_name` (falls back to `actions[0]`).
3. Gets a fresh JWT.
4. Unpacks `formData` — A2UI forms dispatch `{ formData: "<JSON string>" }`, so the route JSON-parses the string if needed.
5. Strips empty/null fields via `cleanFormData`.
6. Validates the cleaned payload against the action's Zod schema (if declared).
7. Interpolates the action URL with `$sessionContext` variables (`$patient_id` → `42`).
8. POSTs (or PATCHes/PUTs) to the FHIR endpoint with Bearer auth.
9. Extracts declared output fields from the response into `sessionContext` (e.g. `response.id → patient_id`).
10. Returns `{ success, data, nextStepIndex, sessionContext }`.

### Request

```json
{
  "workflow": { /* full WorkflowDefinition */ },
  "stepIndex": 0,
  "actionName": "create_patient",
  "formData": {
    "formData": "{\"given_name\":\"John\",\"gender\":\"male\"}"
  },
  "sessionContext": {}
}
```

### Response (success)

```json
{
  "success": true,
  "data": { /* FHIR resource response */ },
  "nextStepIndex": 1,
  "sessionContext": { "patient_id": 42 }
}
```

### Response (failure)

```json
{
  "success": false,
  "error": "Validation failed: gender must be one of..."
}
```

---

## 4. `GET /api/workflow/terminology` — Terminology Search Proxy

**File:** `src/app/api/workflow/terminology/route.ts`

A server-side proxy that injects FHIR credentials so neither the base URL nor the JWT leaks to the browser. Used by `TerminologySelect` when `serverSearch` is configured (for medical codes like SNOMED/LOINC/ICD-10 — not for standard HL7 value sets which are pre-fetched via context resolvers).

### Query params

| Param | Description |
|-------|-------------|
| `resource` | FHIR resource name, e.g. `Observation` |
| `field` | Resource field, e.g. `code` |
| `query` | Free-text search term (forwarded as `?search=`) |

### Example

```
GET /api/workflow/terminology?resource=Observation&field=code&query=diabetes
```

Proxies to:
```
GET $FHIR_SERVER_URL/api/fhir/v1/terminology/concepts?resource=Observation&field=code&search=diabetes
Authorization: Bearer <jwt>
```

---

## Shared Utilities — `_lib.ts`

**File:** `src/app/api/workflow/_lib.ts`

All three main routes import from this file.

### `sortedSteps(steps)`

Sorts `WorkflowStepDefinition[]` by `sequence_number` ascending. The agent makes no ordering guarantee, so this is called everywhere before indexing by position.

### `resolveUrl(template, context)`

Interpolates `$variable` placeholders in a URL template:

```ts
resolveUrl("$fhir_server_url/api/fhir/v1/patients/$patient_id", { patient_id: 42 })
// → "https://fhir.example.com/api/fhir/v1/patients/42"
```

`$fhir_server_url` is automatically injected from `process.env.FHIR_SERVER_URL` — it never needs to be in `sessionContext`.

### `extractOutputs(outputs, response)`

Maps FHIR response fields to named context keys per the step's `context.outputs` declaration:

```json
"outputs": { "patient_id": { "type": "integer", "field": "id" } }
```

```ts
extractOutputs(outputs, { id: 42, name: [...] })
// → { patient_id: 42 }
```

When `field` is absent, the entire response object is stored under the output key.

### `cleanFormData(data)`

Strips `""`, `null`, and `undefined` values before sending to FHIR. Optional fields left blank by the user must not be sent as empty strings.

### `runContextResolver(resolver, sessionContext, token)`

Executes a single `context_resolver` — a GET or POST to the FHIR server before a step renders. The result is stored under `resolver.context_key` if specified, otherwise merged directly into `stepData`.

```ts
// resolver.context_key = "gender_concepts"
// response = { concepts: [...], total: 4, ... }
// result = { gender_concepts: { concepts: [...] } }
```

### `runContextResolvers(resolvers, sessionContext, token)`

Runs **multiple resolvers in parallel** via `Promise.all` and merges all results. Total wait = `max(individual fetch times)`, not their sum.

```ts
const stepData = await runContextResolvers([
  { context_key: "gender_concepts",        url: "..." },
  { context_key: "marital_status_concepts", url: "..." },
], sessionContext, token);
// both fetched simultaneously
```

---

## `WorkflowDefinition` Type System

**File:** `src/types/workflow.ts`

### `WorkflowDefinition`

The complete workflow returned by the AI agent. Travels from server → client → server with every `/step` and `/submit` call.

```ts
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  workflow_steps: WorkflowStepDefinition[];
  introduction?: string;      // shown as first chat message
  completion?: {
    message: string;          // shown after the last step
    action?: "dismiss";
  };
}
```

### `WorkflowStepDefinition`

```ts
interface WorkflowStepDefinition {
  sequence_number: number;
  id: string;
  step_type: "form" | "view" | "confirm" | "context";
  optional?: boolean;

  // Single resolver — backward compatible
  context_resolver?: ContextResolverDef;

  // Multiple resolvers — run in parallel via Promise.all
  context_resolvers?: ContextResolverDef[];

  ui?: {
    schema: string;           // key into UI_SCHEMA_REGISTRY
    mode?: "create" | "edit" | "view" | "append";
  };

  context?: {
    inputs: Record<string, StepContextInput>;
    outputs: Record<string, StepContextOutput>;  // mapped to sessionContext after submit
  };

  actions?: WorkflowAction[];
}
```

### `ContextResolverDef`

```ts
interface ContextResolverDef {
  context_key?: string;    // key under which result is stored in stepData
  tool_name: string;       // logical name for logging/debugging
  url: string;             // $variable interpolated against sessionContext
  method: "GET" | "POST";
  timeout_ms?: number;
}
```

### `WorkflowAction`

```ts
interface WorkflowAction {
  tool_name: string;         // matched by the client when dispatching
  url: string;               // $variable interpolated (e.g. /patients/$patient_id)
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  validation_schema?: string; // key into VALIDATION_SCHEMAS
  retryable: boolean;
  timeout_ms?: number;
}
```

---

## Validation Schemas

**File:** `src/modules/client/ai-hub/schemas/validation/index.ts`

The submit route validates `cleanFormData` against a Zod schema before calling FHIR:

```ts
export const VALIDATION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  patient_create_schema:    patientCreateSchema,
  identifier_create_schema: identifierCreateSchema,
  telecom_create_schema:    telecomCreateSchema,
  address_create_schema:    addressCreateSchema,
};
```

Each schema lives in `schemas/validation/patient/`. Validation failures return HTTP 422 with the Zod error message — the FHIR server is never called with invalid data.

---

## Context Resolver Pattern

### Single resolver (backward-compat)

Used when a step needs exactly one pre-fetch (e.g. re-fetch Patient before appending identifiers):

```json
"context_resolver": {
  "context_key": null,
  "tool_name": "get_patient_by_id",
  "url": "$fhir_server_url/api/fhir/v1/patients/$patient_id",
  "method": "GET"
}
```

Result is merged directly into `stepData` (no wrapping key).

### Multiple resolvers (parallel)

Used when a step needs several pre-fetches simultaneously (e.g. terminology value sets for select fields):

```json
"context_resolvers": [
  {
    "context_key": "gender_concepts",
    "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=gender",
    "method": "GET"
  },
  {
    "context_key": "marital_status_concepts",
    "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=maritalStatus",
    "method": "GET"
  }
]
```

Results are merged: `stepData = { gender_concepts: {...}, marital_status_concepts: {...} }`.

The UI schema then references them as `"$gender_concepts.concepts"` — resolved by `mapDataToUI` before the component renders.

---

## Stateless Design

The server keeps **zero workflow state** between requests. The client:

- Stores the full `WorkflowDefinition` in Zustand and re-sends it with every `/step` and `/submit` call.
- Accumulates `sessionContext` (a flat key-value map) across steps and re-sends it too.
- Tracks `currentStepIndex`.

This means any server replica can handle any request — no sticky sessions, no workflow tables.

The tradeoff is that the `WorkflowDefinition` JSON travels in every request body. For typical workflows (4–10 steps, JSON < 20 KB) this is negligible.

---

## JWT Authentication

Every server call to the FHIR server or the external agent uses a short-lived JWT obtained by calling Better Auth's JWT plugin endpoint. The token is fetched fresh per API route invocation — it always reflects the caller's identity and expiry, and it is never stored server-side.

```ts
// src/modules/server/auth/jwt-token.ts
const token = await getJWTToken(); // reads session cookie, returns signed JWT
```

The JWT is passed as `Authorization: Bearer <token>` to both the agent and the FHIR server.
