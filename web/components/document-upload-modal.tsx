"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentUploadModal({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("file", selectedFile);

    try {
      const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMessage(
          (payload as { error?: string } | null)?.error ?? "Upload failed. Try again.",
        );
        return;
      }

      setIsOpen(false);
      setSelectedFile(null);
      router.refresh();
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-2xl border border-[var(--pi-border-strong)] bg-[linear-gradient(140deg,rgba(64,126,255,0.84),rgba(51,91,189,0.84))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(43,108,255,0.24)] transition hover:brightness-105"
      >
        Upload
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,16,0.68)] p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-[1.8rem] border border-[var(--pi-border)] bg-[var(--pi-panel-strong)] p-6 shadow-[0_30px_60px_rgba(2,6,12,0.5)]"
          >
            <h2 className="text-xl font-semibold text-[var(--pi-ink)]">Upload PDF</h2>
            <p className="mt-2 text-sm text-[var(--pi-muted)]">
              Select one PDF document to start indexing.
            </p>

            <div className="mt-5 rounded-2xl border border-dashed border-[var(--pi-border)] bg-[rgba(13,20,32,0.65)] p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-[var(--pi-border)] bg-[rgba(18,29,45,0.75)] px-3 py-2 text-sm text-[var(--pi-ink)] transition hover:border-[var(--pi-border-strong)]"
              >
                Choose PDF
              </button>
              <p className="mt-3 text-xs text-[var(--pi-muted)]">
                {selectedFile ? selectedFile.name : "No file selected"}
              </p>
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-xl border border-[rgba(237,102,122,0.35)] bg-[rgba(93,19,37,0.34)] px-3 py-2 text-sm text-[rgba(255,201,212,0.95)]">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage(null);
                }}
                className="rounded-xl border border-[var(--pi-border)] px-3.5 py-2 text-sm text-[var(--pi-muted)] transition hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedFile || isSubmitting}
                className="rounded-xl border border-[var(--pi-border-strong)] bg-[linear-gradient(140deg,rgba(64,126,255,0.9),rgba(53,98,206,0.86))] px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Uploading..." : "Upload PDF"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
