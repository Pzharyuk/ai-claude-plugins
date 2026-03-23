# Configure: hashicorp-vault

Walk the user through setting up Vault credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the Vault Address
Say: "Please paste your Vault server address (e.g. `https://vault.example.com:8200`). This is the `VAULT_ADDR` your Vault CLI uses."

Store the value as `VAULT_ADDR`.

### 2. Ask for the Vault Token
Say: "Now please paste your Vault authentication token. You can generate one with `vault token create -policy=admin` or use the root token from `vault operator init`. The token needs access to the secrets engines, auth methods, and policies you want to manage."

Store the value as `VAULT_TOKEN`.

### 3. Ask about SSL verification
Say: "Does your Vault server use a self-signed certificate? If yes, I'll disable SSL verification. If it uses a trusted CA cert, I'll enable verification."

Set `VAULT_VERIFY_SSL` to `true` or `false` accordingly.

### 4. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create it if missing), set the env vars under the `hashicorp-vault` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("hashicorp-vault", {}).setdefault("env", {}).update({
    "VAULT_ADDR": "<value from step 1>",
    "VAULT_TOKEN": "<value from step 2>",
    "VAULT_VERIFY_SSL": "<value from step 3>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 5. Confirm and prompt reload
Say: "Vault credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the Vault token back after saving.
- Overwrite existing values if the key already exists.
- If `~/.mcp.json` is missing, create it with the full structure.
