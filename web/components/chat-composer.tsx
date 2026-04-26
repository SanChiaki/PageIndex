"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectScopePicker } from "@/components/project-scope-picker";
import type { RetrievalMode } from "@/lib/retrieval-client";

type ConversationCreateResponse = { id: string };
const SEND_ERROR_MESSAGE = "Unable to send message. Please try again.";

export function ChatComposer({
  availableProjects,
  selectedProjectIds,
  conversationId,
}: {
  availableProjects: Array<{ id: string; name: string }>;
  selectedProjectIds: string[];
  conversationId?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [activeProjectIds, setActiveProjectIds] = useState(selectedProjectIds);
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("answer");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    setActiveProjectIds(selectedProjectIds);
  }, [selectedProjectIds]);

  function toggleProject(projectId: string) {
    setActiveProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((value) => value !== projectId)
        : [...current, projectId],
    );
  }

  const canSend = message.trim().length > 0 && !sending;
  const placeholder =
    activeProjectIds.length === 0
      ? "Search across all projects, or select project chips to narrow scope..."
      : "Ask a question about the selected projects...";

  async function handleSend() {
    if (sendInFlightRef.current || !canSend) {
      return;
    }

    sendInFlightRef.current = true;
    setSending(true);
    setErrorMessage("");
    try {
      let currentConversationId = conversationId;

      if (!currentConversationId) {
        const createResponse = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: activeProjectIds }),
        });
        if (!createResponse.ok) {
          setErrorMessage(SEND_ERROR_MESSAGE);
          return;
        }
        const created = (await createResponse.json()) as
          | ConversationCreateResponse
          | undefined;
        if (!created?.id) {
          setErrorMessage(SEND_ERROR_MESSAGE);
          return;
        }
        currentConversationId = created.id;
      }

      const sendResponse = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConversationId,
          projectIds: activeProjectIds,
          message: message.trim(),
          mode: retrievalMode,
        }),
      });
      if (!sendResponse.ok) {
        setErrorMessage(SEND_ERROR_MESSAGE);
        return;
      }

      setMessage("");
      router.push(`/chat?conversationId=${currentConversationId}`);
      router.refresh();
    } catch {
      setErrorMessage(SEND_ERROR_MESSAGE);
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  return (
    <form
      className="rounded-[2rem] border border-[var(--pi-border)] bg-[rgba(255,255,255,0.9)] p-3 shadow-[0_24px_70px_rgba(50,70,105,0.16)] ring-1 ring-white/70 backdrop-blur-xl"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSend();
      }}
    >
      <label htmlFor="chat-message" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={placeholder}
        className="min-h-[112px] w-full resize-none rounded-[1.5rem] border border-transparent bg-[rgba(247,250,255,0.82)] px-5 py-4 text-sm leading-6 text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:bg-white focus:ring-4 focus:ring-[var(--pi-brand-soft)]"
      />

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ProjectScopePicker
            projects={availableProjects}
            selectedProjectIds={activeProjectIds}
            onToggle={toggleProject}
          />
          <div
            className="inline-flex w-fit rounded-full border border-[var(--pi-border)] bg-[var(--pi-bg-soft)] p-1 text-xs font-semibold text-[var(--pi-muted)]"
            aria-label="Retrieval mode"
          >
            {(["answer", "evidence"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-label={`${mode === "answer" ? "Answer" : "Evidence"} mode`}
                aria-pressed={retrievalMode === mode}
                onClick={() => setRetrievalMode(mode)}
                className={`rounded-full px-3 py-1.5 transition ${
                  retrievalMode === mode
                    ? "bg-white text-[var(--pi-ink)] shadow-[0_8px_22px_rgba(65,88,130,0.14)]"
                    : "hover:text-[var(--pi-ink)]"
                }`}
              >
                {mode === "answer" ? "Answer" : "Evidence"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--pi-muted)]">
            {retrievalMode === "evidence"
              ? "Evidence mode returns source snippets and paths for downstream processing."
              : activeProjectIds.length === 0
                ? "Answer mode searches every ready document unless project chips are selected."
                : "Answer mode synthesizes a response from retrieved evidence."}
          </p>
          <button
            type="submit"
            aria-label="Send"
            disabled={!canSend}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-[var(--pi-brand)] bg-[var(--pi-brand)] px-6 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.26)] transition enabled:hover:-translate-y-0.5 enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
      {errorMessage ? (
        <p className="mt-3 text-sm text-[var(--pi-danger,#fca5a5)]">{errorMessage}</p>
      ) : null}
    </form>
  );
}
