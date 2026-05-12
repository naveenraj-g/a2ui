/**
 * A2UIChat — the main chat interface for the workflow system.
 *
 * Responsibilities:
 *   - Sends user messages to POST /api/workflow, which calls the external AI
 *     agent and returns the first step of the selected workflow.
 *   - Renders each workflow step as an A2UI component tree (via Renderer) when
 *     a UI schema is available, or as a plain text description when it is not.
 *   - Listens for "dispatch" events fired by A2UI forms. When a form submits,
 *     it posts to POST /api/workflow/submit (direct FHIR HTTP call), merges
 *     returned outputs into sessionContext, and automatically advances to the
 *     next step via POST /api/workflow/step.
 *   - Shows a "Skip this step" bar for steps marked optional: true in the
 *     workflow definition, allowing the user to bypass them without submitting.
 *   - All workflow state (full WorkflowDefinition, stepIndex, sessionContext)
 *     lives in the Zustand chat store so it survives re-renders and can be
 *     serialised for persistence.
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import { createMessageProcessor } from "../a2ui/rendering/processor";
import { Renderer } from "../a2ui/rendering/renderer";
import type { AnyComponentNode, MarkdownNode } from "../a2ui/types";
import { parseUI } from "../utils/mapUiSchemaDataV3";
import { UI_SCHEMA_REGISTRY } from "../schemas/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Bot, User, SkipForward } from "lucide-react";
import { useChatStore } from "../store/chat-store";
import { ToolCallDetails } from "./ToolCallDetails";
import type {
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "@/types/workflow";

/** Wraps a plain string into a Markdown component node for rendering via <Renderer>. */
function buildMarkdownNode(content: string): MarkdownNode {
  return {
    id: crypto.randomUUID(),
    type: "Markdown",
    properties: { content: { literalString: content } },
  };
}

// Single processor instance shared across all surfaces in this chat session.
// The processor maintains per-surface component trees and data models so that
// each step's form renders independently within the same conversation.
const processor = createMessageProcessor();

/** Returns steps sorted by sequence_number, mirroring the server-side ordering. */
function getSortedSteps(
  workflow: WorkflowDefinition,
): WorkflowStepDefinition[] {
  return [...workflow.workflow_steps].sort(
    (a, b) => a.sequence_number - b.sequence_number,
  );
}

/**
 * Converts a raw UI schema object + pre-fetched step data into the
 * AnyComponentNode tree expected by Renderer. Returns null when no schema
 * is available so the caller can fall back to a plain-text step description.
 */
