---
name: a2ui-workflow
description: Use this skill when designing, building, or extending an a2ui workflow. Triggers on phrases like "create a workflow", "add a new workflow", "design a workflow for", "add a step to", "how do I build a workflow", "what files do I need for a workflow", or any request to implement a multi-step FHIR form flow in the a2ui system.
allowed-tools: Read, Glob, Grep, Edit, Write
---

# a2ui Workflow Design Guide

A workflow is a multi-step form flow driven entirely by JSON and Zod schemas. No React components are written per workflow — you wire together existing catalog components. Five layers must be in sync for a workflow to work end-to-end.

## The Five Layers

```
1. Workflow JSON          workflows/<domain>/<name>.json
2. UI schema JSONs        schemas/ui/<step>_form.json          (one per step)
3. Zod validation schemas schemas/validation/<domain>/<name>.ts (one per POST action)
4. UI schema index        schemas/ui/index.ts                   (register every form)
5. Validation index       schemas/validation/index.ts           (register every schema)
```

The route `src/app/api/workflow/route.ts` hardcodes which workflow to load during development (the agent integration replaces this). Register new workflows there for testing.

---

## Layer 1 — Workflow JSON

File: `src/modules/client/ai-hub/workflows/<domain>/<workflow_id>.json`

### Top-level shape

```jsonc
{
  "id": "book_appointment",          // unique, snake_case
  "name": "Book Appointment",
  "description": "...",
  "version": "2.0.0",
  "tags": ["fhir", "appointment"],
  "llm_hints": {
    "intent_examples": ["Book an appointment", "Schedule a visit"],
    "when_to_use": ["User wants to book a new appointment"],
    "when_not_to_use": ["User wants to cancel an appointment"],
    "required_context": []
  },
  "execution": { "mode": "deterministic", "orchestrator": "nextjs", "audit_enabled": true },
  "introduction": "I'll help you ... in N steps.",
  "completion": { "message": "Done message shown to user.", "action": "dismiss" },
  "workflow_steps": [ /* see below */ ]
}
```

### Step shape

```jsonc
{
  "sequence_number": 1,              // determines render order
  "id": "select_practitioner",       // unique within workflow
  "name": "Select Practitioner",
  "step_type": "form",
  "optional": true,                  // omit or false if required
  "description": "...",
  "context": {
    "inputs": {
      /* values the step needs from sessionContext */
      "patient_id": { "type": "integer", "source": "workflow" }
    },
    "outputs": {
      /* keys to extract from resolver/action responses into sessionContext */
      "patient_id": { "type": "integer", "resource": "Patient", "field": "id" },
      /* dot-notation traverses nested objects: */
      "slot_id":    { "type": "integer", "resource": "Slot", "field": "me_slot.id" }
    }
  },
  "context_resolvers": [ /* see below — use plural always */ ],
  "ui":      { "schema": "appointment_pick_practitioner_form", "mode": "create", "prefill": false, "editable": true },
  "actions": [ /* see below */ ]
}
```

### context_resolvers (always use plural array)

Each resolver runs in parallel before the step renders. Results are stored at `stepData[context_key]` and merged into `sessionContext`.

```jsonc
{
  "description": "Fetch active practitioners for booking.",
  "context_key": "booking_practitioners",   // key in stepData; omit for existence-check GETs
  "tool_name": "list_practitioners_for_booking",
  "url": "$fhir_server_url/api/fhir/v1/practitioner-roles/booking",
  "method": "GET",
  "timeout_ms": 10000
}
```

**URL interpolation**: `$var_name` is replaced from `sessionContext` at runtime. Use `$fhir_server_url`, `$patient_id`, `$slot_id`, etc.

**Terminology value sets** — always fetch these instead of hardcoding MultipleChoice items:

```jsonc
{ "context_key": "gender_concepts",         "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=gender" },
{ "context_key": "name_use_concepts",       "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=name.use" },
{ "context_key": "identifier_use_concepts", "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=identifier.use" },
{ "context_key": "telecom_system_concepts", "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=telecom.system" },
{ "context_key": "telecom_use_concepts",    "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=telecom.use" },
{ "context_key": "address_use_concepts",    "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=address.use" },
{ "context_key": "address_type_concepts",   "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=address.type" },
{ "context_key": "marital_status_concepts", "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=maritalStatus" },
{ "context_key": "communication_language_concepts", "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Patient&field=communication.language" },
{ "context_key": "appointment_status_concepts",     "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Appointment&field=status" },
{ "context_key": "appointment_type_concepts",       "url": "$fhir_server_url/api/fhir/v1/terminology/concepts?resource=Appointment&field=appointmentType" }
```

