import React from "react";
import { AppShell } from "@/components/app-shell";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageList } from "@/components/chat-message-list";
import type { CitationItem } from "@/components/citation-list";
import { appConfig } from "@/lib/config";
import { getConversationDetail, listConversations } from "@/lib/repos/conversation-store";
import { listProjects } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

function toCitation(value: unknown): CitationItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.projectName !== "string" ||
    typeof candidate.documentName !== "string" ||
    typeof candidate.pages !== "string"
  ) {
    return null;
  }

  return {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
    projectName: candidate.projectName,
    documentId: typeof candidate.documentId === "string" ? candidate.documentId : undefined,
    documentName: candidate.documentName,
    pages: candidate.pages,
  };
}

function isCitationItem(citation: CitationItem | null): citation is CitationItem {
  return citation !== null;
}

function getScopeSummary(
  selectedProjectIds: string[],
  availableProjects: Array<{ id: string; name: string }>,
) {
  if (selectedProjectIds.length === 0) {
    return "No project selected";
  }

  const projectNames = selectedProjectIds
    .map((projectId) => availableProjects.find((project) => project.id === projectId)?.name)
    .filter((name): name is string => Boolean(name));

  if (projectNames.length <= 1) {
    return projectNames[0] ?? "No project selected";
  }

  return "Multiple projects";
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawConversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const conversationId = rawConversationId?.trim() ? rawConversationId.trim() : undefined;

  const conversations = listConversations(appConfig.dbPath, demoUserId);
  const availableProjects = listProjects(appConfig.dbPath, demoUserId).map((project) => ({
    id: project.id,
    name: project.name,
  }));
  const conversation = conversationId
    ? getConversationDetail(appConfig.dbPath, conversationId, demoUserId)
    : null;

  const availableProjectIdSet = new Set(availableProjects.map((project) => project.id));
  const selectedProjectIds = (conversation?.projectIds ?? []).filter((projectId) =>
    availableProjectIdSet.has(projectId),
  );
  const scopeSummary = getScopeSummary(selectedProjectIds, availableProjects);
  const messages = (conversation?.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    citations: Array.isArray(message.citations)
      ? message.citations.map(toCitation).filter(isCitationItem)
      : [],
  }));

  return (
    <AppShell conversations={conversations}>
      <section className="flex min-h-[calc(100vh-4.25rem)] flex-col">
        <header className="rounded-[2rem] border border-[var(--pi-border)] bg-[var(--pi-panel)] px-6 py-6 backdrop-blur-xl md:px-8">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--pi-muted)]">Chat</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h1 className="text-3xl font-semibold text-[var(--pi-ink)] md:text-4xl">
              {conversation?.title ?? "New Chat"}
            </h1>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--pi-border)] bg-[rgba(14,21,34,0.72)] px-3 py-1.5 text-xs text-[var(--pi-muted)]">
              <span className="uppercase tracking-[0.14em]">Scope</span>
              <span className="text-[var(--pi-ink)]">{scopeSummary}</span>
            </div>
          </div>
        </header>

        <div className="relative mt-6 flex-1">
          {messages.length > 0 ? (
            <div className="pb-52 pt-2">
              <ChatMessageList messages={messages} />
            </div>
          ) : (
            <div className="flex h-full min-h-[44vh] items-center justify-center px-4 pb-52">
              <div className="w-full max-w-2xl text-center">
                <h2 className="text-3xl font-semibold text-[var(--pi-ink)] md:text-5xl">
                  Welcome to PageIndex
                </h2>
                <p className="mt-4 text-sm text-[var(--pi-muted)] md:text-base">
                  Select one or more projects, then ask a question against indexed PDFs.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 mt-auto bg-[linear-gradient(180deg,rgba(5,8,13,0),rgba(5,8,13,0.92)_26%,rgba(5,8,13,0.98)_100%)] px-1 pb-2 pt-6 backdrop-blur-md">
          <div className="mx-auto w-full max-w-4xl">
            <ChatComposer
              availableProjects={availableProjects}
              selectedProjectIds={selectedProjectIds}
              conversationId={conversation?.id}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
