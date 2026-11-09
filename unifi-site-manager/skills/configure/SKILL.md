# Configure: unifi-site-manager

Bind the UniFi Site Manager cloud API key for this plugin. This is not the `unifi-network` local controller login. Do not reinstall or reconfigure `unifi-network` as part of this setup.

## Do not collect the key

Do not paste the API key into chat. Do not ask the user to paste it. If a key shows up in the transcript, tell the user to revoke it at unifi.ui.com and create a new one. Do not repeat the key, do not write it into `~/.mcp.json`, and do not put it in a file in the repository. Do not `cat` a key file. Do not pass the key as a command argument.

For a custom MCP host that cannot store the key, Network Engineer stages an owner-only file from the shell that already holds the masked variable and registers `UNIFI_SITE_MANAGER_API_KEY_FILE` as a literal absolute path. The recipe is in the plugin README. Do not run that recipe from a shell that would echo the value, and do not invent a `${UNIFI_SITE_MANAGER_API_KEY}` entry in an AddMcpServer env map. That map is literal. It does not expand shell variables and it does not prompt.

The sanctioned binding in this marketplace is:

- `setup.env.UNIFI_SITE_MANAGER_API_KEY` with `"secret": true` in `.claude-plugin/plugin.json`
- `.mcp.json` passing that through as `${UNIFI_SITE_MANAGER_API_KEY}`

The plugin host substitutes the secret into the MCP server process. The agent does not handle the value.

## Steps

### 1. Confirm which plugin this is

Say that `unifi-site-manager` reads every location from `https://api.ui.com` with an `X-API-KEY` header. `unifi-network` stays on `UNIFI_HOST`, `UNIFI_USERNAME`, and `UNIFI_PASSWORD` for one local controller. A local Network integration key (UniFi Network > Integrations) is also a different credential and will not authenticate this plugin.

### 2. Have the operator create the key

Tell them to open [unifi.ui.com](https://unifi.ui.com) and create a Site Manager API key. Official developer docs say: "Generate keys at unifi.ui.com". They should store it in a password manager. You never see it.

Decide with them whether the key is a personal key or an organization key:

- A non-organization key can reach only consoles owned by that key's owner.
- An organization key can reach consoles in the organization.
- Either way, Cloud Connector calls require console firmware `>= 5.0.3`.

### 3. Enter it in the plugin secret field

Tell them to set `UNIFI_SITE_MANAGER_API_KEY` in the plugin settings secret field (the install prompt, or the plugin env editor) and then run `/reload-plugins`.

Do not offer to type the value into `~/.mcp.json` for them. The shipped `.mcp.json` already references the secret by name.

### 4. Install server dependencies

If the server has never been installed:

```bash
cd <plugin-install-path>/server
npm install
```

### 5. Check presence without printing the secret

Only if the operator says they exported the variable in the current shell:

```bash
node -e 'console.log(process.env.UNIFI_SITE_MANAGER_API_KEY ? "set" : "missing")'
```

Print `set` or `missing` and nothing else. The plugin process can have the secret when your shell does not. Do not treat a shell `missing` as proof that the plugin field is empty, and do not call `https://api.ui.com` to test the key unless the operator explicitly asks for a live read after the secret is bound.

## Notes

- Never echo the key.
- Do not add a second env var that copies the key.
- Do not point this server at any host other than `https://api.ui.com`.
