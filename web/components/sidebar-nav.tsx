import Link from "next/link";

export type SidebarConversation = {
  id: string;
  title: string;
  scopeLabel: string;
  updatedAt?: string;
};

export function SidebarNav({
  conversations,
}: {
  conversations: SidebarConversation[];
}) {
  return (
    <aside className="w-full rounded-b-[2rem] border border-[var(--pi-border)] bg-[var(--pi-panel)] px-4 py-4 backdrop-blur-xl md:fixed md:inset-y-4 md:left-4 md:w-[17.5rem] md:rounded-[2rem] md:px-3 md:py-4">
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--pi-border)] bg-[rgba(20,30,47,0.72)] px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--pi-border-strong)] bg-[rgba(28,44,73,0.92)] text-sm font-semibold text-[var(--pi-ink)]">
            PI
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.02em] text-[var(--pi-ink)]">
              PageIndex
            </p>
            <p className="text-xs text-[var(--pi-muted)]">Knowledge Workspace</p>
          </div>
        </div>

        <nav className="space-y-2">
          <Link
            href="/chat"
            className="flex items-center justify-between rounded-2xl border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.85),rgba(45,87,186,0.86))] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_38px_rgba(43,108,255,0.32)] transition hover:brightness-105"
          >
            <span>New Chat</span>
            <span className="text-base leading-none">+</span>
          </Link>
          <Link
            href="/projects"
            className="block rounded-2xl border border-[var(--pi-border)] bg-[rgba(18,27,42,0.74)] px-4 py-3 text-sm text-[var(--pi-ink)] transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(26,37,58,0.84)]"
          >
            Projects
          </Link>
        </nav>

        <section className="mt-6 flex min-h-0 flex-1 flex-col">
          <h2 className="px-2 text-[11px] uppercase tracking-[0.16em] text-[var(--pi-muted)]">
            Chats
          </h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--pi-border)] bg-[rgba(14,20,30,0.42)] px-3 py-4 text-xs text-[var(--pi-muted)]">
                Conversation history will appear here.
              </div>
            ) : (
              conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/chat?conversationId=${conversation.id}`}
                  className="block rounded-2xl border border-[var(--pi-border)] bg-[rgba(16,24,38,0.68)] px-3 py-3 text-sm transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(22,33,51,0.88)]"
                >
                  <p className="truncate font-medium text-[var(--pi-ink)]">
                    {conversation.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--pi-muted)]">
                    {conversation.scopeLabel}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
