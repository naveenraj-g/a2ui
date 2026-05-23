# A2UI — Client-Side Architecture

The client side transforms declarative JSON workflow definitions into interactive React UIs. The key idea is **schema-driven rendering**: forms and views are never hardcoded — they are described as JSON component trees that are resolved against FHIR data and rendered dynamically.

---

## High-Level Flow

```
User types message
  → A2UIChat sends POST /api/workflow
  → Server returns { workflow, step, stepData, sessionContext }
  → mapDataToUI merges stepData into the UI schema (resolves $variables)
  → Renderer walks the resolved component tree
  → Each component renders via its catalog entry
  → User fills form → Form dispatches action
  → A2UIChat intercepts dispatch, calls POST /api/workflow/submit
  → On success, calls POST /api/workflow/step for the next step
  → Repeat until workflow completion
```

---

## 1. Chat Store — `chat-store.ts`

**File:** `src/modules/client/ai-hub/store/chat-store.ts`

A **Zustand** store that holds all persistent chat state. It survives re-renders and is the single source of truth for the active workflow.

### Key state

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `ChatMessage[]` | All chat messages (user + assistant) |
| `activeWorkflow` | `WorkflowDefinition \| null` | The full workflow currently in progress |
| `currentStepIndex` | `number \| null` | Which step the user is on |
| `sessionContext` | `Record<string, unknown>` | Accumulated key-value data across steps (e.g. `patient_id`) |

### Key actions

| Action | What it does |
|--------|-------------|
| `addMessage(msg)` | Appends a message to the chat |
| `updateMessage(id, updates)` | Patches a message in place (e.g. updates a `toolCall` from pending → success) |
| `mergeContext(data)` | Shallow-merges new key-value pairs into `sessionContext` |
| `setWorkflow(workflow, stepIndex)` | Sets the active workflow and current step |
| `clearSession()` | Resets `sessionContext`, `activeWorkflow`, `currentStepIndex` (called on workflow completion) |

### `ChatMessage` shape

```ts
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;                    // plain-text bubble
  ui?: AnyComponentNode | null;     // rendered A2UI component tree
  toolCall?: ToolCallInfo;          // form submission status card
  workflowSnapshot?: {
    workflowId: string;
    stepIndex: number;
    stepId: string;
    contextAtStep: Record<string, unknown>;
  };
}
```

Each message can carry either plain `text`, a `ui` component tree (rendered by `<Renderer>`), or a `toolCall` status card.

---

## 2. A2UIChat — the Orchestrator

**File:** `src/modules/client/ai-hub/components/A2UIChat.tsx`

The main React component. It owns the message loop and coordinates all workflow transitions.

### `handleSend` — starting a workflow

```
user types "register patient" → handleSend()
  POST /api/workflow { message, sessionContext }
  ← { type:"workflow_step", workflow, step, stepData, sessionContext }

  if workflow.introduction → addMessage(buildMarkdownNode(introduction))
  if step.step_type === "context" → skip UI, auto-advance to next step
  else:
    uiSchema = UI_SCHEMA_REGISTRY[step.ui.schema]
    parsedUi  = buildUiFromData(uiSchema, { ...stepData, ...sessionContext })
    addMessage({ ui: parsedUi })
    setWorkflow(workflow, stepIndex)
```

### `loadWorkflowStep` — advancing to a step

Called after a submit succeeds or when a step is skipped. Posts the full workflow + target index to `/api/workflow/step`, which runs context resolvers server-side and returns fresh data.

```
POST /api/workflow/step { workflow, stepIndex, sessionContext }
← { step, stepData, sessionContext }

mergeContext(sessionContext)
if step_type === "context" → auto-advance again (silent step)
else → addMessage({ ui: buildUiFromData(uiSchema, stepData + sessionContext) })
```

### `handleDispatch` — form submission event listener

A2UI forms fire a custom DOM `"dispatch"` event on the shared `processor` object when submitted. `A2UIChat` listens for this via `processor.addEventListener("dispatch", ...)`.

```
Form submitted
  → processor.dispatch(message)
  → "dispatch" event fires
  → handleDispatch reads fresh store state (not closure — avoids stale captures)
  → POST /api/workflow/submit { workflow, stepIndex, actionName, formData, sessionContext }
  ← { success, data, nextStepIndex, sessionContext }

  updateMessage(toolMsgId, { toolCall: { status:"success" } })
  mergeContext(sessionContext)
  loadWorkflowStep(workflow, nextStepIndex, ...)
```

> **Why read from `useChatStore.getState()` instead of closure?**
> The form was rendered in a previous render cycle. If `handleDispatch` captured
> `activeWorkflow` from its enclosing scope it would be stale. Reading directly
> from the store guarantees the latest values.

### `skipCurrentStep`

