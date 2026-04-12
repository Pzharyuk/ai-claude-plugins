# Obsidian Sync Plugin — Design Spec

**Date:** 2026-04-11
**Status:** Draft
**Plugin name:** `obsidian-sync`
**Marketplace:** `ai-claude-plugins`

---

## Purpose

An MCP server plugin for Claude Code that automatically keeps an Obsidian vault in sync with all git projects in a workspace. Each project gets a living Markdown note in the vault that serves as a second brain — capturing architecture, git state, PRs, issues, TODOs, deployment info, and a narrative session log of every Claude Code conversation.

The plugin runs at conversation start (refresh live data, load context) and conversation end (append session narrative, final refresh).

## Architecture

### Plugin Structure

```
obsidian-sync/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── README.md
├── server/
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
└── skills/
    ├── configure/SKILL.md
    ├── session-start/SKILL.md
    └── session-end/SKILL.md
```

Follows the identical pattern as all existing `ai-claude-plugins` plugins: Node.js MCP server using `@modelcontextprotocol/sdk`, ES modules, direct filesystem access.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OBSIDIAN_VAULT_PATH` | yes | — | Absolute path to the Obsidian vault (e.g. `~/Documents/Obsidian/SecondBrain`) |
| `PROJECTS_DIR` | yes | — | Absolute path to scan for git repos (e.g. `~/Documents/Claude/Projects`) |
| `OBSIDIAN_PROJECTS_FOLDER` | no | `Projects` | Folder within the vault where project notes are stored |

### Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `git` CLI — git status, log, branch (available on PATH)
- `gh` CLI — GitHub PRs and issues (optional, graceful degradation)
- Node.js `fs` / `child_process` — filesystem access and shell commands

No Obsidian plugins required. The server writes Markdown files directly to the vault. Obsidian's file watcher picks up changes within seconds.

---

## MCP Tools (6 total)

### obsidian_discover_projects

Scans `PROJECTS_DIR` for directories containing a `.git` folder. Returns a list of discovered projects with metadata.

**Input:** none

**Output:** Array of objects:
```json
[
  {
    "name": "ai-business-tools",
    "path": "/Users/pzharyuk/Documents/Claude/Projects/ai-business-tools",
    "remote": "https://github.com/Pzharyuk/ai-business-tools.git",
    "branch": "main",
    "hasGhCli": true
  }
]
```

### obsidian_sync_project

Full sync for a single project. Gathers all data and writes/updates the project note in the vault.

**Input:**
- `project_path` (string, required) — absolute path to the git repo
- `force_overwrite` (boolean, optional, default: false) — if true, regenerate Overview and Architecture sections even if they already exist

**Behavior:**
1. Gather git status (branch, last commit, uncommitted changes)
2. Gather recent commits (last 20)
3. If `gh` CLI available and repo has a remote: gather open PRs (up to 20) and open issues (up to 20)
4. Scan for TODOs/FIXMEs in source files (up to 30)
5. On first sync: generate Overview (from README/package.json) and Architecture (from project structure) and Tech Stack (from dependencies)
6. On subsequent syncs: overwrite live data sections (Git Status, Recent Commits, Open PRs, Active Issues, TODOs in Code). Preserve Overview, Tech Stack, Architecture, Deployment, Session Log.
7. Write the note to `{OBSIDIAN_VAULT_PATH}/{OBSIDIAN_PROJECTS_FOLDER}/{Project Name}.md`
8. Update `updated` frontmatter timestamp

**Output:** Confirmation with path to the written note and summary of what changed.

### obsidian_sync_all_projects

Discovers all projects and syncs each one.

**Input:** none

**Output:** Summary of all synced projects with status per project.

### obsidian_read_project_note

Reads a project note from the vault and returns its contents.

**Input:**
- `project_name` (string, required) — name of the project (matches the note filename)

**Output:** Full Markdown content of the note.

### obsidian_list_project_notes

Lists all project notes in the vault's Projects folder.

**Input:** none

**Output:** Array of note names with their frontmatter status and last updated timestamp.

### obsidian_append_session_log

Appends a narrative session log entry to a project note.

**Input:**
- `project_name` (string, required) — name of the project
- `summary` (string, required) — narrative summary of the session: what was done, key decisions and reasoning, blockers, what to pick up next

**Behavior:**
1. Read the existing note
2. Find the `## Session Log` section
3. Prepend a new entry with today's date and the summary (most recent first)
4. Write the note back
5. Update `updated` frontmatter timestamp

