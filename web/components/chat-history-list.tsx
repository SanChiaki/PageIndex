import React from "react";
import Link from "next/link";

export function ChatHistoryList({
  conversations,
  collapsed,
}: {
  conversations: Array<{ id: string; title: string; scopeLabel: string }>;
  collapsed: boolean;
}) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--pi-border)] bg-[rgba(14,20,30,0.42)] px-3 py-4 text-xs text-[var(--pi-muted)]">
        {collapsed ? "Chats" : "Conversation history will appear here."}
      </div>
    );
  }

  return (
    <>
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`/chat?conversationId=${conversation.id}`}
          className={`block rounded-2xl border border-[var(--pi-border)] bg-[rgba(16,24,38,0.68)] text-sm transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(22,33,51,0.88)] ${
            collapsed ? "px-2 py-3 text-center" : "px-3 py-3"
          }`}
        >
          {collapsed ? (
            <p className="truncate font-medium text-[var(--pi-ink)]">
              {conversation.title.charAt(0).toUpperCase()}
            </p>
          ) : (
            <>
              <p className="truncate font-medium text-[var(--pi-ink)]">{conversation.title}</p>
              <p className="mt-1 truncate text-xs text-[var(--pi-muted)]">
                {conversation.scopeLabel}
              </p>
            </>
          )}
        </Link>
      ))}
    </>
  );
}
