"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type UploadResult = {
  uploaded: Array<{ fileName: string }>;
  failed: Array<{ fileName: string; error: string }>;
};

export function DocumentUploadModal({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<UploadResult | null>(null);

  function resetSelection() {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFiles.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setResultSummary(null);

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | ({ error?: string } & UploadResult)
        | null;
      const uploaded = payload?.uploaded ?? [];
      const failed = payload?.failed ?? [];

      if (uploaded.length > 0) {
        router.refresh();
      }

      if (!response.ok && uploaded.length === 0) {
        setErrorMessage(payload?.error ?? "Upload failed. Try again.");
        setResultSummary({ uploaded, failed });
        return;
      }

      if (failed.length > 0) {
        setResultSummary({ uploaded, failed });
        resetSelection();
        return;
      }

      setIsOpen(false);
      resetSelection();
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(6,10,16,0.68)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-upload-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[1.8rem] border border-[var(--pi-border)] bg-[var(--pi-panel-strong)] p-6 shadow-[0_30px_60px_rgba(2,6,12,0.5)]"
      >
        <h2 id="document-upload-title" className="text-xl font-semibold text-[var(--pi-ink)]">
          Upload PDF
        </h2>
        <p className="mt-2 text-sm text-[var(--pi-muted)]">
          Select one or more PDF documents to start indexing.
        </p>

        <div className="mt-5 rounded-2xl border border-dashed border-[var(--pi-border)] bg-[rgba(13,20,32,0.65)] p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              setSelectedFiles(Array.from(event.target.files ?? []));
              setErrorMessage(null);
              setResultSummary(null);
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
            {selectedFiles.length === 0
              ? "No files selected"
              : `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`}
          </p>
          {selectedFiles.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-[var(--pi-ink)]">
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-[rgba(237,102,122,0.35)] bg-[rgba(93,19,37,0.34)] px-3 py-2 text-sm text-[rgba(255,201,212,0.95)]">
            {errorMessage}
          </p>
        ) : null}
        {resultSummary ? (
          <div className="mt-4 rounded-xl border border-[var(--pi-border)] bg-[rgba(13,20,32,0.65)] px-3 py-3 text-sm text-[var(--pi-ink)]">
            <p>{`${resultSummary.uploaded.length} uploaded, ${resultSummary.failed.length} failed`}</p>
            {resultSummary.failed.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-[rgba(255,201,212,0.95)]">
                {resultSummary.failed.map((item) => (
                  <li key={`${item.fileName}-${item.error}`}>
                    <span className="font-medium text-[var(--pi-ink)]">{item.fileName}</span>
                    {`: ${item.error}`}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setErrorMessage(null);
              setResultSummary(null);
              resetSelection();
            }}
            className="rounded-xl border border-[var(--pi-border)] px-3.5 py-2 text-sm text-[var(--pi-muted)] transition hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={selectedFiles.length === 0 || isSubmitting}
            className="rounded-xl border border-[var(--pi-border-strong)] bg-[linear-gradient(140deg,rgba(64,126,255,0.9),rgba(53,98,206,0.86))] px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Uploading..." : "Upload PDFs"}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-2xl border border-[var(--pi-border-strong)] bg-[linear-gradient(140deg,rgba(64,126,255,0.84),rgba(51,91,189,0.84))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(43,108,255,0.24)] transition hover:brightness-105"
      >
        Upload
      </button>
      {modalContent && typeof document !== "undefined"
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
}