For `optional: true` steps, the "Skip this step" button calls `skipCurrentStep()`, which adds a skip notification message and jumps to the next step without calling `/api/workflow/submit`.

### `buildUiFromData(ui, stepData)`

```ts
function buildUiFromData(ui, stepData): AnyComponentNode | null {
  return parseUI(JSON.stringify({ ui, data: stepData ?? null }));
}
```

This wraps the raw schema + data into the format expected by `parseUI`, which calls `mapDataToUI`.

---

## 3. UI Schema Registry

**File:** `src/modules/client/ai-hub/schemas/ui/index.ts`

Maps `step.ui.schema` strings to component tree JSON objects:

```ts
export const UI_SCHEMA_REGISTRY = {
  patient_create_form:    patientCreateForm,
  patient_identifier_form: patientIdentifierForm,
  patient_telecom_form:   patientTelecomForm,
  patient_address_form:   patientAddressForm,
  vitals_dashboard:       vitalsDashboard,
  vitals_table:           vitalsTable,
};
```

The raw JSON files live in `src/modules/client/ai-hub/schemas/ui/*.json`.

---

## 4. Data Mapping — `mapDataToUI`

**File:** `src/modules/client/ai-hub/utils/mapUiSchemaDataV3.ts`

This is the heart of the schema-driven rendering system. It walks a UI schema JSON tree and replaces `$variable` references with real values from `stepData`.

### `mapDataToUI(ui, data)`

Recursively processes every node in the schema:

- **String `"$variable"`** → resolved to `data.variable` via `getValue(data, path)`
- **String `"$a.b.c"`** → resolved to `data.a.b.c` (dot notation)
- **String `"$items | currency"`** → resolved then formatted
- **`{ $transform: { from: "$path", type: "...", ... } }`** → runs a transform pipeline (see below)
- **`{ forEach, item, component }`** → expands an array into repeated component instances
- **Arrays** → each element is recursively resolved
- **Objects** → each value is recursively resolved
- **Primitives** (number, boolean, null) → returned as-is

### Example

```json
// UI schema (raw)
{ "text": "$patient.name" }

// stepData
{ "patient": { "name": "John Doe" } }

// After mapDataToUI
{ "text": "John Doe" }
```

### Terminology select example

```json
// Schema
{ "items": "$gender_concepts.concepts" }

// stepData
{ "gender_concepts": { "concepts": [{ "code": "male", "display": "Male" }, ...] } }

// After mapDataToUI — items becomes the actual array
{ "items": [{ "code": "male", "display": "Male" }, ...] }
```

This resolved array is then received directly by the `TerminologySelect` component as `component.properties.items`.

### `parseUI(input)`

Top-level entry point called by `buildUiFromData`. Accepts `JSON.stringify({ ui, data })`:

```ts
// POST case (create form — no pre-filled data)
if (ui && !data) return ui;

// GET/view case (pre-filled form or view — data resolved into schema)
if (ui && data) return mapDataToUI(ui, data);
```

---

## 5. Transform Engine — `transform.ts`

**File:** `src/modules/client/ai-hub/utils/transform.ts`

A declarative data-pipeline engine consumed inside `mapDataToUI` via the `$transform` directive. Used mainly for chart data preparation.

### Available transforms

| Type | Description |
|------|-------------|
| `map` | Rename/pick/format fields from each record |
| `pivot` | Turn one record's fields into `[{ label, value }]` (for pie charts) |
| `aggregate` | Collapse array to a single record (sum, avg, min, max, count, first, last) |
| `slice` | Sort and/or limit an array |
| `filter` | Keep only records matching a condition |
| `extract` | Pull a single scalar value from the array |
| `chain` | Apply multiple transforms in sequence |

### Example in a UI schema

```json
{
  "$transform": {
    "from": "$vitals.data",
    "type": "chain",
    "steps": [
      { "type": "filter", "field": "heart_rate", "op": "notNull" },
      { "type": "slice",  "sort": "date", "order": "asc", "limit": 30 },
      { "type": "map",    "fields": { "label": "date", "hr": "heart_rate" } }
    ]
  }
}
```

`mapDataToUI` detects the `$transform` key, resolves `from` to the raw data, and runs `applyTransform(data, spec)`.

---

## 6. Message Processor — `processor.ts`

**File:** `src/modules/client/ai-hub/a2ui/rendering/processor.ts`

A lightweight in-memory event bus and data store. **One instance is created per chat session** and shared across all step renders.

### What it does

- Holds per-surface **data models** (key-value stores for server-driven component state — used by the legacy server-push rendering mode, not by the workflow system).
- Provides `dispatch(message)` — called by form components when the user submits. Returns a Promise resolved by whoever holds the event listener (i.e. `A2UIChat`).
- Provides `addEventListener / removeEventListener` — `A2UIChat` registers a `"dispatch"` listener to intercept form submissions.

