"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RENAME_ERROR_MESSAGE = "Unable to rename project. Please try again.";

export function ProjectRenameControl({
  projectId,
  initialName,
}: {
  projectId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const trimmedName = name.trim();

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorMessage(payload?.error ?? RENAME_ERROR_MESSAGE);
        return;
      }

      setName(trimmedName);
      setEditing(false);
      router.refresh();
    } catch {
      setErrorMessage(RENAME_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setErrorMessage("");
          setEditing(true);
        }}
        className="rounded-xl border border-[var(--pi-border)] px-3.5 py-2 text-sm text-[var(--pi-muted)] transition hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
      >
        Rename
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (errorMessage) {
              setErrorMessage("");
            }
          }}
          maxLength={120}
          className="w-full min-w-[15rem] rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.68)] px-4 py-2.5 text-sm text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!trimmedName || submitting}
            className="rounded-xl border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.9),rgba(49,92,198,0.88))] px-3.5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(initialName);
              setErrorMessage("");
            }}
            className="rounded-xl border border-[var(--pi-border)] px-3.5 py-2 text-sm text-[var(--pi-muted)] transition hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
          >
            Cancel
          </button>
        </div>
      </div>
      {errorMessage ? (
        <p className="text-sm text-[var(--pi-danger,#fca5a5)]">{errorMessage}</p>
      ) : null}
    </form>
  );
}
