# a2ui UI Component Catalog

All components available in `DEFAULT_CATALOG`. Use these `type` values in form schema JSON.

---

## Layout Components

### Card
Wraps content in a bordered card. Always the outermost element.
```jsonc
{ "id": "root", "type": "Card", "properties": { "child": { /* single child node */ } } }
```

### Form
The submit container. Must be the direct child of Card.
```jsonc
{
  "id": "my-form",
  "type": "Form",
  "properties": {
    "action":      { "name": "action_purpose_name" },  // matches workflow action.purpose
    "submitLabel": { "literalString": "Save" },
    "gap":         "medium",                            // "small" | "medium" | "large"
    "alignment":   "stretch",                           // "start" | "center" | "stretch"
    "children":    [ /* any component nodes */ ]
  }
}
```

### Row
Horizontal flex row. Children share space by `weight`.
```jsonc
{
  "id": "my-row",
  "type": "Row",
  "properties": {
    "gap":       "medium",
    "alignment": "stretch",
    "children": [
      { "id": "left-field",  "type": "TextField", "weight": 1, "properties": { ... } },
      { "id": "right-field", "type": "TextField", "weight": 2, "properties": { ... } }
    ]
  }
}
```
`weight` is an integer ratio (1 = equal share). Omit for equal widths.

### Divider
Horizontal rule. No meaningful properties.
```jsonc
{ "id": "divider-1", "type": "Divider", "properties": {} }
```

---

## Text Components

### Text
Display-only text. Use `usageHint` to set the visual role.
```jsonc
{
  "id": "title",
  "type": "Text",
  "properties": {
    "text":      { "literalString": "Step 2: Add Names" },
    "usageHint": "h2"   // "h1" | "h2" | "h3" | "h4" | "caption" | "body"
  }
}
```

---

## Input Components

### TextField
Single-line or multi-line text input.
```jsonc
{
  "id": "given_name",
  "type": "TextField",
  "properties": {
    "label":         { "literalString": "Given Name" },
    "placeholder":   { "literalString": "First name" },
    "textFieldType": "shortText"   // "shortText" | "longText" | "number" | "date" | "email" | "url"
  }
}
```
- `shortText` — single line
- `longText` — textarea
- `number` — numeric keyboard
- `date` — date picker (emits YYYY-MM-DD)

### CheckBox
Boolean toggle.
```jsonc
{
  "id": "preferred",
  "type": "CheckBox",
  "properties": {
    "label": { "literalString": "Preferred Language" },
    "value": { "literalBoolean": false }   // default value
  }
}
```

### MultipleChoice
Static dropdown / radio. Use only for non-FHIR enums (e.g. fixed structural types like `Organization|Practitioner|PractitionerRole`). For any HL7-coded field, use TerminologySelect instead.
```jsonc
{
  "id": "reference_type",
  "type": "MultipleChoice",
  "properties": {
    "label":       { "literalString": "Provider Type" },
    "placeholder": { "literalString": "Select type" },
    "items": [
      { "label": { "literalString": "Practitioner" }, "value": "Practitioner" },
      { "label": { "literalString": "Organization" }, "value": "Organization" }
    ]
  }
}
```

---

## FHIR-Specific Components

### TerminologySelect
Searchable select driven by a terminology value set fetched via `context_resolvers`. Always prefer this over `MultipleChoice` for any HL7/FHIR coded field.

**valueType: "code"** — emits a single `{id}` hidden input with the code string.
```jsonc
{
  "id": "status",
  "type": "TerminologySelect",
  "properties": {
    "label":       { "literalString": "Status" },
    "placeholder": { "literalString": "Search status…" },
    "items":       "$appointment_status_concepts.concepts",
    "valueType":   { "literalString": "code" }
  }
}
```

**valueType: "CodeableConcept"** — emits four hidden inputs: `{id}_code`, `{id}_system`, `{id}_display`, `{id}_text`.
```jsonc
{
  "id": "appointment_type",
  "type": "TerminologySelect",
  "properties": {
    "label":       { "literalString": "Appointment Type" },
    "placeholder": { "literalString": "Search type…" },
    "items":       "$appointment_type_concepts.concepts",
    "valueType":   { "literalString": "CodeableConcept" }
  }
}
```
In the Zod schema, CodeableConcept emits four fields named `{id}_code`, `{id}_system`, `{id}_display`, `{id}_text`.

