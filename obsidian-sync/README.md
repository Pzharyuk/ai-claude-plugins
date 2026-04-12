# obsidian-sync

Automatic Obsidian vault sync for git projects. Keeps living Markdown notes in your vault that track git status, commits, PRs, issues, TODOs, architecture, and a narrative session log of every Claude Code conversation.

## Components

| Component | Description |
|-----------|-------------|
| MCP Server | 6 tools for project discovery, sync, reading, and session logging |
| Skills | configure, session-start, session-end |

## Available Tools (6)

### Discovery & Sync
- **obsidian_discover_projects** — scan projects directory for git repos
- **obsidian_sync_project** — full sync for a single project (git, PRs, issues, TODOs → note)
- **obsidian_sync_all_projects** — discover and sync all projects

### Reading
- **obsidian_read_project_note** — read a project note from the vault
- **obsidian_list_project_notes** — list all project notes with status

### Session Logging
- **obsidian_append_session_log** — append a narrative session entry to a project note

## Setup

### 1. Install the plugin
```bash
/plugin install obsidian-sync@ai-claude-plugins
```

### 2. Configure
Run the configure skill or manually set these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `OBSIDIAN_VAULT_PATH` | yes | Absolute path to your Obsidian vault |
| `PROJECTS_DIR` | yes | Absolute path to directory containing git repos |
| `OBSIDIAN_PROJECTS_FOLDER` | no | Folder in vault for project notes (default: `Projects`) |

### 3. Initial sync
After configuration, run `obsidian_sync_all_projects` to generate notes for all your projects.

## How It Works

- **Session start:** Refreshes project note with current git state, commits, PRs, issues, and TODOs. Loads the note into Claude's context for full project awareness.
- **Session end:** Appends a narrative log entry capturing what was done, decisions made, and what to pick up next. Final data refresh.
- **Live sections** (Git Status, Commits, PRs, Issues, TODOs) are overwritten every sync.
- **Preserved sections** (Overview, Tech Stack, Architecture, Deployment) are only generated on first sync — edit freely in Obsidian.
- **Session Log** is append-only — never overwritten.

## Requirements

- Node.js 18+
- `git` CLI
- `gh` CLI (optional — for PR/issue tracking)