function buildUiFromData(
  ui: unknown,
  stepData: unknown,
): AnyComponentNode | null {
  if (!ui) return null;
  try {
    return parseUI(JSON.stringify({ ui, data: stepData ?? null }));
  } catch {
    return null;
  }
}

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
    currentStepIndex,
    mergeContext,
    setWorkflow,
    clearSession,
  } = useChatStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Fetches and renders a specific workflow step. Called after a successful
   * form submission (auto-advance) or when the user skips an optional step.
   * Posts the full workflow object + target index to /api/workflow/step so the
   * server can run the context_resolver and return fresh FHIR data if needed.
   */
  const loadWorkflowStep = useCallback(
    async (
      workflow: WorkflowDefinition,
      stepIndex: number,
      ctx: Record<string, unknown>,
    ) => {
      setLoading(true);
      try {
        const res = await fetch("/api/workflow/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow, stepIndex, sessionContext: ctx }),
        });

        const data = await res.json();

        if (data.type === "error") {
          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            ui: buildMarkdownNode(`⚠️ ${data.message}`),
          });
          return;
        }

        const step: WorkflowStepDefinition =
          data.step ?? getSortedSteps(workflow)[stepIndex];

        if (data.sessionContext) mergeContext(data.sessionContext);

        // "context" steps resolve data silently and auto-advance to the next step.
        // They never render UI or pause for user input.
        if (step.step_type === "context") {
          const steps = getSortedSteps(workflow);
          const nextIndex = stepIndex + 1 < steps.length ? stepIndex + 1 : null;
          if (nextIndex !== null) {
            setWorkflow(workflow, nextIndex);
            await loadWorkflowStep(
              workflow,
              nextIndex,
              data.sessionContext ?? ctx,
            );
          } else {
            if (workflow.completion?.message) {
              addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                ui: buildMarkdownNode(workflow.completion.message),
              });
            }
            clearSession();
          }
          return;
        }

        const uiSchema = UI_SCHEMA_REGISTRY[step.ui?.schema ?? ""] ?? null;
        const parsedUi = buildUiFromData(uiSchema, {
          ...(data.stepData ?? {}),
          ...(data.sessionContext ?? {}),
        });

        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui:
            parsedUi ??
            buildMarkdownNode(
              `**${step.name}**${step.optional ? " (optional)" : ""} — ${step.description}`,
            ),
          workflowSnapshot: {
            workflowId: workflow.id,
            stepIndex,
            stepId: step.id,
            contextAtStep: ctx,
          },
        });

        setWorkflow(workflow, stepIndex);
      } catch (err) {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui: buildMarkdownNode(
            `⚠️ Failed to load step: ${err instanceof Error ? err.message : "Unknown error"}`,
          ),
        });
      } finally {
        setLoading(false);
      }
    },
    [addMessage, setLoading, mergeContext, setWorkflow],
  );

  /**
   * Advances past the current step without submitting its form.
   * Only shown when the active step has optional: true. If there is no next
   * step, the workflow is considered complete and the session is cleared.
   */
  const skipCurrentStep = useCallback(async () => {
    if (!activeWorkflow || currentStepIndex === null) return;
    const steps = getSortedSteps(activeWorkflow);
    const skippedStep = steps[currentStepIndex];
    const nextIndex =
      currentStepIndex + 1 < steps.length ? currentStepIndex + 1 : null;

    addMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      ui: buildMarkdownNode(
        `**${skippedStep.name}** was skipped. This step cannot be revisited in the current session.`,
      ),
    });

    if (nextIndex !== null) {
      setWorkflow(activeWorkflow, nextIndex);
      await loadWorkflowStep(activeWorkflow, nextIndex, sessionContext);
    } else {
      if (activeWorkflow.completion?.message) {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui: buildMarkdownNode(activeWorkflow.completion.message),
        });
      }
      clearSession();
    }
  }, [
    activeWorkflow,
    currentStepIndex,
    sessionContext,
    setWorkflow,
    loadWorkflowStep,
    clearSession,
  ]);

  /**
   * Listens for "dispatch" events fired by A2UI form submit buttons.
   * Each event carries the action name and the serialised form context.
   * We read workflow state directly from the store (not from closure) to avoid
   * stale captures — the form may have been rendered in a previous render cycle.
   */
  useEffect(() => {
    const handleDispatch = async (event: Event) => {
      const { message, resolve } = (event as CustomEvent).detail;
      const actionName: string = message.userAction.name;
      const context: Record<string, unknown> = message.userAction.context ?? {};

      // Read fresh state from the store, not from the closure, to avoid stale workflow/step values.
      const state = useChatStore.getState();
      const currentWorkflow = state.activeWorkflow;
      const currentStepIdx = state.currentStepIndex;
      const currentCtx = state.sessionContext;

      mergeContext(context);

      if (!currentWorkflow || currentStepIdx === null) {
        resolve([]);
        return;
      }

      const steps = getSortedSteps(currentWorkflow);
      const currentStepDef = steps[currentStepIdx];

      const toolMsgId = crypto.randomUUID();
      addMessage({
        id: toolMsgId,
        role: "assistant",
        toolCall: {
          toolName: actionName,
          formData: context,
          status: "pending",
        },
        workflowSnapshot: {
          workflowId: currentWorkflow.id,
          stepIndex: currentStepIdx,
          stepId: currentStepDef?.id ?? "",
          contextAtStep: { ...currentCtx, ...context },
        },
      });

      try {
        const res = await fetch("/api/workflow/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: currentWorkflow,
            stepIndex: currentStepIdx,
            actionName,
            formData: context,
            sessionContext: { ...currentCtx, ...context },
          }),
        });

        const data = await res.json();

        if (data.success) {
          updateMessage(toolMsgId, {
            toolCall: {
              toolName: actionName,
              formData: context,
              result: data.data,
              status: "success",
            },
          });

          if (data.sessionContext) mergeContext(data.sessionContext);

          if (data.nextStepIndex !== null) {
            setWorkflow(currentWorkflow, data.nextStepIndex);
            await loadWorkflowStep(
              currentWorkflow,
              data.nextStepIndex,
              data.sessionContext ?? {},
            );
          } else {
            if (currentWorkflow.completion?.message) {
              addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                ui: buildMarkdownNode(currentWorkflow.completion.message),
              });
            }
            clearSession();
          }
        } else {
          updateMessage(toolMsgId, {
            toolCall: {
              toolName: actionName,
              formData: context,
              status: "error",
              error: data.error || "Submission failed",
            },
          });
        }
      } catch (err) {
        updateMessage(toolMsgId, {
          toolCall: {
            toolName: actionName,
            formData: context,
            status: "error",
            error: err instanceof Error ? err.message : "Network error",
          },
        });
      }

      resolve([]);
    };

    processor.addEventListener("dispatch", handleDispatch);
    return () => processor.removeEventListener("dispatch", handleDispatch);
  }, [
    addMessage,
    updateMessage,
    mergeContext,
    setWorkflow,
    clearSession,
    loadWorkflowStep,
  ]);

  /**
   * Sends the user's message to /api/workflow. The server calls the external
   * agent, selects the appropriate workflow, and returns its first step.
   * On a "workflow_step" response the full WorkflowDefinition is stored in
   * Zustand so all subsequent step/submit calls can re-send it to the server.
   */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    addMessage({ id: crypto.randomUUID(), role: "user", text });
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionContext }),
      });

      const data = await res.json();

      if (data.type === "workflow_step") {
        const workflow: WorkflowDefinition = data.workflow;
        const step: WorkflowStepDefinition = data.step;
        const stepIndex: number = data.stepIndex ?? 0;

        if (workflow.introduction) {
          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            ui: buildMarkdownNode(workflow.introduction),
          });
        }

        if (data.sessionContext) mergeContext(data.sessionContext);

        // If the first step is a context step, auto-advance to the next one.
        if (step.step_type === "context") {
          const steps = getSortedSteps(workflow);
          const nextIndex = stepIndex + 1 < steps.length ? stepIndex + 1 : null;
          if (nextIndex !== null) {
            setWorkflow(workflow, nextIndex);
            await loadWorkflowStep(
              workflow,
              nextIndex,
              data.sessionContext ?? {},
            );
          }
          return;
        }

        const uiSchema = UI_SCHEMA_REGISTRY[step.ui?.schema ?? ""] ?? null;
        const parsedUi = buildUiFromData(uiSchema, {
          ...(data.stepData ?? {}),
          ...(data.sessionContext ?? {}),
        });

        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui:
            parsedUi ??
            buildMarkdownNode(
              `**${step.name}**${step.optional ? " (optional)" : ""} — ${step.description}`,
            ),
          workflowSnapshot: {
            workflowId: workflow.id,
            stepIndex,
            stepId: step.id,
            contextAtStep: data.sessionContext ?? {},
          },
        });

        setWorkflow(workflow, stepIndex);
      } else if (data.type === "text" || data.type === "fallback") {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui: buildMarkdownNode(data.message),
        });
      } else if (data.type === "error") {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui: buildMarkdownNode(`⚠️ ${data.message}`),
        });
      } else {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          ui: buildMarkdownNode(JSON.stringify(data, null, 2)),
        });
      }
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        ui: buildMarkdownNode(
          `⚠️ Network error: ${err instanceof Error ? err.message : "Unknown error"}`,
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [
    input,
    loading,
    addMessage,
    setInput,
    setLoading,
    sessionContext,
    mergeContext,
    setWorkflow,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Determines whether to show the "Skip this step" bar above the input.
  const currentStepIsOptional =
    activeWorkflow !== null &&
    currentStepIndex !== null &&
    getSortedSteps(activeWorkflow)[currentStepIndex]?.optional === true;

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
                <span className="font-medium text-foreground">
                  &quot;create a patient&quot;
                </span>
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 flex size-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
              )}

              <div
                className={`max-w-[80%] ${msg.role === "user" ? "text-right" : "text-left"}`}
              >
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
                    <Renderer
                      processor={processor}
                      surfaceId={`surface-${msg.id}`}
                      component={msg.ui}
                    />
                  </div>
                )}

                {msg.toolCall && (
                  <div className="mt-2">
                    <ToolCallDetails toolCall={msg.toolCall} />
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="shrink-0 flex size-8 items-center justify-center rounded-full bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 flex size-8 items-center justify-center rounded-full bg-primary/10">
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

      {/* Skip optional step */}
      {currentStepIsOptional && !loading && (
        <div className="border-t border-border bg-background px-4 py-2">
          <div className="max-w-4xl mx-auto flex justify-end">
            <Button variant="ghost" size="sm" onClick={skipCurrentStep}>
              <SkipForward className="size-4 mr-2" />
              Skip this step
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder='Try "create a patient" or ask anything...'
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
