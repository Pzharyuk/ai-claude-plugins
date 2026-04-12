---
name: configure
description: >
  Use this skill when the user asks to "configure obsidian sync", "set up obsidian",
  "connect obsidian", or when the plugin is installed for the first time.
metadata:
  version: "0.1.0"
---

# Configure: obsidian-sync

Walk the user through setting up the Obsidian vault sync and run the initial project discovery.

## Steps

### 1. Confirm vault path
Ask: "What is the absolute path to your Obsidian vault? (e.g. ~/Documents/Obsidian/SecondBrain)"

Store as `OBSIDIAN_VAULT_PATH`.

### 2. Confirm projects directory
Ask: "What is the absolute path to the directory containing your git repositories? (e.g. ~/Documents/Claude/Projects)"

Store as `PROJECTS_DIR`.

### 3. Confirm projects folder (optional)
Ask: "What folder name within the vault should project notes be stored in? (default: Projects)"

Store as `OBSIDIAN_PROJECTS_FOLDER` (or use default `Projects`).

### 4. Write to ~/.mcp.json
Read `~/.mcp.json` (create if missing), set the env vars under the `obsidian-sync` server:

```json
{
  "mcpServers": {
    "obsidian-sync": {
      "env": {
        "OBSIDIAN_VAULT_PATH": "<value from step 1>",
        "PROJECTS_DIR": "<value from step 2>",
        "OBSIDIAN_PROJECTS_FOLDER": "<value from step 3>"
      }
    }
  }
}
```

### 5. Prompt reload
Say: "Configuration saved to ~/.mcp.json. Run `/reload-plugins` to apply."

### 6. Initial sync
After reload, call `obsidian_discover_projects` to show found projects, then call `obsidian_sync_all_projects` to generate initial notes.

Report what was created.

## Notes
- Expand `~` to the full home directory path before saving.
- Verify the vault path exists before saving.
