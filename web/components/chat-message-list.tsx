import React from "react";
import { CitationList, type CitationItem } from "@/components/citation-list";
import type { RetrievalEvidence } from "@/lib/retrieval-client";

function EvidenceList({ evidence }: { evidence: RetrievalEvidence[] }) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {evidence.map((item, index) => {
        const path =
          item.projectRelativePath ?? item.sourceRelativePath ?? item.documentName ?? "Evidence";
        return (
          <section
            key={`${item.documentName}-${item.pages}-${index}`}
            className="rounded-[1.25rem] border border-[var(--pi-border)] bg-[rgba(255,255,255,0.74)] p-4 shadow-[0_10px_28px_rgba(65,88,130,0.08)]"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pi-muted)]">
                  Evidence · {item.evidenceKind}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--pi-ink)]">{path}</h3>
                <p className="mt-1 text-xs text-[var(--pi-muted)]">
                  {item.projectName} / {item.documentName} / pages {item.pages}
                </p>
              </div>
              {item.sourceRelativePath ? (
                <span className="rounded-full bg-[var(--pi-bg-soft)] px-3 py-1 text-[11px] font-medium text-[var(--pi-muted)]">
                  {item.sourceRelativePath}
                </span>
              ) : null}
            </div>
            {item.excerpt ? (
              <p className="mt-3 rounded-2xl bg-[var(--pi-brand-soft)] px-3 py-2 text-sm leading-6 text-[var(--pi-ink)]">
                {item.excerpt}
              </p>
            ) : null}
            <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-[var(--pi-ink)]">
              {item.content}
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function ChatMessageList({
  messages,
}: {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: CitationItem[];
    evidence?: RetrievalEvidence[];
  }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-2 pb-6 md:px-4">
      {messages.map((message) => (
        <article
          key={message.id}
          className={
            message.role === "user"
              ? "ml-auto w-full max-w-3xl rounded-[1.75rem] border border-[rgba(37,99,235,0.24)] bg-[linear-gradient(140deg,rgba(219,234,254,0.95),rgba(239,246,255,0.92))] px-5 py-4 text-[var(--pi-ink)] shadow-[0_16px_36px_rgba(37,99,235,0.12)]"
              : "w-full max-w-3xl rounded-[1.75rem] border border-[var(--pi-border)] bg-[rgba(255,255,255,0.82)] px-5 py-4 text-[var(--pi-ink)] shadow-[0_18px_44px_rgba(65,88,130,0.1)]"
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-7 md:text-[15px]">
            {message.content}
          </p>
          {message.role === "assistant" ? (
            <>
              <CitationList citations={message.citations} />
              <EvidenceList evidence={message.evidence ?? []} />
            </>
          ) : null}
        </article>
      ))}
    </div>
  );
}
