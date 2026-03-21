#!/usr/bin/env node
/**
 * Cloudflare Extended MCP Server
 * Provides DNS and Tunnel management via the Cloudflare REST API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CF_API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!TOKEN) {
  console.error("Error: CLOUDFLARE_API_TOKEN environment variable is required");
  process.exit(1);
}

// ─── Cloudflare API helper ────────────────────────────────────────────────────

async function cfRequest(method, path, body) {
  const url = `${CF_API}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();

  if (!data.success) {
    const errs = (data.errors || []).map((e) => `[${e.code}] ${e.message}`).join("; ");
    throw new Error(`Cloudflare API error: ${errs}`);
  }
  return data;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  // ── Zones ──
  {
    name: "cf_list_zones",
    description: "List all zones (domains) in the Cloudflare account",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by domain name (optional)" },
      },
    },
  },

  // ── DNS ──
  {
    name: "cf_list_dns_records",
    description: "List DNS records for a zone",
    inputSchema: {
      type: "object",
      required: ["zone_id"],
      properties: {
        zone_id: { type: "string", description: "Zone ID" },
        type: { type: "string", description: "Record type filter (A, CNAME, MX, TXT, etc.)" },
        name: { type: "string", description: "Record name filter" },
      },
    },
  },
  {
    name: "cf_create_dns_record",
    description: "Create a new DNS record in a zone",
    inputSchema: {
      type: "object",
      required: ["zone_id", "type", "name", "content"],
      properties: {
        zone_id: { type: "string" },
        type: { type: "string", description: "A, AAAA, CNAME, MX, TXT, NS, SRV, etc." },
        name: { type: "string", description: "DNS record name (e.g. subdomain.example.com)" },
        content: { type: "string", description: "Record content (IP, hostname, text, etc.)" },
        ttl: { type: "number", description: "TTL in seconds (1 = auto)" },
        proxied: { type: "boolean", description: "Whether to proxy through Cloudflare" },
        priority: { type: "number", description: "Priority (for MX/SRV records)" },
      },
    },
  },
  {
    name: "cf_update_dns_record",
    description: "Update an existing DNS record",
    inputSchema: {
      type: "object",
      required: ["zone_id", "record_id"],
      properties: {
        zone_id: { type: "string" },
        record_id: { type: "string" },
        type: { type: "string" },
        name: { type: "string" },
        content: { type: "string" },
        ttl: { type: "number" },
        proxied: { type: "boolean" },
      },
    },
  },
  {
    name: "cf_delete_dns_record",
    description: "Delete a DNS record",
    inputSchema: {
      type: "object",
      required: ["zone_id", "record_id"],
      properties: {
        zone_id: { type: "string" },
        record_id: { type: "string" },
      },
    },
  },

  // ── Tunnels ──
  {
    name: "cf_list_tunnels",
    description: "List all Cloudflare Tunnels in the account",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by tunnel name" },
        is_deleted: { type: "boolean", description: "Include deleted tunnels" },
      },
    },
  },
  {
    name: "cf_get_tunnel",
    description: "Get details of a specific Cloudflare Tunnel",
    inputSchema: {
      type: "object",
      required: ["tunnel_id"],
      properties: {
        tunnel_id: { type: "string" },
      },
    },
  },
  {
    name: "cf_create_tunnel",
    description: "Create a new Cloudflare Tunnel",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Tunnel name" },
        tunnel_secret: {
          type: "string",
          description: "Optional base64-encoded 32-byte secret. Auto-generated if omitted.",
        },
      },
    },
  },
  {
    name: "cf_delete_tunnel",
    description: "Delete a Cloudflare Tunnel",
    inputSchema: {
      type: "object",
      required: ["tunnel_id"],
      properties: {
        tunnel_id: { type: "string" },
      },
    },
  },
  {
    name: "cf_get_tunnel_token",
    description: "Get the connector token for running cloudflared for a tunnel",
    inputSchema: {
      type: "object",
      required: ["tunnel_id"],
      properties: {
        tunnel_id: { type: "string" },
      },
    },
  },
  {
    name: "cf_get_tunnel_config",
    description: "Get the ingress configuration for a Cloudflare Tunnel",
    inputSchema: {
      type: "object",
      required: ["tunnel_id"],
      properties: {
        tunnel_id: { type: "string" },
      },
    },
  },
  {
    name: "cf_put_tunnel_config",
    description: "Set the ingress configuration for a Cloudflare Tunnel",
    inputSchema: {
      type: "object",
      required: ["tunnel_id", "ingress"],
      properties: {
        tunnel_id: { type: "string" },
        ingress: {
          type: "array",
          description: "Array of ingress rules. Last entry must be a catch-all (no hostname/path).",
          items: {
            type: "object",
            properties: {
              hostname: { type: "string" },
              path: { type: "string" },
              service: { type: "string", description: "e.g. http://localhost:8080" },
            },
          },
        },
      },
    },
  },

  // ── Zone Settings ──
  {
    name: "cf_get_zone",
    description: "Get details and settings for a specific zone",
    inputSchema: {
      type: "object",
      required: ["zone_id"],
      properties: {
        zone_id: { type: "string" },
      },
    },
  },
  {
    name: "cf_purge_cache",
    description: "Purge cached files for a zone (purge everything or specific files/tags)",
    inputSchema: {
      type: "object",
      required: ["zone_id"],
      properties: {
        zone_id: { type: "string" },
        purge_everything: { type: "boolean", description: "Purge all cached content" },
        files: { type: "array", items: { type: "string" }, description: "Specific URLs to purge" },
        tags: { type: "array", items: { type: "string" }, description: "Cache tags to purge" },
      },
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function callTool(name, args) {
  const accountId = ACCOUNT_ID;

  switch (name) {
    // Zones
    case "cf_list_zones": {
      const qs = args.name ? `?name=${encodeURIComponent(args.name)}` : "";
      const data = await cfRequest("GET", `/zones${qs}`);
      return data.result.map((z) => ({
        id: z.id,
        name: z.name,
        status: z.status,
        nameservers: z.name_servers,
        plan: z.plan?.name,
      }));
    }

    case "cf_get_zone": {
      const data = await cfRequest("GET", `/zones/${args.zone_id}`);
      return data.result;
    }

    // DNS
    case "cf_list_dns_records": {
      const params = new URLSearchParams();
      if (args.type) params.set("type", args.type);
      if (args.name) params.set("name", args.name);
      const qs = params.toString() ? `?${params}` : "";
      const data = await cfRequest("GET", `/zones/${args.zone_id}/dns_records${qs}`);
      return data.result.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        content: r.content,
        ttl: r.ttl,
        proxied: r.proxied,
        modified_on: r.modified_on,
      }));
    }

    case "cf_create_dns_record": {
      const body = {
        type: args.type,
        name: args.name,
        content: args.content,
        ttl: args.ttl ?? 1,
      };
      if (args.proxied !== undefined) body.proxied = args.proxied;
      if (args.priority !== undefined) body.priority = args.priority;
      const data = await cfRequest("POST", `/zones/${args.zone_id}/dns_records`, body);
      return data.result;
    }

    case "cf_update_dns_record": {
      const body = {};
      if (args.type) body.type = args.type;
      if (args.name) body.name = args.name;
      if (args.content) body.content = args.content;
      if (args.ttl !== undefined) body.ttl = args.ttl;
      if (args.proxied !== undefined) body.proxied = args.proxied;
      const data = await cfRequest(
        "PATCH",
        `/zones/${args.zone_id}/dns_records/${args.record_id}`,
        body
      );
      return data.result;
    }

    case "cf_delete_dns_record": {
      const data = await cfRequest(
        "DELETE",
        `/zones/${args.zone_id}/dns_records/${args.record_id}`
      );
      return { deleted: data.result.id };
    }

    // Tunnels
    case "cf_list_tunnels": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const params = new URLSearchParams({ is_deleted: String(args.is_deleted ?? false) });
      if (args.name) params.set("name", args.name);
      const data = await cfRequest("GET", `/accounts/${accountId}/cfd_tunnel?${params}`);
      return data.result.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        created_at: t.created_at,
        connections: t.connections_count ?? t.conns_active_at,
      }));
    }

    case "cf_get_tunnel": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const data = await cfRequest("GET", `/accounts/${accountId}/cfd_tunnel/${args.tunnel_id}`);
      return data.result;
    }

    case "cf_create_tunnel": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const body = { name: args.name, tunnel_secret: args.tunnel_secret };
      if (!body.tunnel_secret) {
        // Generate a random 32-byte secret if not provided
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        body.tunnel_secret = Buffer.from(bytes).toString("base64");
      }
      const data = await cfRequest("POST", `/accounts/${accountId}/cfd_tunnel`, body);
      return data.result;
    }

    case "cf_delete_tunnel": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const data = await cfRequest("DELETE", `/accounts/${accountId}/cfd_tunnel/${args.tunnel_id}`);
      return data.result;
    }

    case "cf_get_tunnel_token": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const data = await cfRequest(
        "GET",
        `/accounts/${accountId}/cfd_tunnel/${args.tunnel_id}/token`
      );
      return { token: data.result };
    }

    case "cf_get_tunnel_config": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const data = await cfRequest(
        "GET",
        `/accounts/${accountId}/cfd_tunnel/${args.tunnel_id}/configurations`
      );
      return data.result;
    }

    case "cf_put_tunnel_config": {
      if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for tunnel operations");
      const body = { config: { ingress: args.ingress } };
      const data = await cfRequest(
        "PUT",
        `/accounts/${accountId}/cfd_tunnel/${args.tunnel_id}/configurations`,
        body
      );
      return data.result;
    }

    case "cf_purge_cache": {
      const body = {};
      if (args.purge_everything) body.purge_everything = true;
      if (args.files) body.files = args.files;
      if (args.tags) body.tags = args.tags;
      const data = await cfRequest("POST", `/zones/${args.zone_id}/purge_cache`, body);
      return data.result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "cloudflare-extended", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
