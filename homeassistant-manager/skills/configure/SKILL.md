# Configure: homeassistant-manager

Collect the user's Home Assistant credentials and write them to the plugin env file so the MCP server can authenticate.

## Steps

1. **Ask for the Home Assistant URL**
   - Prompt: "What is the URL of your Home Assistant instance? (e.g. http://homeassistant.local:8123 or https://ha.yourdomain.com)"
   - Store as `HA_URL`

2. **Ask for the Long-Lived Access Token**
   - Prompt: "Please paste your Home Assistant Long-Lived Access Token. You can create one in Home Assistant under your Profile → Long-Lived Access Tokens (scroll to the bottom)."
   - Store as `HA_TOKEN`

3. **Write the env file**
   - Write both values to `~/.claude/mcp-env/homeassistant-manager/.env`:
     ```
     HA_URL=<value>
     HA_TOKEN=<value>
     ```
   - Create the directory if it doesn't exist: `mkdir -p ~/.claude/mcp-env/homeassistant-manager`

4. **Confirm success**
   - Tell the user: "Home Assistant credentials saved. Please restart Claude Code (or run `/reload-plugins`) for the changes to take effect."

## Notes

- Never echo the token back to the user after saving it.
- If the file already exists, overwrite it completely with the new values.
