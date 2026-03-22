# Configure: homeassistant-manager

Walk the user through setting up Home Assistant credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the Home Assistant URL
Say: "What is the URL of your Home Assistant instance? (e.g. http://homeassistant.local:8123 or https://ha.yourdomain.com)"

Store as `HA_URL`.

### 2. Ask for the Long-Lived Access Token
Say: "Please paste your Home Assistant Long-Lived Access Token. Create one in Home Assistant under your Profile → Long-Lived Access Tokens (scroll to the bottom of the page)."

Store as `HA_TOKEN`.

### 3. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create if missing), set the env vars under the `homeassistant-manager` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("homeassistant-manager", {}).setdefault("env", {}).update({
    "HA_URL": "<value from step 1>",
    "HA_TOKEN": "<value from step 2>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 4. Confirm and prompt reload
Say: "Home Assistant credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the token back after saving.
- Overwrite existing values if the keys already exist.
- If `~/.mcp.json` is missing, create it with the full structure.