### The dispatch bridge

```
Form component
  → useDynamicComponent.sendAction(action)
  → processor.dispatch(message)            // returns Promise
  ↓
processor emits "dispatch" event with { message, resolve }
  ↓
A2UIChat handleDispatch listener fires
  → calls /api/workflow/submit
  → calls resolve([]) to settle the Promise
  ↓
Form component's await sendAction() resolves
```

This bridge lets the `Form` component be fully decoupled from the workflow routing logic. It only knows how to fire an action — `A2UIChat` decides what to do with it.

---

## 7. `useDynamicComponent` Hook

**File:** `src/modules/client/ai-hub/a2ui/hooks/use-dynamic-component.ts`

Used by every catalog component. Returns two key utilities:

### `resolvePrimitive(value)`

Resolves a schema property value to a plain JS value:

```ts
resolvePrimitive({ literalString: "Gender" })  → "Gender"
resolvePrimitive({ literalBoolean: true })      → true
resolvePrimitive({ path: "some/path" })         → processor.getData(component, path, surfaceId)
resolvePrimitive([item1, item2])                → [resolvePrimitive(item1), ...]
resolvePrimitive("already a string")            → "already a string"
```

For workflow-driven forms, most values arrive already resolved by `mapDataToUI` (the `$variable` → real value transformation happens before the component tree is created). `resolvePrimitive` handles the `{ literalString, literalBoolean, ... }` wrapper objects that the schema uses for static values.

### `sendAction(action)`

Serialises an action and its context, then calls `processor.dispatch(message)`. This fires the `"dispatch"` event that `A2UIChat` listens for.

---

## 8. Component Catalog

**File:** `src/modules/client/ai-hub/a2ui/rendering/catalog.ts`

Maps component type strings (from the JSON schema) to React components:

```ts
export const DEFAULT_CATALOG = {
  Text:             { component: Text },
  TextField:        { component: TextField },
  MultipleChoice:   { component: MultipleChoice },
  TerminologySelect:{ component: TerminologySelect },
  CheckBox:         { component: Checkbox },
  DateTimeInput:    { component: DateTimeInput },
  Form:             { component: Form },
  Row:              { component: Row },
  Card:             { component: Card },
  BarChart:         { component: BarChart },
  DataTable:        { component: DataTable },
  // ... 30+ components
};
```

---

## 9. Renderer

**File:** `src/modules/client/ai-hub/a2ui/rendering/renderer.tsx`

A thin router that looks up a component type in `DEFAULT_CATALOG` and renders it:

```tsx
export function Renderer({ processor, surfaceId, component, weight }) {
  const config = DEFAULT_CATALOG[component.type];
  if (!config) return null;
  const Component = config.component;
  return <Component processor={processor} surfaceId={surfaceId} component={component} weight={weight} />;
}
```

Container components (`Row`, `Card`, `Form`) recursively call `<Renderer>` for each child, so the entire tree is rendered with a single top-level `<Renderer>` call.

---

## 10. Form Component — `form.tsx`

**File:** `src/modules/client/ai-hub/a2ui/catalog/form.tsx`

### `collectFormData()`

Queries all `input`, `textarea`, and `select` elements inside the form by their `id`. This is how field values reach the submit payload:

```ts
const inputs = formRef.current.querySelectorAll("input, textarea, select");
inputs.forEach((el) => {
  if (!el.id) return;
  formData[el.id] = el.type === "checkbox" ? el.checked : el.value;
});
```

Every catalog input component renders a hidden `<input id={component.id} type="hidden" value={...} />` (or just a native input) so `collectFormData` picks it up by the component's schema `id`.

### Submit flow

```
User clicks submit
  → collectFormData() → { gender: "male", given_name: "John", ... }
  → sendAction({
      name: "create_patient",
      context: [{ key: "formData", value: { literalString: JSON.stringify(formData) } }]
    })
  → processor.dispatch(message)
  → A2UIChat handleDispatch fires
  → POST /api/workflow/submit
```

---

## 11. `TerminologySelect` Component

**File:** `src/modules/client/ai-hub/a2ui/catalog/terminology-select.tsx`

A Combobox built on Shadcn's `Command` + `Popover` for selecting FHIR-coded values. Replaces static `MultipleChoice` when options come from a terminology API.

### How options reach the component

1. Server runs `context_resolvers` for the step → fetches value set from FHIR terminology API.
2. Result stored in `stepData` under `context_key` (e.g. `gender_concepts`).
3. `buildUiFromData` calls `mapDataToUI(schema, stepData)`.
4. `mapDataToUI` resolves `"$gender_concepts.concepts"` → actual array of concept objects.
5. `component.properties.items` is the resolved array when the component renders.

### Search behaviour

