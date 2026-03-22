# Configure: cloudflare-extended

Walk the user through setting up Cloudflare credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the API Token
Say: "Please paste your Cloudflare API Token. You can create one at https://dash.cloudflare.com/profile/api-tokens with these permissions: Zone DNS (Edit), Zone (Read), Cache Purge (Purge), Cloudflare Tunnel (Edit), Account Settings (Read)."

Store the value as `CLOUDFLARE_API_TOKEN`.

### 2. Ask for the Account ID
Say: "Now please paste your Cloudflare Account ID. You can find it on the right sidebar of your Cloudflare dashboard homepage."

Store the value as `CLOUDFLARE_ACCOUNT_ID`.

### 3. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create it if missing), set the env vars under the `cloudflare-extended` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("cloudflare-extended", {}).setdefault("env", {}).update({
    "CLOUDFLARE_API_TOKEN": "<value from step 1>",
    "CLOUDFLARE_ACCOUNT_ID": "<value from step 2>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 4. Confirm and prompt reload
Say: "Cloudflare credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the API token back after saving.
- Overwrite existing values if the key already exists.
- If `~/.mcp.json` is missing, create it with the full structure.
