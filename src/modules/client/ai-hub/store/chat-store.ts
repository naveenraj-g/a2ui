import { create } from "zustand";
import type { AnyComponentNode } from "../a2ui/types";
import type { WorkflowDefinition } from "@/types/workflow";

export interface ToolCallInfo {
  toolName: string;
  formData: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "success" | "error";
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  ui?: AnyComponentNode | null;
  toolCall?: ToolCallInfo;
  workflowSnapshot?: {
    workflowId: string;
    stepIndex: number;
    stepId: string;
    contextAtStep: Record<string, unknown>;
  };
}

export interface SerializableConversation {
  messages: ChatMessage[];
  sessionContext: Record<string, unknown>;
  activeWorkflow: WorkflowDefinition | null;
  currentStepIndex: number | null;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  loading: boolean;

  sessionContext: Record<string, unknown>;
  activeWorkflow: WorkflowDefinition | null;
  currentStepIndex: number | null;

  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setInput: (input: string) => void;
  setLoading: (loading: boolean) => void;

  mergeContext: (data: Record<string, unknown>) => void;
  setWorkflow: (workflow: WorkflowDefinition | null, stepIndex: number | null) => void;
  clearSession: () => void;

  getSerializableState: () => SerializableConversation;
  loadState: (state: SerializableConversation) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: "",
  loading: false,
  sessionContext: {},
  activeWorkflow: null,
  currentStepIndex: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  setInput: (input) => set({ input }),
  setLoading: (loading) => set({ loading }),

  mergeContext: (data) =>
    set((state) => ({ sessionContext: { ...state.sessionContext, ...data } })),

  setWorkflow: (workflow, stepIndex) => set({ activeWorkflow: workflow, currentStepIndex: stepIndex }),

  clearSession: () => set({ sessionContext: {}, activeWorkflow: null, currentStepIndex: null }),

  getSerializableState: () => {
    const { messages, sessionContext, activeWorkflow, currentStepIndex } = get();
    return { messages, sessionContext, activeWorkflow, currentStepIndex };
  },

  loadState: (state) =>
    set({
      messages: state.messages,
      sessionContext: state.sessionContext,
      activeWorkflow: state.activeWorkflow,
      currentStepIndex: state.currentStepIndex,
    }),
}));
