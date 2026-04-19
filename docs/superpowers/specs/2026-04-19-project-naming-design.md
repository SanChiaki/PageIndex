# Project Naming Design

## Goal

Add explicit project naming flows so users can:

- enter a required name when creating a new project
- rename an existing project from the project detail page

This naming flow must support the rest of the current product direction:

- projects remain the primary document-management boundary
- chat scope continues to use project names as the visible label
- later CDP verification can rely on stable, user-provided project names instead of generated placeholders

## Current Context

The current codebase already stores project names, but naming is not user-driven end to end:

- `POST /api/projects` already accepts a required `name`
- the projects page bypasses that API through a server action and auto-generates names like `Project 04-19 12:34`
- the project detail page shows the current name but has no rename affordance
- chat scope chips and conversation summaries read project names from storage, so renaming at the data layer will naturally flow into chat views

Relevant files:

- [`web/app/projects/page.tsx`](/Users/oam/Workspace/demos/PageIndexDemo/web/app/projects/page.tsx)
- [`web/app/projects/[projectId]/page.tsx`](/Users/oam/Workspace/demos/PageIndexDemo/web/app/projects/[projectId]/page.tsx)
- [`web/app/api/projects/route.ts`](/Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/route.ts)
- [`web/app/api/projects/[projectId]/route.ts`](/Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/[projectId]/route.ts)
- [`web/lib/repos/project-store.ts`](/Users/oam/Workspace/demos/PageIndexDemo/web/lib/repos/project-store.ts)
- [`web/app/chat/page.tsx`](/Users/oam/Workspace/demos/PageIndexDemo/web/app/chat/page.tsx)

## Scope

### In Scope

- require a user-provided name when creating a project from the projects page
- add project rename support on the project detail page
- persist updated project names in SQLite
- expose rename through the existing project detail API route
- keep chat header scope labels and project lists consistent after rename
- add tests for repo behavior, API behavior, and page rendering behavior

### Out of Scope

- deleting or archiving projects
- slug editing or URL changes
- bulk rename
- optimistic cross-tab sync
- changing existing conversation titles automatically after a project rename

## Recommended Approach

Keep project names as simple mutable metadata on the existing `projects.name` field, then add two thin UI surfaces:

1. a compact create form on the projects page
2. an inline rename control on the project detail page

Why this approach:

- it reuses the existing `name` field and `POST /api/projects` validation contract
- it avoids introducing modal state on the projects page just to capture one string
- it keeps rename close to the project header where users already look for project-level actions
- chat views update naturally because they already resolve project names from the database

## UX Changes

### Projects Page Create Flow

Replace the current one-click generated-name button with a compact header form:

- text input with placeholder like `Enter project name`
- submit button labeled `Create Project`
- submit remains disabled when the trimmed input is empty

On success:

- create the project with the provided trimmed name
- refresh the projects page
- clear the input

On invalid input:

- browser-level `required` handles the empty case
- server-side validation remains the final guard

This form should stay visually compact so it still reads as a single top-right action cluster, not a full-page wizard.

### Project Detail Rename Flow

In the project detail header:

- default state shows the current project name and a `Rename` button
- clicking `Rename` swaps the title area into an inline edit form
- edit form includes a text input prefilled with the current name plus `Save` and `Cancel`

On success:

- persist the new trimmed name
- refresh the current page so header, breadcrumb, and any dependent UI all show the updated name
- exit edit mode

On cancel:

- restore the non-editing header without changing data

Validation behavior:

- blank or whitespace-only values are rejected
- leading and trailing whitespace are trimmed before persistence
- max length remains `120` to match the existing create contract

## API Contract

### Existing Create Route

`POST /api/projects` already accepts:

```json
{
  "name": "Alpha rollout"
}
```

This contract stays unchanged. The frontend create flow should now actually use explicit user input instead of generated defaults.

### Project Detail Route Extension

Extend `PATCH /api/projects/:projectId` on the existing detail route.

Request:

```json
{
  "name": "Renamed project"
}
```

Responses:

- `200` with the updated project payload when rename succeeds
- `400` for invalid payload or invalid name
- `404` when the project does not exist for the current owner

The existing `GET /api/projects/:projectId` behavior stays unchanged.

## Data Rules

Add a repository helper to update a project name:

- scope by both `projectId` and `ownerUserId`
- trim the provided name before writing
- update `updated_at`
- return the updated project payload, or `null` if no owned project matches

No schema change is required. This is a behavior-only extension of the current `projects` table.

## Interaction With Chat

No dedicated chat code change should be required for rename propagation:

- chat pages already call `listProjects(...)` and `getConversationDetail(...)`
- selected project scope labels are derived from current project names

That means after a project rename:

- the chat composer scope picker should show the new project name
- chat header scope summary should show the new project name
- historical conversation records keep their own titles unless separately edited

## Testing Strategy

### Repository Tests

Add coverage for:

- updating a project name for the owner
- trimming whitespace during rename
- returning `null` when renaming a project outside owner scope

### API Tests

Add route coverage for:

- `PATCH /api/projects/:projectId` success
- `PATCH` invalid payload returns `400`
- `PATCH` missing project returns `404`

### Page Tests

Add or extend page coverage for:

- projects page renders the create-name form instead of a generated-name submit-only form
- project detail page renders the rename affordance

### CDP Verification

After implementation, run browser verification for:

- create a project with a manual name
- rename it on the detail page
- upload documents into that renamed project
- open chat and confirm project selection uses the updated name
- send a chat request scoped to that project and confirm retrieval/chat flow remains operational

## Risks and Mitigations

### Risk: create and rename validation drift apart

Mitigation:

- keep both flows aligned on the same trimmed-name and `max 120` contract
- reuse existing API validation patterns instead of inventing a separate client-only rule set

### Risk: rename UI becomes state-heavy relative to the page

Mitigation:

- keep rename state in a small dedicated client component rather than bloating the server page component

### Risk: generated names remain reachable through old code paths

Mitigation:

- remove the auto-generated-name server action from the projects page
- make explicit input the only create path in the main UI

## Acceptance Criteria

- creating a project from the projects page requires entering a name first
- blank project names cannot be submitted successfully
- an existing project can be renamed from its detail page
- rename persists in storage and updates the detail header after refresh
- chat project labels reflect the renamed project
- existing upload and chat flows still work after project naming changes
