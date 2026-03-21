# ai-claude-plugins

A collection of Claude Cowork plugins for self-hosted infrastructure management.

## Plugins

| Plugin | Description |
|--------|-------------|
| [proxmox-manager](./proxmox-manager) | Full Proxmox VE management — VMs, snapshots, storage, Kubernetes provisioning |
| [cloudflare-extended](https://github.com/Pzharyuk/cloudflare-extended) | Cloudflare DNS, Tunnels, zones, and cache management |

## Installing a Plugin

Each plugin directory contains a `.plugin` file (or can be packaged from source). Install via the Cowork plugins interface.

## Contributing

PRs welcome. Each plugin lives in its own directory with a standard structure:

```
plugin-name/
├── .claude-plugin/plugin.json   # plugin manifest
├── .mcp.json                    # MCP server definition
├── server/                      # MCP server code
├── skills/                      # Claude skills
└── README.md
```
