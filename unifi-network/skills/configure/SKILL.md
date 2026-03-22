# Configure: unifi-network

Collect the user's UniFi Network controller credentials and write them to the plugin env file so the MCP server can authenticate.

## Steps

1. **Ask for the UniFi Host**
   - Prompt: "What is the URL of your UniFi Network controller? (e.g. https://192.168.1.1 or https://unifi.local)"
   - Store as `UNIFI_HOST`

2. **Ask for the Username**
   - Prompt: "What is your UniFi controller admin username?"
   - Store as `UNIFI_USERNAME`

3. **Ask for the Password**
   - Prompt: "What is your UniFi controller admin password?"
   - Store as `UNIFI_PASSWORD`

4. **Ask for the Site ID**
   - Prompt: "What is your UniFi site ID? If you only have one site, this is usually 'default'."
   - Default to `default` if the user is unsure
   - Store as `UNIFI_SITE`

5. **Ask about SSL verification**
   - Prompt: "Should SSL certificates be verified? Most homelabs use self-signed certs, so this is usually false. Enter true or false."
   - Default to `false` if the user is unsure
   - Store as `UNIFI_VERIFY_SSL`

6. **Write the env file**
   - Write all values to `~/.claude/mcp-env/unifi-network/.env`:
     ```
     UNIFI_HOST=<value>
     UNIFI_USERNAME=<value>
     UNIFI_PASSWORD=<value>
     UNIFI_SITE=<value>
     UNIFI_VERIFY_SSL=<value>
     ```
   - Create the directory if it doesn't exist: `mkdir -p ~/.claude/mcp-env/unifi-network`

7. **Confirm success**
   - Tell the user: "UniFi Network credentials saved. Please restart Claude Code (or run `/reload-plugins`) for the changes to take effect."

## Notes

- Never echo the password back to the user after saving it.
- If the file already exists, overwrite it completely with the new values.
