# Configure: proxmox-manager

Collect the user's Proxmox VE credentials and write them to the plugin env file so the MCP server can authenticate.

## Steps

1. **Ask for the Proxmox Host**
   - Prompt: "What is the hostname or IP address of your Proxmox server? (e.g. 192.168.1.100 or pve.local)"
   - Store as `PROXMOX_HOST`

2. **Ask for the API Token ID**
   - Prompt: "What is your Proxmox API Token ID? It should be in the format user@realm!tokenname (e.g. root@pam!claude). You can create one in Proxmox under Datacenter → Permissions → API Tokens."
   - Store as `PROXMOX_TOKEN_ID`

3. **Ask for the API Token Secret**
   - Prompt: "Please paste your Proxmox API Token Secret (shown once when you created the token)."
   - Store as `PROXMOX_TOKEN_SECRET`

4. **Ask for the Node Name**
   - Prompt: "What is the name of your Proxmox node? (e.g. pve, node1 — visible in the Proxmox web UI sidebar)"
   - Store as `PROXMOX_NODE`

5. **Ask about SSL verification**
   - Prompt: "Should SSL certificates be verified? Most homelabs use self-signed certs, so this is usually false. Enter true or false."
   - Default to `false` if the user is unsure
   - Store as `PROXMOX_VERIFY_SSL`

6. **Write the env file**
   - Write all values to `~/.claude/mcp-env/proxmox-manager/.env`:
     ```
     PROXMOX_HOST=<value>
     PROXMOX_TOKEN_ID=<value>
     PROXMOX_TOKEN_SECRET=<value>
     PROXMOX_NODE=<value>
     PROXMOX_VERIFY_SSL=<value>
     ```
   - Create the directory if it doesn't exist: `mkdir -p ~/.claude/mcp-env/proxmox-manager`

7. **Confirm success**
   - Tell the user: "Proxmox credentials saved. Please restart Claude Code (or run `/reload-plugins`) for the changes to take effect."

## Notes

- Never echo the token secret back to the user after saving it.
- If the file already exists, overwrite it completely with the new values.