**Auto-resolve patient** (step 3+ of booking flows) — fetches the logged-in user's patient profile without asking them to enter it:

```jsonc
{
  "description": "Resolve logged-in user's Patient record.",
  "context_key": "me_patient",
  "tool_name": "get_my_patient_profile",
  "url": "$fhir_server_url/api/fhir/v1/patients/me",
  "method": "GET",
  "timeout_ms": 8000
}
```
Then in `context.outputs`:
```jsonc
"patient_id": { "type": "integer", "resource": "Patient", "field": "me_patient.id" }
```

### actions

```jsonc
{
  "type": "http",
  "purpose": "create_appointment",
  "tool_name": "create_appointment",
  "url": "$fhir_server_url/api/fhir/v1/appointments/",
  "method": "POST",                      // GET or POST
  "validation_schema": "appointment_create_schema",  // required for POST
  "iterate_key": "names",                // optional — POST once per item in RepeatableGroup
  "retryable": false,                    // false for POST, true for GET
  "timeout_ms": 10000
}
```

- **GET actions** carry data into `sessionContext` for the next step (no `validation_schema` needed)
- **POST actions** must have `validation_schema` pointing to a registered Zod schema
- **`iterate_key`** matches the `id` of a `RepeatableGroup` in the UI schema — the action fires once for each item in the group

---

## Layer 2 — UI Schema JSON

File: `src/modules/client/ai-hub/schemas/ui/<name>_form.json`

Every form is a `Card > Form > [children]` tree.

```jsonc
{
  "id": "my-form-root",
  "type": "Card",
  "properties": {
    "child": {
      "id": "my-form",
      "type": "Form",
      "properties": {
        "action": { "name": "create_patient" },   // must match action.purpose
        "submitLabel": { "literalString": "Save" },
        "gap": "medium",
        "alignment": "stretch",
        "children": [ /* components below */ ]
      }
    }
  }
}
```

See [references/ui-components.md](references/ui-components.md) for the full component catalog.

### Data binding

- **`"$context_key.path"`** — reads from `sessionContext` (e.g. `"$booking_practitioners.data"`)
- **`"literalString"`** — static string value
- **`"literalBoolean"`** — static boolean value
- **`"literalNumber"`** — static number value

---

## Layer 3 — Zod Validation Schema

File: `src/modules/client/ai-hub/schemas/validation/<domain>/<name>.ts`

The schema receives `{ ...sessionContext, ...formData }` — all accumulated context PLUS the current step's form fields. This means fields from previous steps and resolvers are available for validation.

### Helpers used throughout the codebase

```ts
import { z } from "zod";

const toPositiveInt = (v: unknown) => {
  if (v === undefined || v === null) return -1;
  const s = String(v);
  if (s === "" || s === "undefined" || s === "null") return -1;
  const n = Number(s);
  return isNaN(n) ? -1 : Math.floor(n);
};

const toOptionalStr = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s === "" || s === "undefined" || s === "null" ? undefined : s;
};

const toStrArray = (v: unknown) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" || s === "undefined" ? undefined : [s];
};
```

### Schema with transform (for POST payloads)

```ts
export const appointmentCreateSchema = z
  .object({
    // From sessionContext (seeded by route.ts — never entered by user)
    user_id: z.preprocess(toOptionalStr, z.string().optional()),
    org_id:  z.preprocess(toOptionalStr, z.string().optional()),

    // From context_resolver (auto-resolved, not entered by user)
    patient_id: z.preprocess(toPositiveInt, z.number().int().positive("Patient not found")),

    // From step 1 form
    status: z.string().min(1, "Status is required"),

    // List field from a TextField (RepeatableGroup wraps it automatically)
    name_given: z.string().optional().transform(toStrArray),
  })
  .transform((d) => ({
    // Shape that the FHIR server's Pydantic schema expects
    user_id: d.user_id,
    org_id:  d.org_id,
    status:  d.status,
    subject: `Patient/${d.patient_id}`,
    name:    { given: d.name_given },
  }));
```

### Rules

