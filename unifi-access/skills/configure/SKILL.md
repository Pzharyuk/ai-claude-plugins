# Configure: unifi-access

Walk the user through setting up UniFi Access controller credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the UniFi Host
Say: "What is the URL of your UniFi Access controller? (e.g. https://192.168.1.1 or https://unifi.local)"

Store as `UNIFI_HOST`.

### 2. Ask for the Username
Say: "What is your UniFi Access admin username?"

Store as `UNIFI_USERNAME`.

### 3. Ask for the Password
Say: "What is your UniFi Access admin password?"

Store as `UNIFI_PASSWORD`.

### 4. Ask about SSL verification
Say: "Should SSL certificates be verified? Most homelabs use self-signed certs. Enter true or false (default: false)."

Default to `false` if unsure. Store as `UNIFI_VERIFY_SSL`.

### 5. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create if missing), set the env vars under the `unifi-access` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("unifi-access", {}).setdefault("env", {}).update({
    "UNIFI_HOST": "<value from step 1>",
    "UNIFI_USERNAME": "<value from step 2>",
    "UNIFI_PASSWORD": "<value from step 3>",
    "UNIFI_VERIFY_SSL": "<value from step 4>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 6. Confirm and prompt reload
Say: "UniFi Access credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the password back after saving.
- Overwrite existing values if the keys already exist.
- If `~/.mcp.json` is missing, create it with the full structure.
