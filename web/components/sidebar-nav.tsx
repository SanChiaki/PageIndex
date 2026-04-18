"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChatHistoryList } from "@/components/chat-history-list";

export type SidebarConversation = {
  id: string;
  title: string;
  scopeLabel: string;
  updatedAt?: string;
};

export function SidebarNav({
  collapsed,
  conversations,
  onToggleCollapse,
}: {
  collapsed: boolean;
  conversations: SidebarConversation[];
  onToggleCollapse: () => void;
}) {
  const [themeMode, setThemeMode] = useState<"night" | "dawn">("night");

  return (
    <aside
      className={`w-full rounded-b-[2rem] border border-[var(--pi-border)] bg-[var(--pi-panel)] px-4 py-4 backdrop-blur-xl transition-[width] md:fixed md:inset-y-4 md:left-4 md:rounded-[2rem] md:px-3 md:py-4 ${
        collapsed ? "md:w-[5.75rem]" : "md:w-[17.5rem]"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--pi-border)] bg-[rgba(20,30,47,0.72)] px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--pi-border-strong)] bg-[rgba(28,44,73,0.92)] text-sm font-semibold text-[var(--pi-ink)]">
            PI
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold tracking-[0.02em] text-[var(--pi-ink)]">
                PageIndex
              </p>
              <p className="text-xs text-[var(--pi-muted)]">Knowledge Workspace</p>
            </div>
          ) : null}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--pi-border)] bg-[rgba(14,22,36,0.9)] text-[var(--pi-ink)] transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(20,32,51,0.95)]"
          >
            <span aria-hidden="true" className="text-base leading-none">
              {collapsed ? "⟩" : "⟨"}
            </span>
          </button>
        </div>

        <nav className="space-y-2">
          <Link
            href="/chat"
            className={`flex rounded-2xl border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.85),rgba(45,87,186,0.86))] text-sm font-semibold text-white shadow-[0_12px_38px_rgba(43,108,255,0.32)] transition hover:brightness-105 ${
              collapsed
                ? "items-center justify-center px-0 py-3"
                : "items-center justify-between px-4 py-3"
            }`}
          >
            {!collapsed ? <span>New Chat</span> : <span className="sr-only">New Chat</span>}
            <span className="text-base leading-none">+</span>
          </Link>
          <Link
            href="/projects"
            className={`block rounded-2xl border border-[var(--pi-border)] bg-[rgba(18,27,42,0.74)] text-sm text-[var(--pi-ink)] transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(26,37,58,0.84)] ${
              collapsed ? "px-0 py-3 text-center" : "px-4 py-3"
            }`}
          >
            {collapsed ? "P" : "Projects"}
          </Link>
        </nav>

        <section className="mt-6 flex min-h-0 flex-1 flex-col">
          <h2
            className={`px-2 text-[11px] uppercase tracking-[0.16em] text-[var(--pi-muted)] ${
              collapsed ? "sr-only" : ""
            }`}
          >
            Chats
          </h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            <ChatHistoryList conversations={conversations} collapsed={collapsed} />
          </div>
        </section>

        <footer
          aria-label="Sidebar controls"
          className="mt-auto border-t border-[var(--pi-border)] pt-4"
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-label="Open settings"
              className="rounded-xl border border-[var(--pi-border)] bg-[rgba(16,24,38,0.75)] px-3 py-2 text-xs font-medium text-[var(--pi-ink)] transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(24,35,54,0.9)]"
            >
              {collapsed ? "S" : "Settings"}
            </button>
            <button
              type="button"
              aria-label="Switch theme"
              aria-pressed={themeMode === "dawn"}
              onClick={() =>
                setThemeMode((value) => (value === "night" ? "dawn" : "night"))
              }
              className="rounded-xl border border-[var(--pi-border)] bg-[rgba(16,24,38,0.75)] px-3 py-2 text-xs font-medium text-[var(--pi-ink)] transition hover:border-[var(--pi-border-strong)] hover:bg-[rgba(24,35,54,0.9)]"
            >
              {collapsed ? "T" : `Theme · ${themeMode === "night" ? "Night" : "Dawn"}`}
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}
