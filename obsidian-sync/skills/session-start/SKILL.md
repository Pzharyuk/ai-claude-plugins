---
name: session-start
description: >
  Use this skill at the start of a conversation when working in a git project directory.
  Syncs the project's Obsidian note with current state and loads it into context so Claude
  has full project history, recent commits, open PRs, and prior session notes.
metadata:
  version: "0.1.0"
---

# Session Start: obsidian-sync

Refresh the Obsidian project note with current data and load it into context.

## When to trigger

- At the beginning of a conversation when the working directory is inside a git project
- When the user switches to a different project mid-conversation

## Workflow

### 1. Detect the project
Determine which git project the current working directory belongs to by checking for a `.git` directory (walk up if needed).

### 2. Sync the project
Call `obsidian_sync_project` with the project's root path. This refreshes:
- Git status (current branch, last commit, uncommitted changes)
- Recent commits (last 20)
- Open PRs and issues (via GitHub CLI if available)
- TODOs/FIXMEs in the codebase

### 3. Load the note
Call `obsidian_read_project_note` with the project name (e.g. "AI Business Tools").

Review the note contents, paying special attention to:
- **Session Log** — what was done in prior sessions, what was planned next
- **Open PRs** — ongoing work that may be relevant
- **Active Issues** — known bugs or feature requests
- **TODOs in Code** — outstanding items in the codebase

### 4. Proceed
You now have full context. Continue with the user's request, informed by the project's history and current state.

## Notes
- If the project has no existing note, `obsidian_sync_project` creates one automatically.
- If `obsidian_sync_project` fails (e.g. vault path doesn't exist), warn the user and suggest running the configure skill.
- Do not block the conversation if sync fails — proceed with what context is available.
