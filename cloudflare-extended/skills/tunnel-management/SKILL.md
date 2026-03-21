---
name: tunnel-management
description: >
  Use this skill when the user asks to "manage tunnels", "create a Cloudflare
  Tunnel", "set up a tunnel", "list tunnels", "delete a tunnel", "configure
  tunnel ingress", "get tunnel token", "expose a local service", "run
  cloudflared", or any task involving Cloudflare Tunnel (formerly Argo Tunnel).
metadata:
  version: "0.1.0"
---

# Cloudflare Tunnel Management

Use the `cloudflare-extended` MCP server tools to create and manage Cloudflare Tunnels.

## What is a Cloudflare Tunnel?

A Cloudflare Tunnel creates an outbound-only connection from a server to Cloudflare's network, allowing you to expose internal services without opening inbound firewall ports. The `cloudflared` daemon runs on the origin server and maintains the connection.

## Workflows

### Listing tunnels

Call `cf_list_tunnels`. Show name, ID, status, and active connections. Filter by name if the user specifies one.

### Creating a tunnel

1. Ask for a tunnel name (descriptive, e.g. `homelab-web`, `office-api`).
2. Call `cf_create_tunnel`. A secret is auto-generated if not provided.
3. Show the tunnel ID — the user will need it to configure ingress and run `cloudflared`.
4. Offer to configure ingress rules next (see below).

### Configuring ingress rules

Ingress rules map hostnames/paths to backend services. The last rule must be a catch-all.

1. Ask the user: what hostname(s) should route to what service(s)?
2. Build the ingress array accordingly.
3. Call `cf_put_tunnel_config` with the ingress array.
4. Remind the user they also need a DNS CNAME pointing the hostname to `<tunnel-id>.cfargotunnel.com` — offer to create it using the DNS tools.

### Getting the tunnel token

Call `cf_get_tunnel_token`. The token is used to run `cloudflared`:

```bash
cloudflared tunnel run --token <TOKEN>
```

Or as a Docker container:

```bash
docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <TOKEN>
```

### Deleting a tunnel

1. Confirm the tunnel name/ID with the user.
2. Warn: active connections will be dropped.
3. Call `cf_delete_tunnel`.

## Ingress Rule Format

See `references/tunnel-ingress.md` for full ingress configuration reference.

## Connecting Tunnel to DNS

After creating a tunnel and configuring ingress, the user must create DNS records pointing their hostnames to the tunnel. For each hostname in the ingress rules:

- Create a CNAME record: `hostname → <tunnel-id>.cfargotunnel.com`
- Set proxied: `true`

Offer to do this automatically using `cf_create_dns_record`.
