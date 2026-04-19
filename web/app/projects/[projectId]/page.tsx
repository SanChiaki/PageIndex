import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectRenameControl } from "@/components/project-rename-control";
import { DocumentTable } from "@/components/document-table";
import { DocumentUploadModal } from "@/components/document-upload-modal";
import { appConfig } from "@/lib/config";
import { listConversations } from "@/lib/repos/conversation-store";
import { listDocumentsByProject } from "@/lib/repos/document-store";
import { getProjectById } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ projectId }, search] = await Promise.all([params, searchParams]);
  const rawQuery = (search.q ?? "").trim();
  const query = rawQuery.toLowerCase();
  const conversations = listConversations(appConfig.dbPath, demoUserId);
  const project = getProjectById(appConfig.dbPath, projectId, demoUserId);

  if (!project) {
    notFound();
  }

  const documents = listDocumentsByProject(appConfig.dbPath, projectId);
  const visibleDocuments = query
    ? documents.filter((document) =>
        document.fileName.toLowerCase().includes(query),
      )
    : documents;

  return (
    <AppShell conversations={conversations}>
      <section className="space-y-8">
        <header className="rounded-[2rem] border border-[var(--pi-border)] bg-[var(--pi-panel)] px-6 py-7 backdrop-blur-xl md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--pi-muted)]">
                <Link href="/projects" className="transition hover:text-[var(--pi-ink)]">
                  Projects
                </Link>
                <span>/</span>
                <span className="text-[var(--pi-ink)]">{project.name}</span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--pi-ink)] md:text-4xl">
                {project.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--pi-muted)] md:text-base">
                Upload PDFs and review indexing status before using this project in chat.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ProjectRenameControl projectId={projectId} initialName={project.name} />
              <DocumentUploadModal projectId={projectId} />
            </div>
          </div>
          <form className="mt-6">
            <label htmlFor="document-search" className="sr-only">
              Search documents
            </label>
            <input
              id="document-search"
              name="q"
              type="search"
              defaultValue={search.q ?? ""}
              placeholder="Search documents"
              className="w-full rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.68)] px-4 py-3 text-sm text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
            />
          </form>
        </header>

        <DocumentTable documents={visibleDocuments} searchQuery={rawQuery} />
      </section>
    </AppShell>
  );
}
