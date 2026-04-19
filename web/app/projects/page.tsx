import { AppShell } from "@/components/app-shell";
import { ProjectCreateForm } from "@/components/project-create-form";
import { ProjectGrid } from "@/components/project-grid";
import { appConfig } from "@/lib/config";
import { listConversations } from "@/lib/repos/conversation-store";
import { listProjects } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const conversations = listConversations(appConfig.dbPath, demoUserId);
  const projects = listProjects(appConfig.dbPath, demoUserId);
  const visibleProjects = query
    ? projects.filter((project) => project.name.toLowerCase().includes(query))
    : projects;

  return (
    <AppShell conversations={conversations}>
      <section className="space-y-8">
        <header className="rounded-[2rem] border border-[var(--pi-border)] bg-[var(--pi-panel)] px-6 py-7 backdrop-blur-xl md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--pi-muted)]">
                Workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--pi-ink)] md:text-4xl">
                Projects
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--pi-muted)] md:text-base">
                Organize documents by project, then use project scope in chat.
              </p>
            </div>
            <ProjectCreateForm />
          </div>
          <form className="mt-6">
            <label htmlFor="project-search" className="sr-only">
              Search projects
            </label>
            <input
              id="project-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Search projects"
              className="w-full rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.68)] px-4 py-3 text-sm text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
            />
          </form>
        </header>

        <ProjectGrid projects={visibleProjects} />
      </section>
    </AppShell>
  );
}
