# Configure: harness-memory

Walk the user through connecting this harness to a running `memoryd` and persist `MEMORY_URL` / `MEMORY_TOKEN` to `~/.mcp.json` so HTTP MCP can authenticate on every launch.

This plugin is a client. There is no local Node `server/`. `memoryd` must already be installed (Homebrew, compose, or helm).

## Steps

### 1. Check memoryd

Run:

```bash
memory status
```

- If the command is missing: tell the user to install first (`brew tap Pzharyuk/tools && brew install harness-memory`), then `brew services start postgresql@16`, `createdb memory`, `brew services start harness-memory`, and `memory init`.
- If `memoryd` is down: tell the user to start it with `brew services start harness-memory`, or to set `MEMORY_URL` to a remote listener (compose/helm). Re-run `memory status` until it is up.
- Default local URL is `http://127.0.0.1:8741`. If they use a remote `memoryd`, store that base URL (no trailing slash) as `MEMORY_URL`. Otherwise store `http://127.0.0.1:8741`.

### 2. Choose the harness and mint a token

Ask which harness this install is for if it is not obvious (Claude Code → `claude`, Grok → `grok`).

`memory token create` needs an admin token from `memory init` (or `MEMORY_TOKEN` already pointing at admin). If create fails with 401, tell the user to export the admin token from `memory init` first.

Run one of:

```bash
memory token create --harness claude
memory token create --harness grok
```

The plaintext token is shown **once**. Store it as `MEMORY_TOKEN`. Give each harness its own token — never the admin token.

### 3. Write to ~/.mcp.json

Use Python to read `~/.mcp.json` (create it if missing), set the env vars under the `harness-memory` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("harness-memory", {}).setdefault("env", {}).update({
    "MEMORY_URL": "<value from step 1>",
    "MEMORY_TOKEN": "<value from step 2>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 4. Confirm and prompt reload

Say: "Harness memory credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

Remind them the librarian skill will `recall` at session start, and that inbox accept/reject is CLI-only (`memory inbox`, then `memory accept <id>` / `memory reject <id>` with the admin token).

## Notes

- Never echo the token back after saving.
- Overwrite existing values if the key already exists.
- If `~/.mcp.json` is missing, create it with the full structure.
- Do not write tokens, passwords, or other secrets into memory bodies.
