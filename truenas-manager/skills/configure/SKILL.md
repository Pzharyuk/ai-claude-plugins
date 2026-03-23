# Configure: truenas-manager

Walk the user through setting up TrueNAS credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the TrueNAS URL
Say: "Please paste your TrueNAS server URL (e.g. `https://truenas.local` or `http://192.168.1.100`). This is the address you use to access the TrueNAS web UI."

Store the value as `TRUENAS_URL`.

### 2. Ask for the API Key
Say: "Now please paste your TrueNAS API key. You can generate one in the TrueNAS UI by clicking your user icon in the top-right corner → API Keys → Add."

Store the value as `TRUENAS_API_KEY`.

### 3. Ask about SSL verification
Say: "Does your TrueNAS server use a self-signed certificate? If yes, I'll disable SSL verification. If it uses a trusted CA cert, I'll enable verification."

Set `TRUENAS_VERIFY_SSL` to `true` or `false` accordingly.

### 4. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create it if missing), set the env vars under the `truenas-manager` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("truenas-manager", {}).setdefault("env", {}).update({
    "TRUENAS_URL": "<value from step 1>",
    "TRUENAS_API_KEY": "<value from step 2>",
    "TRUENAS_VERIFY_SSL": "<value from step 3>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 5. Confirm and prompt reload
Say: "TrueNAS credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the API key back after saving.
- Overwrite existing values if the key already exists.
- If `~/.mcp.json` is missing, create it with the full structure.
