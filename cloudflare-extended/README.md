# Cloudflare Extended Plugin

Full Cloudflare account management from Claude — covering DNS records, Cloudflare Tunnels, zone settings, and cache purging.

## Overview

This plugin adds a local MCP server that connects directly to the Cloudflare REST API, filling the gaps left by the standard Cloudflare connector (which covers Workers, D1, KV, R2, and Hyperdrive but not DNS or Tunnels).

## Components

| Component | Purpose |
|-----------|---------|
| MCP Server (`cloudflare-extended`) | Wraps the Cloudflare REST API for DNS and Tunnel tools |
| Skill: `dns-management` | Guides for listing, creating, updating, and deleting DNS records |
| Skill: `tunnel-management` | Guides for creating and managing Cloudflare Tunnels |

## Available Tools

### Zones
- `cf_list_zones` — list all domains on the account
- `cf_get_zone` — get details and settings for a zone

### DNS
- `cf_list_dns_records` — list records for a zone (filterable by type/name)
- `cf_create_dns_record` — add a new record
- `cf_update_dns_record` — modify an existing record
- `cf_delete_dns_record` — remove a record

### Tunnels
- `cf_list_tunnels` — list all Cloudflare Tunnels
- `cf_get_tunnel` — get details of a tunnel
- `cf_create_tunnel` — create a new tunnel
- `cf_delete_tunnel` — delete a tunnel
- `cf_get_tunnel_token` — retrieve the connector token for `cloudflared`
- `cf_get_tunnel_config` — get current ingress configuration
- `cf_put_tunnel_config` — set ingress rules

### Cache
- `cf_purge_cache` — purge all or specific cached files/tags for a zone

## Setup

### 1. Create a Cloudflare API Token

Go to [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) and create a token with these permissions:

| Resource | Permission |
|----------|-----------|
| Zone → DNS | Edit |
| Zone → Zone | Read |
| Zone → Cache Purge | Purge |
| Account → Cloudflare Tunnel | Edit |
| Account → Account Settings | Read |

Scope it to your account (and specific zones if you want to restrict access).

### 2. Set Environment Variables

Add the following to your shell profile or Claude's environment config:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token-here"
export CLOUDFLARE_ACCOUNT_ID="7b7befa80b78f05c25edb8604c474274"
```

`CLOUDFLARE_ACCOUNT_ID` is required for Tunnel operations. Your account ID is `7b7befa80b78f05c25edb8604c474274`.

### 3. Install the Plugin

Install `cloudflare-extended.plugin` via the Cowork plugins interface.

## Usage Examples

- "List all DNS records for example.com"
- "Add an A record pointing api.example.com to 1.2.3.4"
- "Create a Cloudflare Tunnel called homelab"
- "Configure the homelab tunnel to route app.example.com to localhost:3000"
- "Get the tunnel token for homelab so I can run cloudflared"
- "Purge the cache for example.com"
