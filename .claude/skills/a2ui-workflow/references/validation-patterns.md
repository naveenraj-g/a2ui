# Zod Validation Schema Patterns

## Standard Preprocessors

Always import these helpers at the top of every schema file. They handle the `"undefined"` string problem (form fields emit the literal string "undefined" when empty via DataSelect/TerminologySelect).

```ts
/** Coerce to positive int; returns -1 when absent/invalid so z.positive() rejects it. */
const toPositiveInt = (v: unknown) => {
  if (v === undefined || v === null) return -1;
  const s = String(v);
  if (s === "" || s === "undefined" || s === "null") return -1;
  const n = Number(s);
  return isNaN(n) ? -1 : Math.floor(n);
};

/** Coerce to string; returns undefined when absent or the literal "undefined"/"null". */
const toOptionalStr = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s === "" || s === "undefined" || s === "null" ? undefined : s;
};

/** Wrap a single TextField string in an array (for FHIR List<string> fields). */
const toStrArray = (v: unknown) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" || s === "undefined" ? undefined : [s];
};

/** Coerce to optional int (no negative fallback — returns undefined instead). */
const toOptionalInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  if (s === "" || s === "undefined" || s === "null") return undefined;
  const n = Number(s);
  return isNaN(n) ? undefined : Math.floor(n);
};
```

---

## Schema Anatomy

```ts
export const mySchema = z
  .object({
    // ── Identity (seeded from Better Auth session — ONLY for top-level resource POSTs) ──
    user_id: z.preprocess(toOptionalStr, z.string().optional()),
    org_id:  z.preprocess(toOptionalStr, z.string().optional()),

    // ── From sessionContext (previous steps / resolvers — not from form inputs) ──
    patient_id: z.preprocess(
      toPositiveInt,
      z.number().int().positive("Patient not found — cannot proceed"),
    ),

    // ── From current step's form fields ──
    status: z.string().min(1, "Status is required"),

    // Optional string (TerminologySelect code or TextField)
    description: z.preprocess(toOptionalStr, z.string().optional()),

    // CodeableConcept from TerminologySelect (valueType: "CodeableConcept")
    // TerminologySelect with id="appointment_type" emits four inputs:
    appointment_type_code:    z.preprocess(toOptionalStr, z.string().optional()),
    appointment_type_system:  z.preprocess(toOptionalStr, z.string().optional()),
    appointment_type_display: z.preprocess(toOptionalStr, z.string().optional()),
    appointment_type_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // Required integer reference (from a previous step's emitted hidden input)
    slot_id: z.preprocess(
      toPositiveInt,
      z.number().int().positive("Please select a time slot"),
    ),

    // Optional integer reference
    encounter_id: z.preprocess(
      toOptionalInt,
      z.number().int().positive().optional(),
    ),

    // List field — TextField → wrapped into array by toStrArray
    name_given: z.string().optional().transform(toStrArray),
  })
  .transform((d) => ({
    // Reshape into the exact payload the FHIR server Pydantic schema expects.
    // Check E:/work/code/fhir/fhir-server/app/schemas/<resource>/input.py
    user_id: d.user_id,
    org_id:  d.org_id,
    status:  d.status,
    subject: `Patient/${d.patient_id}`,
    slot: [{ reference: `Slot/${d.slot_id}` }],
    appointment_type_code:    d.appointment_type_code || undefined,
    appointment_type_system:  d.appointment_type_system || undefined,
    appointment_type_display: d.appointment_type_display || undefined,
    appointment_type_text:    d.appointment_type_text || undefined,
    description: d.description || undefined,
  }));
```

---

## Sub-Resource Schemas (no user_id/org_id)

Sub-resource endpoints (names, telecom, addresses, contacts, communications, GPs, links, photos) do NOT take `user_id`/`org_id`. Keep these schemas lean:

```ts
export const nameCreateSchema = z.object({
  use:    z.enum(["usual", "official", "temp", "nickname", "anonymous", "old", "maiden"]).optional(),
  family: z.string().optional(),
  given:  z.string().optional().transform(toStrArray),
  prefix: z.string().optional().transform(toStrArray),
  suffix: z.string().optional().transform(toStrArray),
});

export const communicationCreateSchema = z.object({
  language_code:    z.string().min(2, "Language code is required"),
  language_system:  z.string().optional(),
  language_display: z.string().optional(),
  language_text:    z.string().optional(),
  preferred:        z.boolean().optional(),
});
```

---

## Iterate-Key Schemas (RepeatableGroup)

When the workflow uses `iterate_key`, the action fires once per group item. The Zod schema receives a SINGLE item (not the array). The submit route extracts items from the group, runs the schema per-item.

```ts
// Each item from the "names" RepeatableGroup
export const nameCreateSchema = z.object({ ... }); // single name, not array
```

---

## TerminologySelect Emit → Schema Field Mapping

| valueType | Emitted inputs | Schema fields |
|---|---|---|
| `code` | `{id}` | `{id}: z.string().optional()` |
| `CodeableConcept` | `{id}_code`, `{id}_system`, `{id}_display`, `{id}_text` | four `toOptionalStr` fields |

```ts
// TerminologySelect id="marital_status", valueType="CodeableConcept"
marital_status_code:    z.preprocess(toOptionalStr, z.string().optional()),
marital_status_system:  z.preprocess(toOptionalStr, z.string().optional()),
marital_status_display: z.preprocess(toOptionalStr, z.string().optional()),
marital_status_text:    z.preprocess(toOptionalStr, z.string().optional()),
```

---

## DataSelect Emit → Schema Field Mapping

DataSelect with `emits` writes one hidden input per emit entry. Each becomes a schema field:

```jsonc
// UI schema emits:
"emits": [
  { "key": "practitioner_role_id", "field": "role_id" },
  { "key": "practitioner_ref_id",  "field": "ref_id" },
  { "key": "practitioner_display", "field": "display" }
]
```

```ts
// Validation schema receives:
practitioner_role_id: z.preprocess(toPositiveInt, z.number().int().positive("Select a practitioner")),
practitioner_ref_id:  z.preprocess(toPositiveInt, z.number().int().positive()),
practitioner_display: z.preprocess(toOptionalStr, z.string().optional()),
```

---

## Checking the FHIR Server Schema

Always open the corresponding Pydantic input schema before writing the transform:

```
E:/work/code/fhir/fhir-server/app/schemas/<resource>/input.py
```

Key resources:
- `patient/input.py` — PatientCreateSchema, NameCreate, TelecomCreate, AddressCreate, ContactCreate, CommunicationCreate, GeneralPractitionerCreate, LinkCreate, PhotoCreate
- `appointment/input.py` — AppointmentCreateSchema
- `encounter/input.py` — EncounterCreateSchema

The Pydantic field names are exactly what the transform output must use.
