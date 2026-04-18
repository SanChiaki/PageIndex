"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectScopePicker } from "@/components/project-scope-picker";

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
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const canSend = activeProjectIds.length > 0 && message.trim().length > 0 && !sending;
  const placeholder =
    activeProjectIds.length === 0
      ? "Select at least one project before asking a question."
      : "Ask a question about the selected projects...";

  async function handleSend() {
    if (!canSend) {
      return;
    }

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
      setSending(false);
    }
  }

  return (
    <form
      className="rounded-[1.75rem] border border-[var(--pi-border)] bg-[rgba(12,19,31,0.92)] p-4 shadow-[0_16px_38px_rgba(5,10,19,0.5)]"
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
        className="min-h-[108px] w-full resize-none rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.78)] px-4 py-3 text-sm leading-6 text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
      />

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <ProjectScopePicker
          projects={availableProjects}
          selectedProjectIds={activeProjectIds}
          onToggle={toggleProject}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.9),rgba(49,92,198,0.88))] px-6 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(45,105,255,0.3)] transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-3 text-sm text-[var(--pi-danger,#fca5a5)]">{errorMessage}</p>
      ) : null}
    </form>
  );
}