**Output:** Confirmation.

---

## Project Note Format

Each project note follows this structure:

```markdown
---
date: 2026-04-11
updated: 2026-04-11T14:30:00
tags:
  - project
  - auto-sync
status: active
repo: https://github.com/Pzharyuk/ai-business-tools
---

# AI Business Tools

## Overview
[Auto-generated from README on first sync. Not overwritten after — user can edit freely in Obsidian.]

## Tech Stack
- **Runtime:** Node.js, TypeScript
- **Framework:** Next.js 16, React 19
- **Database:** PostgreSQL + Drizzle ORM
[Auto-generated from dependencies on first sync. Not overwritten after.]

## Architecture
- Entry: `src/app/` (App Router)
- Plugins: `src/plugins/` (16 modules)
[Auto-generated from project structure on first sync. Not overwritten after.]

## Git Status
- **Branch:** main
- **Last commit:** abc1234 — "Add Stripe webhook handler" (2026-04-11)
- **Uncommitted changes:** none
[Overwritten every sync.]

## Recent Commits
| Date | Hash | Message |
|------|------|---------|
| 2026-04-11 | abc1234 | Add Stripe webhook handler |
| 2026-04-10 | def5678 | Fix invoice PDF generation |
[Last 20 commits. Overwritten every sync.]

## Open PRs
- **#12** — Add expense categorization (draft, 3 files)
- **#11** — Gmail integration plugin (review requested)
[Overwritten every sync. Shows "None" if no open PRs. Shows "No remote configured" if no GitHub remote.]

## Active Issues
- **#8** — Plaid token refresh fails after 24h
- **#5** — Add multi-currency support
[Overwritten every sync. Shows "None" if no open issues.]

## TODOs in Code
- `src/plugins/invoices/index.ts:42` — TODO: handle partial payments
- `src/services/email.ts:15` — FIXME: rate limiting
[Up to 30 items. Overwritten every sync.]

## Deployment
- **GitOps:** hgwa-k8s-gitops/charts/ai-business-tools
- **Domain:** agent-dev.onit.systems
[Auto-generated on first sync from hgwa-k8s-gitops cross-reference. Not overwritten after.]

## Session Log

### 2026-04-11
Added Stripe webhook handler for invoice payment confirmation. Decided to use Stripe's webhook signature verification rather than rolling our own. The handler updates invoice status in the DB and triggers a notification via the email plugin. Next: wire up partial payment handling and add webhook retry logic for failed deliveries.

### 2026-04-10
Fixed PDF generation — the issue was Drizzle returning dates as strings instead of Date objects, which broke the date formatter. Also refactored the invoice template to use a shared layout component. Next: start on expense categorization PR.
[Append-only. Most recent first. Never overwritten.]
```

### Section Mutability Rules

| Section | First Sync | Subsequent Syncs |
|---------|-----------|-----------------|
| Frontmatter (`updated`) | Generated | Updated |
| Overview | Generated from README | Preserved |
| Tech Stack | Generated from deps | Preserved |
| Architecture | Generated from structure | Preserved |
| Git Status | Generated | Overwritten |
| Recent Commits | Generated | Overwritten |
| Open PRs | Generated | Overwritten |
| Active Issues | Generated | Overwritten |
| TODOs in Code | Generated | Overwritten |
| Deployment | Generated from gitops | Preserved |
| Session Log | Empty | Append-only |

