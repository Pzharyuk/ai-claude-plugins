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

### Option A — Marketplace (recommended)

This repo is a plugin marketplace. Add it once and install any plugin from it directly in Claude Code or Cowork.

**1. Add the marketplace**

In Claude Code or Cowork, run:

```
/plugin marketplace add Pzharyuk/ai-claude-plugins
```

**2. Install a plugin**

```
/plugin install cloudflare-extended@ai-claude-plugins
/plugin install proxmox-manager@ai-claude-plugins
/plugin install homeassistant-manager@ai-claude-plugins
/plugin install unifi-network@ai-claude-plugins
/plugin install unifi-protect@ai-claude-plugins
/plugin install unifi-access@ai-claude-plugins
```

**3. Install server dependencies (first run only)**

Each plugin runs a local Node.js MCP server. After installing, run:

```bash
cd <plugin-install-path>/server
npm install
```

> **Requires Node.js.** Download from [nodejs.org](https://nodejs.org) if needed.

**4. Set environment variables**

Each plugin needs credentials set in the Cowork plugin settings panel. See the individual plugin READMEs for the full list of required env vars.

---

### Option B — Install from file

Download the `.plugin` file directly from the plugin's directory in this repo, then install it via the Cowork plugins panel using **Install from file**.

---

### Option C — Build from source

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
