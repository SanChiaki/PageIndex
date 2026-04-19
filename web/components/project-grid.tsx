import React from "react";
import { ProjectCard, type ProjectCardItem } from "@/components/project-card";

export function ProjectGrid({
  projects,
  searchQuery,
}: {
  projects: ProjectCardItem[];
  searchQuery?: string;
}) {
  const trimmedSearchQuery = searchQuery?.trim() ?? "";

  if (projects.length === 0) {
    if (trimmedSearchQuery) {
      return (
        <section className="rounded-[1.75rem] border border-dashed border-[var(--pi-border)] bg-[rgba(15,22,35,0.62)] p-10 text-center backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-[var(--pi-ink)]">No matching projects</h2>
          <p className="mt-2 text-sm text-[var(--pi-muted)]">
            No projects match "{trimmedSearchQuery}". Try a different search.
          </p>
        </section>
      );
    }

    return (
      <section className="rounded-[1.75rem] border border-dashed border-[var(--pi-border)] bg-[rgba(15,22,35,0.62)] p-10 text-center backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-[var(--pi-ink)]">No projects yet</h2>
        <p className="mt-2 text-sm text-[var(--pi-muted)]">
          Create a new project to start organizing PDFs for chat.
        </p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </section>
  );
}
