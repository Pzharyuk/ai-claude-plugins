# ai-claude-plugins

A collection of Claude Cowork plugins for self-hosted infrastructure management. Each plugin is flexible and reusable — configure it with your own credentials and it works with any compatible system.

## Plugins

| Plugin | Description | Tools |
|--------|-------------|-------|
| [cloudflare-extended](./cloudflare-extended) | DNS records, Tunnels, zones, cache purge | 12 |
| [proxmox-manager](./proxmox-manager) | VMs, snapshots, storage, Kubernetes provisioning | 22 |
| [homeassistant-manager](./homeassistant-manager) | Devices, automations, scenes, scripts, notifications | 30 |
| [unifi-network](./unifi-network) | Devices, clients, WiFi, VLANs, port forwarding, firewall | 22 |
| [unifi-protect](./unifi-protect) | Cameras, events, smart detection, recordings, snapshots | 12 |
| [unifi-access](./unifi-access) | Doors, users, groups, PIN/NFC credentials, activity logs | 21 |

## Installation

### 1. Download the `.plugin` file

Each plugin has a pre-built `.plugin` file in its directory (it's a zip archive). Download it from GitHub or build from source (see below).

### 2. Install in Claude Cowork

1. Open the **Plugins** panel — click the puzzle piece icon in the Cowork sidebar
2. Click **Install from file** and select the downloaded `.plugin` file
3. Enter the required environment variables when prompted
   - Each plugin's `README.md` lists all the env vars you need
4. The plugin activates immediately — no restart needed

### 3. Install server dependencies (first run only)

After installing, open a terminal and run:

```bash
cd <plugin-install-path>/server
npm install
```

> **Requires Node.js.** If not installed, download from [nodejs.org](https://nodejs.org).

## Building a Plugin from Source

Clone this repo, then for any plugin:

```bash
git clone https://github.com/Pzharyuk/ai-claude-plugins.git
cd ai-claude-plugins/<plugin-name>
npm install --prefix server
zip -r ../<plugin-name>.plugin . -x "*/node_modules/*"
```

Then install the resulting `.plugin` file via Cowork as above.

## Plugin Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json      # plugin manifest (name, description, env vars)
├── .mcp.json            # MCP server definition
├── server/
│   ├── index.js         # MCP server (Node.js ES module)
│   └── package.json
├── skills/
│   └── <skill-name>/
│       └── SKILL.md     # Claude skill guide (tools, workflows, tips)
└── README.md
```

## Contributing

PRs welcome. Follow the structure above. Each skill's `SKILL.md` should document all tools, common workflows, and any gotchas.
