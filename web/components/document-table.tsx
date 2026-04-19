export type DocumentTableRow = {
  id: string;
  fileName: string;
  pageCount: number;
  status: string;
  createdAt: string;
};

function formatUploadedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function DocumentTable({
  documents,
  searchQuery,
}: {
  documents: DocumentTableRow[];
  searchQuery?: string;
}) {
  const trimmedSearchQuery = searchQuery?.trim() ?? "";

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-[var(--pi-border)] bg-[var(--pi-panel-strong)] backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--pi-border)] bg-[rgba(24,35,56,0.82)] text-[var(--pi-muted)]">
              <th className="px-5 py-4 font-medium">File Name</th>
              <th className="px-5 py-4 font-medium">Page Count</th>
              <th className="px-5 py-4 font-medium">Indexing Status</th>
              <th className="px-5 py-4 font-medium">Upload Time</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-sm text-[var(--pi-muted)]"
                >
                  {trimmedSearchQuery
                    ? `No matching documents for "${trimmedSearchQuery}" in this project.`
                    : "No documents found in this project."}
                </td>
              </tr>
            ) : (
              documents.map((document) => (
                <tr key={document.id} className="border-b border-[var(--pi-border)]/70 last:border-0">
                  <td className="px-5 py-4 font-medium text-[var(--pi-ink)]">
                    {document.fileName}
                  </td>
                  <td className="px-5 py-4 text-[var(--pi-ink)]/90">{document.pageCount}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full border border-[var(--pi-border)] bg-[rgba(28,44,77,0.62)] px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--pi-ink)]/90">
                      {formatStatus(document.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[var(--pi-muted)]">
                    {formatUploadedAt(document.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