---

## Skills

### session-start

**Triggers:** Beginning of a conversation when working in a project directory.

**Flow:**
1. Detect which git project the current working directory belongs to (walk up to find `.git`)
2. Call `obsidian_sync_project` with the project path — refreshes all live data
3. Call `obsidian_read_project_note` — loads the full note into Claude's context
4. Claude now has current project state + full history of prior sessions

### session-end

**Triggers:** End of conversation, user says "done", "wrapping up", or similar.

**Flow:**
1. Claude composes a narrative session log entry covering:
   - What was accomplished
   - Key decisions and reasoning
   - Files/areas touched
   - Blockers encountered
   - What to pick up next session
2. Call `obsidian_append_session_log` with the narrative
3. Call `obsidian_sync_project` — final refresh of live data sections

### configure

**Triggers:** First-time setup, user says "configure obsidian sync".

**Flow:**
1. Verify vault path and projects directory exist
2. Call `obsidian_discover_projects` — list all found repos
3. Call `obsidian_sync_all_projects` — generate initial notes for every project
4. Report what was created

---

## Data Gathering Details

### Git Status
```bash
git -C <path> branch --show-current
git -C <path> log -1 --format="%h|%s|%ai"
git -C <path> status --porcelain
```

### Recent Commits (last 20)
```bash
git -C <path> log -20 --format="%h|%s|%ai"
```

### Open PRs (via gh CLI)
```bash
gh pr list --repo <owner/repo> --state open --limit 20 --json number,title,isDraft,changedFiles,reviewDecision
```

### Open Issues (via gh CLI)
```bash
gh issue list --repo <owner/repo> --state open --limit 20 --json number,title,labels
```

### TODO Extraction
Grep source files (excluding node_modules, .git, dist, build, __pycache__, .venv) for `TODO`, `FIXME`, `HACK` patterns. Capture file path, line number, and comment text. Cap at 30 results.

### Architecture Detection (first sync only)
- Read `package.json` / `pyproject.toml` / `Makefile` / `docker-compose.yml` for tech stack
- List top-level directories and key source directories
- Read first 5 lines of README for project description
- Check if `PROJECTS_DIR` contains `hgwa-k8s-gitops` — if so, scan its `charts/` and `apps/` subdirectories for directory names matching the project name (exact or fuzzy). If found, include the chart path and any `values.yaml` domain/ingress references in the Deployment section. If `hgwa-k8s-gitops` is not present, skip the Deployment section entirely.

### Project Name Derivation
- Title Case of the directory name, with hyphens replaced by spaces
- e.g. `ai-business-tools` → `AI Business Tools`
- e.g. `car-deal-finder` → `Car Deal Finder`

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No GitHub remote (e.g. `car-deal-finder`) | Skip PR/issue sections, show "No remote configured" |
| `gh` CLI not installed or not authenticated | Skip PR/issue fetching, include note suggesting `gh auth login` |
| Vault Projects folder doesn't exist | Create it |
| Project note doesn't exist yet | Create with all sections |
| Project note has manual edits in preserved sections | Leave them intact |
| New project appears in PROJECTS_DIR | Discovered and synced automatically |
| Project directory deleted | Note stays in vault (manual archive) |
| Git command fails | Report error for that section, continue with others |
| Large repo (many commits/TODOs) | Capped: 20 commits, 30 TODOs, 20 PRs, 20 issues |

---

## Vault Conventions

- Notes stored in `{vault}/Projects/{Project Name}.md`
- Follows existing vault PARA structure
- Uses YAML frontmatter with `date`, `updated`, `tags`, `status`, `repo`
- Uses `[[wikilinks]]` for cross-project references (e.g. deployment note linking to gitops)
- Kebab-case not used for note filenames (Obsidian convention is Title Case)
- Compatible with the existing Project template's frontmatter fields