1. Every FHIR top-level resource POST (patient, appointment, encounter) needs `user_id` and `org_id` — add them as `z.preprocess(toOptionalStr, z.string().optional())`
2. Sub-resource POSTs (names, telecom, addresses, etc.) do NOT need `user_id`/`org_id`
3. Use `z.preprocess(toPositiveInt, z.number().int().positive(...))` for any integer IDs — form fields come in as strings
4. Use `.transform()` to reshape the data into the exact payload the FHIR server expects
5. Refer to the Python Pydantic schema at `E:/work/code/fhir/fhir-server/app/schemas/<resource>/input.py` to see the exact field names and types the server requires

---

## Layer 4 — Register the UI Schema

File: `src/modules/client/ai-hub/schemas/ui/index.ts`

```ts
import myForm from "./my_form.json";

export const UI_SCHEMAS: Record<string, unknown> = {
  // ... existing schemas ...
  my_form: myForm,
};
```

The key must exactly match the `ui.schema` value in the workflow JSON step.

---

## Layer 5 — Register the Validation Schema

File: `src/modules/client/ai-hub/schemas/validation/index.ts`

```ts
import { myCreateSchema } from "./domain/my_create_schema";

export const VALIDATION_SCHEMAS: Record<string, ZodSchema> = {
  // ... existing schemas ...
  my_create_schema: myCreateSchema,
};
```

The key must exactly match the `actions[].validation_schema` value in the workflow JSON.

---

## sessionContext — How Data Flows

`sessionContext` starts at the first step seeded with `user_id` and `org_id` from the Better Auth session. Every subsequent step:

1. Resolver outputs are extracted via `context.outputs` dot-notation and merged in
2. The full merged context is returned to the client
3. The client re-sends it with every `/step` and `/submit` call
4. On submit, the server passes `{ ...sessionContext, ...formData }` to the Zod schema

**`context.outputs` dot-notation** — the `field` path traverses nested response objects:
```jsonc
"patient_id": { "field": "me_patient.id" }
// stepData.me_patient.id → sessionContext.patient_id = 10001
```

If `field` is omitted, the entire response object is stored under the output key.

---

## Checklist for a New Workflow

- [ ] Create `workflows/<domain>/<id>.json` — add all steps with `context_resolvers`, `actions`, `ui.schema`
- [ ] For each step, create `schemas/ui/<step>_form.json`
- [ ] For each POST action, create `schemas/validation/<domain>/<schema_name>.ts`
- [ ] Register every UI schema in `schemas/ui/index.ts`
- [ ] Register every validation schema in `schemas/validation/index.ts`
- [ ] Point `route.ts` to the new workflow for testing
- [ ] Verify that every `$var` used in URLs is either in sessionContext, outputs, or resolved by a resolver on that step
- [ ] Verify that every `validation_schema` key matches what's registered in the validation index
- [ ] Verify that `action.purpose` in the workflow matches `Form.action.name` in the UI schema
- [ ] Verify that `iterate_key` (if present) matches the `RepeatableGroup` id in the UI schema

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using `context_resolver` (singular) | Always use `context_resolvers` (plural array) — singular is legacy |
| Hardcoded `MultipleChoice` for coded fields | Fetch terminology via `$fhir_server_url/api/fhir/v1/terminology/concepts?resource=X&field=Y` and use `TerminologySelect` |
| Missing `user_id`/`org_id` in top-level resource schema | Add `z.preprocess(toOptionalStr, z.string().optional())` for both |
| Form field submits `"undefined"` string | Use `toOptionalStr` preprocessor in the Zod schema |
| Integer ID comes in as string from form | Use `toPositiveInt` preprocessor |
| Dot-notation in `context.outputs` field not working | Check `_lib.ts` `extractOutputs` — it handles dot-notation; verify the context_key matches the resolver's `context_key` |
| `iterate_key` not matching | The workflow `iterate_key` value must match the `RepeatableGroup` component's `id` in the UI schema exactly |

---

## Reference Files

- [UI Component Catalog](references/ui-components.md) — every available component with props
- [TerminologySelect valueType patterns](references/ui-components.md#terminologyselect)
- Existing workflow examples:
  - `src/modules/client/ai-hub/workflows/patient/create_patient.json` (10-step, sub-resources)
  - `src/modules/client/ai-hub/workflows/appointment/book_appointment.json` (3-step, auto-resolve patient)
