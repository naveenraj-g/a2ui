"use client";

import { useRef, useEffect, useCallback } from "react";
import { createMessageProcessor } from "../a2ui/rendering/processor";
import { Renderer } from "../a2ui/rendering/renderer";
import type { AnyComponentNode } from "../a2ui/types";
import { parseUI } from "../utils/mapUiSchemaDataV3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Bot, User } from "lucide-react";
import { useChatStore } from "../store/chat-store";
import { ToolCallDetails } from "./ToolCallDetails";

const processor = createMessageProcessor();

export default function A2UIChatPage() {
  const {
    messages,
    input,
    loading,
    addMessage,
    updateMessage,
    setInput,
    setLoading,
    sessionContext,
    activeWorkflow,
    currentStep,
    mergeContext,
    setWorkflow,
    clearSession,
  } = useChatStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWorkflowResponse = useCallback(
    (data: any) => {
      if (data.workflow) {
        const wf = data.workflow;
        if (wf.sessionContext) mergeContext(wf.sessionContext);
        if (wf.nextStep) setWorkflow(wf.name, wf.nextStep);
        else clearSession();
      }
    },
    [mergeContext, setWorkflow, clearSession],
  );

  useEffect(() => {
    const handleDispatch = async (event: Event) => {
      const { message, resolve } = (event as CustomEvent).detail;
      const actionName = message.userAction.name;
      const context = message.userAction.context ?? {};

      const formData: Record<string, unknown> = {};
      if (typeof context === "object") {
        for (const [key, val] of Object.entries(context)) {
          formData[key] = val;
        }
      }

      const currentSessionContext = useChatStore.getState().sessionContext;
      const currentWorkflow = useChatStore.getState().activeWorkflow;
      const currentStepVal = useChatStore.getState().currentStep;
      mergeContext(formData);

      const toolMsgId = crypto.randomUUID();
      addMessage({
        id: toolMsgId,
        role: "assistant",
        toolCall: {
          toolName: actionName,
          formData,
          status: "pending",
        },
        workflowSnapshot: {
          workflow: currentWorkflow,
          step: currentStepVal,
          contextAtStep: { ...currentSessionContext, ...formData },
        },
      });

      try {
        const res = await fetch("/api/a2ui-chat/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionName,
            context: formData,
            activeWorkflow: currentWorkflow,
            currentStep: currentStepVal,
            sessionContext: { ...currentSessionContext, ...formData },
          }),
        });

        const data = await res.json();

        if (data.success) {
          updateMessage(toolMsgId, {
            toolCall: { toolName: actionName, formData, result: data.data, status: "success" },
          });
          handleWorkflowResponse(data);
          if (data.workflow?.nextStep) {
            await triggerWorkflowStep(
              data.workflow.name,
              data.workflow.nextStep,
              data.workflow.sessionContext ?? {},
            );
          }
        } else {
          updateMessage(toolMsgId, {
            toolCall: {
              toolName: actionName,
              formData,
              status: "error",
              error: data.error || "Tool execution failed",
            },
          });
        }
      } catch (err) {
        updateMessage(toolMsgId, {
          toolCall: {
            toolName: actionName,
            formData,
            status: "error",
            error: err instanceof Error ? err.message : "Network error",
          },
        });
      }

      resolve([]);
    };

    processor.addEventListener("dispatch", handleDispatch);
    return () => processor.removeEventListener("dispatch", handleDispatch);
  }, [addMessage, updateMessage, mergeContext, handleWorkflowResponse]);

  const triggerWorkflowStep = useCallback(
    async (workflowName: string, stepId: string, ctx: Record<string, unknown>) => {
      setLoading(true);
      try {
        const res = await fetch("/api/a2ui-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: workflowName, step: stepId, sessionContext: ctx }),
        });

        const data = await res.json();

        const aiMsg: {
          id: string;
          role: "assistant";
          text?: string;
          ui?: AnyComponentNode | null;
          workflowSnapshot?: { workflow: string | null; step: string | null; contextAtStep: Record<string, unknown> };
        } = {
          id: crypto.randomUUID(),
          role: "assistant",
          workflowSnapshot: { workflow: workflowName, step: stepId, contextAtStep: ctx },
        };

        if (data.type === "ui") {
          aiMsg.ui = parseUI(JSON.stringify({ ui: data.ui, data: data.data ?? null }));
        } else if (data.type === "error") {
          aiMsg.text = `⚠️ ${data.message}`;
        } else {
          aiMsg.text = data.message || JSON.stringify(data);
        }

        addMessage(aiMsg);
        handleWorkflowResponse(data);
      } catch (err) {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          text: `⚠️ Workflow error: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [addMessage, setLoading, handleWorkflowResponse],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    addMessage({ id: crypto.randomUUID(), role: "user", text });
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/a2ui-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionContext, workflow: activeWorkflow, step: currentStep }),
      });

      const data = await res.json();

      const aiMsg: {
        id: string;
        role: "assistant";
        text?: string;
        ui?: AnyComponentNode | null;
        workflowSnapshot?: { workflow: string | null; step: string | null; contextAtStep: Record<string, unknown> };
      } = { id: crypto.randomUUID(), role: "assistant" };

      switch (data.type) {
        case "ui":
          aiMsg.ui = parseUI(JSON.stringify({ ui: data.ui, data: data.data ?? null }));
          break;
        case "text":
        case "fallback":
          aiMsg.text = data.message;
          break;
        case "error":
          aiMsg.text = `⚠️ ${data.message}`;
          break;
        default:
          aiMsg.text = JSON.stringify(data);
      }

      if (data.workflow) {
        aiMsg.workflowSnapshot = {
          workflow: data.workflow.name,
          step: data.workflow.currentStep,
          contextAtStep: data.workflow.sessionContext ?? {},
        };
      }

      addMessage(aiMsg);
      handleWorkflowResponse(data);
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `⚠️ Network error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, addMessage, setInput, setLoading, sessionContext, activeWorkflow, currentStep, handleWorkflowResponse]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100dvh-160px)] overflow-hidden rounded-lg border border-border bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-20">
              <Bot className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">
                Type a message to get started. Try{" "}
                <span className="font-medium text-foreground">&quot;create a patient&quot;</span>
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 flex size-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : "text-left"}`}>
                {msg.text && (
                  <p
                    className={
                      msg.role === "user"
                        ? "inline-block rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                        : "inline-block rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-card-foreground"
                    }
                  >
                    {msg.text}
                  </p>
                )}

                {msg.ui && (
                  <div className="mt-2">
                    <Renderer processor={processor} surfaceId={`surface-${msg.id}`} component={msg.ui} />
                  </div>
                )}

                {msg.toolCall && (
                  <div className="mt-2">
                    <ToolCallDetails toolCall={msg.toolCall} />
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 flex size-8 items-center justify-center rounded-full bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 flex size-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="flex gap-2 items-center rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                <Skeleton className="h-2 w-20 rounded" />
                <Skeleton className="h-2 w-28 rounded" />
                <Skeleton className="h-2 w-14 rounded" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder='Try "create a patient" or "update patient 2"...'
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
