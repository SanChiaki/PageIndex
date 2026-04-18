"use client";

import React from "react";

export function ProjectScopePicker({
  projects,
  selectedProjectIds,
  onToggle,
}: {
  projects: Array<{ id: string; name: string }>;
  selectedProjectIds: string[];
  onToggle: (projectId: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <p className="text-xs text-[var(--pi-muted)]">
        No projects yet. Create one in Projects to enable chat scope.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {projects.map((project) => {
        const selected = selectedProjectIds.includes(project.id);
        return (
          <button
            key={project.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(project.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selected
                ? "border-[var(--pi-border-strong)] bg-[rgba(63,126,255,0.28)] text-[var(--pi-ink)]"
                : "border-[var(--pi-border)] bg-[rgba(14,22,35,0.62)] text-[var(--pi-muted)] hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
            }`}
          >
            {project.name}
          </button>
        );
      })}
    </div>
  );
}