- **Client-side (default):** Filters the pre-loaded `items` array in real time on `display`, `code`, and `definition`.
- **Server-side (when `serverSearch` is configured):** Debounces 300 ms, fires after ≥ 2 characters, calls `GET /api/workflow/terminology?resource=...&field=...&query=...`. For medical code systems (SNOMED, LOINC, ICD-10) where the value set is too large to pre-fetch.

### Option display

Each dropdown item shows two lines:
```
Married                      ← concept.display (bold)
A current marriage contract  ← concept.definition (muted, clipped)     M
                             ← concept.code shown right-aligned (mono)
```

### Hidden inputs by `valueType`

**`"code"` (simple FHIR code — e.g. gender):**
```html
<input id="gender" type="hidden" value="male" />
```

**`"CodeableConcept"` (FHIR CodeableConcept — e.g. marital status):**

The FHIR server API accepts CodeableConcept as four flat fields. The component derives field names from its own `id`:

```html
<input id="marital_status_code"    type="hidden" value="M" />
<input id="marital_status_system"  type="hidden" value="http://terminology.hl7.org/..." />
<input id="marital_status_display" type="hidden" value="Married" />
<input id="marital_status_text"    type="hidden" value="Married" />
```

`form.tsx`'s `collectFormData` picks up all four and sends them as flat keys — which map 1-to-1 onto `PatientCreateSchema`'s fields.

---

## 12. Component Types — `types/index.ts`

**File:** `src/modules/client/ai-hub/a2ui/types/index.ts`

Defines TypeScript interfaces for every component node. Each node has:

```ts
interface BaseComponentNode {
  id: string;            // used as HTML input id for form collection
  weight?: number;       // flex grow factor inside Row/Column
  type: string;          // matches a key in DEFAULT_CATALOG
  properties: {...};     // component-specific config
}
```

The `AnyComponentNode` union lists every concrete node type, ensuring the renderer and all catalog components are fully typed.

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Server                                                         │
│                                                                 │
│  /api/workflow                                                  │
│    runContextResolvers() ─────────────────┐                    │
│      GET /terminology/concepts?...         │ parallel           │
│      GET /terminology/concepts?...  ───────┘                   │
│    stepData = { gender_concepts, marital_status_concepts }      │
│    sessionContext merged with extractOutputs()                  │
│    → { workflow, step, stepData, sessionContext }               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP response
┌──────────────────────────▼──────────────────────────────────────┐
│  A2UIChat.handleSend()                                          │
│                                                                 │
│  buildUiFromData(uiSchema, { ...stepData, ...sessionContext })  │
│    parseUI → mapDataToUI(schema, data)                          │
│      "$gender_concepts.concepts" → [{ code, display, ... }]    │
│      "$marital_status_concepts.concepts" → [...]                │
│      → fully resolved AnyComponentNode tree                     │
│                                                                 │
│  addMessage({ ui: resolvedTree })                               │
│  setWorkflow(workflow, stepIndex)                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Renderer → DEFAULT_CATALOG lookup → React component            │
│                                                                 │
│  TerminologySelect                                              │
│    items = component.properties.items  (already resolved array) │
│    User picks "Male"                                            │
│    selected = { code:"male", display:"Male", system:"..." }     │
│    <input id="gender" type="hidden" value="male" />             │
│                                                                 │
│  Form.collectFormData()                                         │
│    { given_name:"John", gender:"male",                          │
│      marital_status_code:"M", marital_status_system:"...", ...} │
│                                                                 │
│  sendAction("create_patient", formData)                         │
│  → processor.dispatch()                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ "dispatch" event
┌──────────────────────────▼──────────────────────────────────────┐
│  A2UIChat.handleDispatch()                                      │
│                                                                 │
│  POST /api/workflow/submit                                      │
│    ← { success:true, nextStepIndex:1, sessionContext:{id:42} }  │
│                                                                 │
│  mergeContext({ patient_id: 42 })                               │
│  loadWorkflowStep(workflow, 1, ctx)                             │
│    POST /api/workflow/step { stepIndex:1, sessionContext }       │
│    ← { step, stepData, sessionContext }                          │
│    addMessage({ ui: nextStepForm })                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## `step_type: "context"` — Silent Steps

Steps with `step_type: "context"` never render any UI. They run their `context_resolver`, update `sessionContext`, then immediately auto-advance to the next step. Used for resolving data needed by later form steps (e.g. fetching the current patient before showing the vitals step).

Both `A2UIChat.handleSend` and `loadWorkflowStep` check for this type and recurse:

```ts
if (step.step_type === "context") {
  const nextIndex = stepIndex + 1 < steps.length ? stepIndex + 1 : null;
  if (nextIndex !== null) {
    setWorkflow(workflow, nextIndex);
    await loadWorkflowStep(workflow, nextIndex, data.sessionContext ?? ctx);
  }
  return; // no UI added
}
```
