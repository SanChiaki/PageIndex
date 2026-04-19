"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CREATE_ERROR_MESSAGE = "Unable to create project. Please try again.";

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const trimmedName = name.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorMessage(payload?.error ?? CREATE_ERROR_MESSAGE);
        return;
      }

      setName("");
      router.refresh();
    } catch {
      setErrorMessage(CREATE_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
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
          placeholder="Enter project name"
          maxLength={120}
          className="w-full min-w-[15rem] rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.68)] px-4 py-2.5 text-sm text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
        />
        <button
          type="submit"
          disabled={!trimmedName || submitting}
          className="rounded-2xl border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.9),rgba(49,92,198,0.88))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(52,112,255,0.28)] transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? "Creating..." : "Create Project"}
        </button>
      </div>
      {errorMessage ? (
        <p className="text-sm text-[var(--pi-danger,#fca5a5)]">{errorMessage}</p>
      ) : null}
    </form>
  );
}
