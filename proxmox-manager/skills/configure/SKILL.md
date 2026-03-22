# Configure: proxmox-manager

Walk the user through setting up Proxmox VE credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the Proxmox Host
Say: "What is the hostname or IP address of your Proxmox server? (e.g. 192.168.1.100 or pve.local)"

Store as `PROXMOX_HOST`.

### 2. Ask for the API Token ID
Say: "What is your Proxmox API Token ID? Format: user@realm!tokenname (e.g. root@pam!claude). Create one in Proxmox under Datacenter → Permissions → API Tokens."

Store as `PROXMOX_TOKEN_ID`.

### 3. Ask for the API Token Secret
Say: "Please paste your Proxmox API Token Secret — this was shown once when you created the token."

Store as `PROXMOX_TOKEN_SECRET`.

### 4. Ask for the Node Name
Say: "What is your Proxmox node name? (e.g. pve, node1 — visible in the Proxmox web UI sidebar)"

Store as `PROXMOX_NODE`.

### 5. Ask about SSL verification
Say: "Should SSL certificates be verified? Most homelabs use self-signed certs. Enter true or false (default: false)."

Default to `false` if unsure. Store as `PROXMOX_VERIFY_SSL`.

### 6. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create if missing), set the env vars under the `proxmox-manager` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("proxmox-manager", {}).setdefault("env", {}).update({
    "PROXMOX_HOST": "<value from step 1>",
    "PROXMOX_TOKEN_ID": "<value from step 2>",
    "PROXMOX_TOKEN_SECRET": "<value from step 3>",
    "PROXMOX_NODE": "<value from step 4>",
    "PROXMOX_VERIFY_SSL": "<value from step 5>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 7. Confirm and prompt reload
Say: "Proxmox credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the token secret back after saving.
- Overwrite existing values if the keys already exist.
- If `~/.mcp.json` is missing, create it with the full structure.
