# Configure: cloudflare-extended

Collect the user's Cloudflare credentials and write them to the plugin env file so the MCP server can authenticate.

## Steps

1. **Ask for the API Token**
   - Prompt: "Please paste your Cloudflare API Token. You can create one at https://dash.cloudflare.com/profile/api-tokens — make sure it has Zone Read and DNS Edit permissions."
   - Store as `CLOUDFLARE_API_TOKEN`

2. **Ask for the Account ID**
   - Prompt: "Now please paste your Cloudflare Account ID. You can find it on the right sidebar of your Cloudflare dashboard homepage."
   - Store as `CLOUDFLARE_ACCOUNT_ID`

3. **Write the env file**
   - Write both values to `~/.claude/mcp-env/cloudflare-extended/.env`:
     ```
     CLOUDFLARE_API_TOKEN=<value>
     CLOUDFLARE_ACCOUNT_ID=<value>
     ```
   - Create the directory if it doesn't exist: `mkdir -p ~/.claude/mcp-env/cloudflare-extended`

4. **Confirm success**
   - Tell the user: "Cloudflare credentials saved. Please restart Claude Code (or run `/reload-plugins`) for the changes to take effect."

## Notes

- Never echo the API token back to the user after saving it.
- If the file already exists, overwrite it completely with the new values.
- The env file is read by Claude Code at startup and injected into the MCP server process.
