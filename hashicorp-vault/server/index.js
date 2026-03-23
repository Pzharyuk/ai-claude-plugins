#!/usr/bin/env node
/**
 * HashiCorp Vault MCP Server
 * Provides secrets, auth, policy, PKI, and transit management via the Vault HTTP API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";

const VAULT_ADDR = (process.env.VAULT_ADDR || "").replace(/\/+$/, "");
const VAULT_TOKEN = process.env.VAULT_TOKEN;
const VERIFY_SSL = process.env.VAULT_VERIFY_SSL === "true";

if (!VAULT_ADDR) {
  console.error("Error: VAULT_ADDR environment variable is required");
  process.exit(1);
}
if (!VAULT_TOKEN) {
  console.error("Error: VAULT_TOKEN environment variable is required");
  process.exit(1);
}

// ─── Vault API helper ─────────────────────────────────────────────────────────

const agent = VAULT_ADDR.startsWith("https")
  ? new https.Agent({ rejectUnauthorized: VERIFY_SSL })
  : undefined;

async function vaultRequest(method, path, body) {
  const url = `${VAULT_ADDR}/v1${path}`;
  const opts = {
    method,
    headers: {
      "X-Vault-Token": VAULT_TOKEN,
      "Content-Type": "application/json",
    },
  };
  if (agent) opts.dispatcher = agent;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, {
    ...opts,
    ...(agent ? { agent } : {}),
  });

  // Some Vault endpoints return 204 with no body
  if (res.status === 204) return { success: true };

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.ok) return { raw: text };
    throw new Error(`Vault API error (${res.status}): ${text}`);
  }

  if (!res.ok) {
    const errors = (data.errors || []).join("; ");
    throw new Error(`Vault API error (${res.status}): ${errors || text}`);
  }
  return data;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  // ── System / Health ──
  {
    name: "vault_health",
    description: "Check the health status of the Vault server",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vault_seal_status",
    description: "Get the seal status of the Vault server",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vault_leader",
    description: "Get the current leader of the Vault HA cluster",
    inputSchema: { type: "object", properties: {} },
  },

  // ── KV v2 Secrets ──
  {
    name: "vault_kv_read",
    description: "Read a secret from a KV v2 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "path"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path (e.g. 'secret')" },
        path: { type: "string", description: "Secret path within the mount" },
        version: { type: "number", description: "Specific version to read (latest if omitted)" },
      },
    },
  },
  {
    name: "vault_kv_write",
    description: "Write a secret to a KV v2 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "path", "data"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path" },
        path: { type: "string", description: "Secret path within the mount" },
        data: { type: "object", description: "Key-value pairs to store" },
        cas: { type: "number", description: "Check-and-Set version for optimistic locking" },
      },
    },
  },
  {
    name: "vault_kv_delete",
    description: "Soft-delete the latest version of a secret in KV v2",
    inputSchema: {
      type: "object",
      required: ["mount", "path"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path" },
        path: { type: "string", description: "Secret path" },
        versions: {
          type: "array",
          items: { type: "number" },
          description: "Specific versions to delete (deletes latest if omitted)",
        },
      },
    },
  },
  {
    name: "vault_kv_undelete",
    description: "Undelete (restore) soft-deleted versions of a secret in KV v2",
    inputSchema: {
      type: "object",
      required: ["mount", "path", "versions"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path" },
        path: { type: "string", description: "Secret path" },
        versions: { type: "array", items: { type: "number" }, description: "Versions to restore" },
      },
    },
  },
  {
    name: "vault_kv_list",
    description: "List secrets at a path in a KV v2 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path" },
        path: { type: "string", description: "Path to list (root if omitted)" },
      },
    },
  },
  {
    name: "vault_kv_metadata_read",
    description: "Read metadata for a secret in KV v2 (versions, timestamps, custom metadata)",
    inputSchema: {
      type: "object",
      required: ["mount", "path"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path" },
        path: { type: "string", description: "Secret path" },
      },
    },
  },
  {
    name: "vault_kv_metadata_delete",
    description: "Permanently delete all versions and metadata for a secret in KV v2",
    inputSchema: {
      type: "object",
      required: ["mount", "path"],
      properties: {
        mount: { type: "string", description: "KV v2 mount path" },
        path: { type: "string", description: "Secret path" },
      },
    },
  },

  // ── KV v1 Secrets ──
  {
    name: "vault_kv1_read",
    description: "Read a secret from a KV v1 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "path"],
      properties: {
        mount: { type: "string", description: "KV v1 mount path" },
        path: { type: "string", description: "Secret path" },
      },
    },
  },
  {
    name: "vault_kv1_write",
    description: "Write a secret to a KV v1 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "path", "data"],
      properties: {
        mount: { type: "string", description: "KV v1 mount path" },
        path: { type: "string", description: "Secret path" },
        data: { type: "object", description: "Key-value pairs to store" },
      },
    },
  },
  {
    name: "vault_kv1_delete",
    description: "Delete a secret from a KV v1 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "path"],
      properties: {
        mount: { type: "string", description: "KV v1 mount path" },
        path: { type: "string", description: "Secret path" },
      },
    },
  },
  {
    name: "vault_kv1_list",
    description: "List secrets at a path in a KV v1 secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount"],
      properties: {
        mount: { type: "string", description: "KV v1 mount path" },
        path: { type: "string", description: "Path to list (root if omitted)" },
      },
    },
  },

  // ── Secret Engines ──
  {
    name: "vault_list_mounts",
    description: "List all mounted secrets engines",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vault_enable_engine",
    description: "Enable a new secrets engine at a given path",
    inputSchema: {
      type: "object",
      required: ["path", "type"],
      properties: {
        path: { type: "string", description: "Mount path (e.g. 'my-kv')" },
        type: { type: "string", description: "Engine type (kv, pki, transit, database, aws, etc.)" },
        description: { type: "string", description: "Human-friendly description" },
        options: { type: "object", description: "Engine-specific options (e.g. { version: '2' } for KV)" },
      },
    },
  },
  {
    name: "vault_disable_engine",
    description: "Disable (unmount) a secrets engine — destroys all data in it",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Mount path to disable" },
      },
    },
  },
  {
    name: "vault_tune_engine",
    description: "Tune configuration of a mounted secrets engine",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Mount path" },
        default_lease_ttl: { type: "string", description: "Default lease TTL (e.g. '1h')" },
        max_lease_ttl: { type: "string", description: "Max lease TTL (e.g. '24h')" },
        description: { type: "string", description: "Updated description" },
      },
    },
  },

  // ── Auth Methods ──
  {
    name: "vault_list_auth",
    description: "List all enabled authentication methods",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vault_enable_auth",
    description: "Enable a new authentication method at a given path",
    inputSchema: {
      type: "object",
      required: ["path", "type"],
      properties: {
        path: { type: "string", description: "Auth mount path (e.g. 'approle')" },
        type: { type: "string", description: "Auth type (userpass, approle, ldap, oidc, kubernetes, etc.)" },
        description: { type: "string", description: "Human-friendly description" },
      },
    },
  },
  {
    name: "vault_disable_auth",
    description: "Disable an authentication method",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Auth mount path to disable" },
      },
    },
  },

  // ── Policies ──
  {
    name: "vault_list_policies",
    description: "List all ACL policies in Vault",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vault_read_policy",
    description: "Read an ACL policy by name",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Policy name" },
      },
    },
  },
  {
    name: "vault_write_policy",
    description: "Create or update an ACL policy",
    inputSchema: {
      type: "object",
      required: ["name", "policy"],
      properties: {
        name: { type: "string", description: "Policy name" },
        policy: { type: "string", description: "HCL or JSON policy document" },
      },
    },
  },
  {
    name: "vault_delete_policy",
    description: "Delete an ACL policy",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Policy name" },
      },
    },
  },

  // ── Tokens ──
  {
    name: "vault_create_token",
    description: "Create a new Vault token",
    inputSchema: {
      type: "object",
      properties: {
        policies: { type: "array", items: { type: "string" }, description: "List of policy names" },
        ttl: { type: "string", description: "Token TTL (e.g. '1h', '30m')" },
        display_name: { type: "string", description: "Display name for the token" },
        renewable: { type: "boolean", description: "Whether the token is renewable" },
        no_parent: { type: "boolean", description: "Create an orphan token" },
        num_uses: { type: "number", description: "Max number of uses (0 = unlimited)" },
      },
    },
  },
  {
    name: "vault_lookup_token",
    description: "Look up information about a specific token",
    inputSchema: {
      type: "object",
      required: ["token"],
      properties: {
        token: { type: "string", description: "Token to look up" },
      },
    },
  },
  {
    name: "vault_lookup_self",
    description: "Look up information about the current token",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vault_revoke_token",
    description: "Revoke a token and all its children",
    inputSchema: {
      type: "object",
      required: ["token"],
      properties: {
        token: { type: "string", description: "Token to revoke" },
      },
    },
  },
  {
    name: "vault_renew_token",
    description: "Renew a token's lease",
    inputSchema: {
      type: "object",
      required: ["token"],
      properties: {
        token: { type: "string", description: "Token to renew" },
        increment: { type: "string", description: "Requested increment (e.g. '1h')" },
      },
    },
  },

  // ── PKI ──
  {
    name: "vault_pki_issue_cert",
    description: "Issue a new certificate from a PKI secrets engine role",
    inputSchema: {
      type: "object",
      required: ["mount", "role", "common_name"],
      properties: {
        mount: { type: "string", description: "PKI mount path (e.g. 'pki')" },
        role: { type: "string", description: "PKI role name" },
        common_name: { type: "string", description: "Common name for the certificate" },
        alt_names: { type: "string", description: "Comma-separated SANs" },
        ttl: { type: "string", description: "Certificate TTL (e.g. '720h')" },
        ip_sans: { type: "string", description: "Comma-separated IP SANs" },
        format: { type: "string", description: "Output format: pem, der, pem_bundle" },
      },
    },
  },
  {
    name: "vault_pki_list_certs",
    description: "List all certificates issued by a PKI secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount"],
      properties: {
        mount: { type: "string", description: "PKI mount path" },
      },
    },
  },
  {
    name: "vault_pki_read_cert",
    description: "Read a specific certificate from a PKI secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "serial"],
      properties: {
        mount: { type: "string", description: "PKI mount path" },
        serial: { type: "string", description: "Certificate serial number" },
      },
    },
  },
  {
    name: "vault_pki_revoke_cert",
    description: "Revoke a certificate in a PKI secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount", "serial_number"],
      properties: {
        mount: { type: "string", description: "PKI mount path" },
        serial_number: { type: "string", description: "Certificate serial number to revoke" },
      },
    },
  },

  // ── Transit ──
  {
    name: "vault_transit_encrypt",
    description: "Encrypt plaintext using a named Transit encryption key",
    inputSchema: {
      type: "object",
      required: ["mount", "key_name", "plaintext"],
      properties: {
        mount: { type: "string", description: "Transit mount path (e.g. 'transit')" },
        key_name: { type: "string", description: "Encryption key name" },
        plaintext: { type: "string", description: "Base64-encoded plaintext to encrypt" },
      },
    },
  },
  {
    name: "vault_transit_decrypt",
    description: "Decrypt ciphertext using a named Transit encryption key",
    inputSchema: {
      type: "object",
      required: ["mount", "key_name", "ciphertext"],
      properties: {
        mount: { type: "string", description: "Transit mount path" },
        key_name: { type: "string", description: "Encryption key name" },
        ciphertext: { type: "string", description: "Vault ciphertext (vault:v1:...) to decrypt" },
      },
    },
  },
  {
    name: "vault_transit_list_keys",
    description: "List all encryption keys in a Transit secrets engine",
    inputSchema: {
      type: "object",
      required: ["mount"],
      properties: {
        mount: { type: "string", description: "Transit mount path" },
      },
    },
  },
  {
    name: "vault_transit_create_key",
    description: "Create a new encryption key in Transit",
    inputSchema: {
      type: "object",
      required: ["mount", "key_name"],
      properties: {
        mount: { type: "string", description: "Transit mount path" },
        key_name: { type: "string", description: "Name for the new key" },
        type: { type: "string", description: "Key type: aes256-gcm96, chacha20-poly1305, ed25519, ecdsa-p256, rsa-2048, rsa-4096" },
        exportable: { type: "boolean", description: "Whether the key can be exported" },
        allow_plaintext_backup: { type: "boolean", description: "Allow plaintext backup of the key" },
      },
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {
    // System / Health
    case "vault_health": {
      const res = await fetch(`${VAULT_ADDR}/v1/sys/health`, {
        headers: { "X-Vault-Token": VAULT_TOKEN },
        ...(agent ? { agent } : {}),
      });
      return await res.json();
    }

    case "vault_seal_status": {
      const data = await vaultRequest("GET", "/sys/seal-status");
      return data;
    }

    case "vault_leader": {
      const data = await vaultRequest("GET", "/sys/leader");
      return data;
    }

    // KV v2
    case "vault_kv_read": {
      const versionQs = args.version ? `?version=${args.version}` : "";
      const data = await vaultRequest("GET", `/${args.mount}/data/${args.path}${versionQs}`);
      return data.data;
    }

    case "vault_kv_write": {
      const body = { data: args.data };
      if (args.cas !== undefined) body.options = { cas: args.cas };
      const data = await vaultRequest("POST", `/${args.mount}/data/${args.path}`, body);
      return data.data;
    }

    case "vault_kv_delete": {
      if (args.versions && args.versions.length > 0) {
        return await vaultRequest("POST", `/${args.mount}/delete/${args.path}`, {
          versions: args.versions,
        });
      }
      return await vaultRequest("DELETE", `/${args.mount}/data/${args.path}`);
    }

    case "vault_kv_undelete": {
      return await vaultRequest("POST", `/${args.mount}/undelete/${args.path}`, {
        versions: args.versions,
      });
    }

    case "vault_kv_list": {
      const listPath = args.path ? `/${args.mount}/metadata/${args.path}` : `/${args.mount}/metadata`;
      const data = await vaultRequest("LIST", listPath);
      return data.data;
    }

    case "vault_kv_metadata_read": {
      const data = await vaultRequest("GET", `/${args.mount}/metadata/${args.path}`);
      return data.data;
    }

    case "vault_kv_metadata_delete": {
      return await vaultRequest("DELETE", `/${args.mount}/metadata/${args.path}`);
    }

    // KV v1
    case "vault_kv1_read": {
      const data = await vaultRequest("GET", `/${args.mount}/${args.path}`);
      return data.data;
    }

    case "vault_kv1_write": {
      return await vaultRequest("POST", `/${args.mount}/${args.path}`, args.data);
    }

    case "vault_kv1_delete": {
      return await vaultRequest("DELETE", `/${args.mount}/${args.path}`);
    }

    case "vault_kv1_list": {
      const listPath = args.path ? `/${args.mount}/${args.path}` : `/${args.mount}`;
      const data = await vaultRequest("LIST", listPath);
      return data.data;
    }

    // Secret Engines
    case "vault_list_mounts": {
      const data = await vaultRequest("GET", "/sys/mounts");
      return data.data || data;
    }

    case "vault_enable_engine": {
      const body = { type: args.type };
      if (args.description) body.description = args.description;
      if (args.options) body.options = args.options;
      return await vaultRequest("POST", `/sys/mounts/${args.path}`, body);
    }

    case "vault_disable_engine": {
      return await vaultRequest("DELETE", `/sys/mounts/${args.path}`);
    }

    case "vault_tune_engine": {
      const body = {};
      if (args.default_lease_ttl) body.default_lease_ttl = args.default_lease_ttl;
      if (args.max_lease_ttl) body.max_lease_ttl = args.max_lease_ttl;
      if (args.description) body.description = args.description;
      return await vaultRequest("POST", `/sys/mounts/${args.path}/tune`, body);
    }

    // Auth Methods
    case "vault_list_auth": {
      const data = await vaultRequest("GET", "/sys/auth");
      return data.data || data;
    }

    case "vault_enable_auth": {
      const body = { type: args.type };
      if (args.description) body.description = args.description;
      return await vaultRequest("POST", `/sys/auth/${args.path}`, body);
    }

    case "vault_disable_auth": {
      return await vaultRequest("DELETE", `/sys/auth/${args.path}`);
    }

    // Policies
    case "vault_list_policies": {
      const data = await vaultRequest("LIST", "/sys/policies/acl");
      return data.data;
    }

    case "vault_read_policy": {
      const data = await vaultRequest("GET", `/sys/policies/acl/${args.name}`);
      return data.data;
    }

    case "vault_write_policy": {
      return await vaultRequest("PUT", `/sys/policies/acl/${args.name}`, {
        policy: args.policy,
      });
    }

    case "vault_delete_policy": {
      return await vaultRequest("DELETE", `/sys/policies/acl/${args.name}`);
    }

    // Tokens
    case "vault_create_token": {
      const body = {};
      if (args.policies) body.policies = args.policies;
      if (args.ttl) body.ttl = args.ttl;
      if (args.display_name) body.display_name = args.display_name;
      if (args.renewable !== undefined) body.renewable = args.renewable;
      if (args.no_parent) body.no_parent = args.no_parent;
      if (args.num_uses !== undefined) body.num_uses = args.num_uses;
      const data = await vaultRequest("POST", "/auth/token/create", body);
      return data.auth;
    }

    case "vault_lookup_token": {
      const data = await vaultRequest("POST", "/auth/token/lookup", {
        token: args.token,
      });
      return data.data;
    }

    case "vault_lookup_self": {
      const data = await vaultRequest("GET", "/auth/token/lookup-self");
      return data.data;
    }

    case "vault_revoke_token": {
      return await vaultRequest("POST", "/auth/token/revoke", {
        token: args.token,
      });
    }

    case "vault_renew_token": {
      const body = { token: args.token };
      if (args.increment) body.increment = args.increment;
      const data = await vaultRequest("POST", "/auth/token/renew", body);
      return data.auth;
    }

    // PKI
    case "vault_pki_issue_cert": {
      const body = { common_name: args.common_name };
      if (args.alt_names) body.alt_names = args.alt_names;
      if (args.ttl) body.ttl = args.ttl;
      if (args.ip_sans) body.ip_sans = args.ip_sans;
      if (args.format) body.format = args.format;
      const data = await vaultRequest("POST", `/${args.mount}/issue/${args.role}`, body);
      return data.data;
    }

    case "vault_pki_list_certs": {
      const data = await vaultRequest("LIST", `/${args.mount}/certs`);
      return data.data;
    }

    case "vault_pki_read_cert": {
      const data = await vaultRequest("GET", `/${args.mount}/cert/${args.serial}`);
      return data.data;
    }

    case "vault_pki_revoke_cert": {
      const data = await vaultRequest("POST", `/${args.mount}/revoke`, {
        serial_number: args.serial_number,
      });
      return data.data;
    }

    // Transit
    case "vault_transit_encrypt": {
      const data = await vaultRequest("POST", `/${args.mount}/encrypt/${args.key_name}`, {
        plaintext: args.plaintext,
      });
      return data.data;
    }

    case "vault_transit_decrypt": {
      const data = await vaultRequest("POST", `/${args.mount}/decrypt/${args.key_name}`, {
        ciphertext: args.ciphertext,
      });
      return data.data;
    }

    case "vault_transit_list_keys": {
      const data = await vaultRequest("LIST", `/${args.mount}/keys`);
      return data.data;
    }

    case "vault_transit_create_key": {
      const body = {};
      if (args.type) body.type = args.type;
      if (args.exportable !== undefined) body.exportable = args.exportable;
      if (args.allow_plaintext_backup !== undefined) body.allow_plaintext_backup = args.allow_plaintext_backup;
      return await vaultRequest("POST", `/${args.mount}/keys/${args.key_name}`, body);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "hashicorp-vault", version: "0.1.0" },
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