**Terminology endpoint pattern:**
```
$fhir_server_url/api/fhir/v1/terminology/concepts?resource=<Resource>&field=<field>
```
The response shape is `{ concepts: [{ code, display, system, ... }] }`. Use `$context_key.concepts` in the `items` prop.

### DataSelect
Searchable select driven by arbitrary FHIR list data (e.g. practitioner list, slot list). Emits multiple hidden inputs via `emits`.

```jsonc
{
  "id": "practitioner",
  "type": "DataSelect",
  "properties": {
    "label":               { "literalString": "Practitioner" },
    "placeholder":         { "literalString": "Search practitioner…" },
    "items":               "$booking_practitioners.data",
    "labelField":          "display",
    "labelTemplate":       "{display}",
    "descriptionTemplate": "{specialty_display} — {svc_display}",
    "emits": [
      { "key": "practitioner_role_id", "field": "role_id" },
      { "key": "practitioner_ref_id",  "field": "ref_id" },
      { "key": "practitioner_display", "field": "display" }
    ]
  }
}
```

`emits` — each entry writes a hidden input `{key}` with the value of `item[field]`.  
`labelTemplate` / `descriptionTemplate` — use `{fieldPath}` or `{fieldPath | formatter}`.  
Formatters: `time`, `date`, `short_date`, `datetime`.

### SlotPicker
Date carousel + time chip grid for appointment slot selection. Data must be an array of slot objects with `id`, `start`, `end` fields.

```jsonc
{
  "id": "slot",
  "type": "SlotPicker",
  "properties": {
    "label":    { "literalString": "Choose a Time Slot" },
    "items":    "$booking_slots.data",
    "emits": [
      { "key": "slot_id",    "field": "id" },
      { "key": "slot_start", "field": "start" },
      { "key": "slot_end",   "field": "end" }
    ]
  }
}
```
Emits hidden inputs `slot_id`, `slot_start`, `slot_end` into the form.

---

## Group Components

### RepeatableGroup
Dynamic list of repeated field sets. Used for sub-resources (names, telecom, addresses, etc.) and anywhere the user adds multiple items. The workflow action must have `iterate_key` matching this component's `id`.

```jsonc
{
  "id": "names",                          // must match workflow action.iterate_key
  "type": "RepeatableGroup",
  "properties": {
    "addLabel":     { "literalString": "Add Name" },
    "minItems":     { "literalNumber": 1 },
    "defaultCount": { "literalNumber": 1 },
    "template": [
      /* any component nodes — these repeat per item */
      {
        "id": "use",
        "type": "TerminologySelect",
        "properties": {
          "label":     { "literalString": "Use" },
          "items":     "$name_use_concepts.concepts",
          "valueType": { "literalString": "code" }
        }
      },
      {
        "id": "family",
        "type": "TextField",
        "properties": {
          "label":         { "literalString": "Family Name" },
          "textFieldType": "shortText"
        }
      }
    ]
  }
}
```

When the form submits, `RepeatableGroup` produces an array under the `iterate_key`. The workflow engine then calls the action once per item. Each item's Zod schema receives that single item's fields.

---

## Data Binding Quick Reference

| Syntax | Meaning |
|---|---|
| `"$context_key"` | Full value of sessionContext[context_key] |
| `"$context_key.path"` | Nested path: sessionContext.context_key.path |
| `"$context_key.concepts"` | TerminologySelect items array |
| `"$context_key.data"` | DataSelect / SlotPicker items array |
| `{ "literalString": "..." }` | Static string |
| `{ "literalBoolean": true }` | Static boolean |
| `{ "literalNumber": 1 }` | Static number |

---

## Component → Hidden Input Mapping

| Component | valueType | Emitted inputs |
|---|---|---|
| TextField | — | `{id}` = typed string |
| CheckBox | — | `{id}` = "true" or "false" |
| MultipleChoice | — | `{id}` = selected value string |
| TerminologySelect | `code` | `{id}` = code string |
| TerminologySelect | `CodeableConcept` | `{id}_code`, `{id}_system`, `{id}_display`, `{id}_text` |
| DataSelect | — | one input per `emits` entry: `{emits[n].key}` |
| SlotPicker | — | one input per `emits` entry: `{emits[n].key}` |
| RepeatableGroup | — | array of items collected under `iterate_key` |
