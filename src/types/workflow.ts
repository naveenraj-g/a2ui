export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  tags?: string[];
  llm_hints?: {
    intent_examples?: string[];
    when_to_use?: string[];
    when_not_to_use?: string[];
    required_context?: string[];
  };
  execution?: {
    mode: string;
    orchestrator: string;
    retryable?: boolean;
    audit_enabled: boolean;
  };
  introduction?: string;
  completion?: {
    message: string;
    action?: "dismiss";
  };
  workflow_steps: WorkflowStepDefinition[];
}

export interface ContextResolverDef {
  description?: string;
  context_key?: string;
  tool_name: string;
  url: string;
  method: "GET" | "POST";
  timeout_ms?: number;
}

export interface WorkflowStepDefinition {
  sequence_number: number;
  id: string;
  name: string;
  step_type: "form" | "view" | "confirm" | "context";
  optional?: boolean;
  description: string;
  context?: {
    inputs: Record<string, StepContextInput>;
    outputs: Record<string, StepContextOutput>;
  };
  /** Single resolver — kept for backward compatibility. */
  context_resolver?: ContextResolverDef;
  /** Multiple resolvers executed in parallel; results are merged into stepData. */
  context_resolvers?: ContextResolverDef[];
  ui?: {
    schema: string;
    mode?: "create" | "edit" | "view" | "append";
    prefill?: boolean;
    editable?: boolean;
    submit_label?: string;
  };
  actions?: WorkflowAction[];
}

export interface StepContextInput {
  type: string;
  resource?: string;
  source?: string;
}

export interface StepContextOutput {
  type: string;
  resource?: string;
  field?: string;
}

export interface WorkflowAction {
  type: "http";
  purpose: string;
  tool_name: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  validation_schema?: string;
  iterate_key?: string;
  retryable: boolean;
  timeout_ms?: number;
}
