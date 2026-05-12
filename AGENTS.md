# AGENTS.md

## Worktree Model

This repository uses a worktree-first workflow.

The main repo directory is only for:
- git control operations
- worktree management
- merge/rebase operations

Do not develop directly inside the main repo.

Each agent must:
- work in its own branch
- work in its own worktree
- stay within its assigned task scope

---

## Starting Work

Before editing, confirm where you are:

```sh
git rev-parse --show-toplevel
git status --short
```

If you are in the main repo directory, create or switch to a dedicated worktree before making changes.

Recommended naming:
- branch: `agent/<task-slug>` or `codex/<task-slug>`
- worktree: `../<repo-name>-worktrees/<task-slug>`

Example:

```sh
git fetch
git worktree add ../<repo-name>-worktrees/<task-slug> -b agent/<task-slug> origin/main
cd ../<repo-name>-worktrees/<task-slug>
```

Reuse an existing branch or worktree only when it clearly belongs to the same task.

---

## Working In A Worktree

After setup, stay inside the assigned worktree.

Do not modify files from:
- the main repo working directory
- another agent's worktree
- unrelated task branches

Keep changes limited to the assigned task. Avoid touching high-conflict shared files unless necessary:
- package.json
- lockfiles
- shared configs
- CI workflows
- database schemas

If existing changes are present in the worktree, assume they may belong to a human or another agent. Do not overwrite, revert, or rebase them away blindly.

---

## Finishing Work

Before handing off:

```sh
git status --short
git diff --stat
```

Summarize:
- current branch
- current worktree path
- changed files
- any high-conflict files touched
- whether the branch was rebased or merged before handoff
