import { create } from "zustand";
import type { AnyComponentNode } from "../a2ui/types";

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
    workflow: string | null;
    step: string | null;
    contextAtStep: Record<string, unknown>;
  };
}

/** Serializable conversation state for DB persistence */
export interface SerializableConversation {
  messages: ChatMessage[];
  sessionContext: Record<string, unknown>;
  activeWorkflow: string | null;
  currentStep: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  loading: boolean;

  // Workflow session state
  sessionContext: Record<string, unknown>;
  activeWorkflow: string | null;
  currentStep: string | null;

  // Message actions
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setInput: (input: string) => void;
  setLoading: (loading: boolean) => void;

  // Workflow actions
  mergeContext: (data: Record<string, unknown>) => void;
  setWorkflow: (workflow: string | null, step: string | null) => void;
  clearSession: () => void;

  // Persistence
  getSerializableState: () => SerializableConversation;
  loadState: (state: SerializableConversation) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: "",
  loading: false,
  sessionContext: {},
  activeWorkflow: null,
  currentStep: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    })),

  setInput: (input) => set({ input }),

  setLoading: (loading) => set({ loading }),

  mergeContext: (data) =>
    set((state) => ({
      sessionContext: { ...state.sessionContext, ...data },
    })),

  setWorkflow: (workflow, step) =>
    set({ activeWorkflow: workflow, currentStep: step }),

  clearSession: () =>
    set({ sessionContext: {}, activeWorkflow: null, currentStep: null }),

  getSerializableState: () => {
    const { messages, sessionContext, activeWorkflow, currentStep } = get();
    return { messages, sessionContext, activeWorkflow, currentStep };
  },

  loadState: (state) =>
    set({
      messages: state.messages,
      sessionContext: state.sessionContext,
      activeWorkflow: state.activeWorkflow,
      currentStep: state.currentStep,
    }),
}));
