import React from "react";
import { CitationList, type CitationItem } from "@/components/citation-list";

export function ChatMessageList({
  messages,
}: {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: CitationItem[];
  }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-2 pb-6 md:px-4">
      {messages.map((message) => (
        <article
          key={message.id}
          className={
            message.role === "user"
              ? "ml-auto w-full max-w-3xl rounded-[1.75rem] border border-[rgba(126,166,255,0.34)] bg-[linear-gradient(140deg,rgba(62,124,255,0.36),rgba(27,62,126,0.34))] px-5 py-4 text-[var(--pi-ink)] shadow-[0_12px_36px_rgba(47,97,200,0.22)]"
              : "w-full max-w-3xl rounded-[1.75rem] border border-[var(--pi-border)] bg-[rgba(14,21,34,0.78)] px-5 py-4 text-[var(--pi-ink)]"
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-7 md:text-[15px]">
            {message.content}
          </p>
          {message.role === "assistant" ? <CitationList citations={message.citations} /> : null}
        </article>
      ))}
    </div>
  );
}
