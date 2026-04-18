import React from "react";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type ProjectCardItem = {
  id: string;
  name: string;
  documentCount: number;
  updatedAt: string;
};

export function ProjectCard({ project }: { project: ProjectCardItem }) {
  const docsLabel = `${project.documentCount} docs`;

  return (
    <article className="relative rounded-[1.75rem] border border-[var(--pi-border)] bg-[linear-gradient(160deg,rgba(18,27,44,0.95),rgba(11,18,31,0.8))] p-5 shadow-[0_18px_44px_rgba(7,12,20,0.36)] backdrop-blur-lg">
      <div className="pointer-events-none absolute left-5 top-0 h-3.5 w-24 -translate-y-[45%] rounded-t-[0.95rem] border border-[var(--pi-border)] border-b-0 bg-[linear-gradient(180deg,rgba(42,67,112,0.95),rgba(24,41,69,0.88))]" />
      <a
        href={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="group block rounded-2xl border border-transparent px-1 py-1 outline-none transition focus-visible:border-[var(--pi-border-strong)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold leading-tight text-[var(--pi-ink)] transition group-hover:text-white">
            {project.name}
          </h3>
          <span className="rounded-full border border-[var(--pi-brand-soft)] bg-[rgba(52,102,230,0.25)] px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[rgba(194,217,255,0.95)]">
            Folder
          </span>
        </div>
        <p className="mt-7 text-sm font-medium text-[var(--pi-ink)]/90">{docsLabel}</p>
        <p className="mt-1 text-xs text-[var(--pi-muted)]">
          Updated {formatUpdatedAt(project.updatedAt)}
        </p>
      </a>
    </article>
  );
}
