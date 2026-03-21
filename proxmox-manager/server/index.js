#!/usr/bin/env node
/**
 * Proxmox VE MCP Server
 * Full VM, container, node, storage, and snapshot management via the Proxmox REST API.
 *
 * Required env vars:
 *   PROXMOX_HOST          - e.g. https://192.168.1.10:8006
 *   PROXMOX_TOKEN_ID      - e.g. root@pam!mytoken
 *   PROXMOX_TOKEN_SECRET  - the token secret UUID
 *
 * Optional:
 *   PROXMOX_NODE          - default node name if not specified in tool args
 *   PROXMOX_VERIFY_SSL    - set to "true" to enforce SSL cert verification (default: false)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";

const HOST = process.env.PROXMOX_HOST?.replace(/\/$/, "");
const TOKEN_ID = process.env.PROXMOX_TOKEN_ID;
const TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET;
const DEFAULT_NODE = process.env.PROXMOX_NODE;
const VERIFY_SSL = process.env.PROXMOX_VERIFY_SSL === "true";

if (!HOST || !TOKEN_ID || !TOKEN_SECRET) {
  console.error(
    "Error: PROXMOX_HOST, PROXMOX_TOKEN_ID, and PROXMOX_TOKEN_SECRET are required"
  );
  process.exit(1);
}

// ─── Proxmox API helper ───────────────────────────────────────────────────────

const agent = new https.Agent({ rejectUnauthorized: VERIFY_SSL });

async function pveRequest(method, path, body) {
  const url = `${HOST}/api2/json${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`,
      "Content-Type": "application/json",
    },
    agent,
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxmox API ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  // ── Cluster / Nodes ──
  {
    name: "pve_list_nodes",
    description: "List all nodes in the Proxmox cluster with status and resources",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "pve_get_node_status",
    description: "Get detailed status, CPU, memory and disk usage for a node",
    inputSchema: {
      type: "object",
      required: ["node"],
      properties: { node: { type: "string", description: "Node name" } },
    },
  },
  {
    name: "pve_list_tasks",
    description: "List recent tasks on a node",
    inputSchema: {
      type: "object",
      required: ["node"],
      properties: {
        node: { type: "string" },
        limit: { type: "number", description: "Max tasks to return (default 50)" },
      },
    },
  },

  // ── VMs ──
  {
    name: "pve_list_vms",
    description: "List all VMs (and optionally LXC containers) across all nodes or a specific node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Filter by node (optional)" },
        include_containers: { type: "boolean", description: "Also list LXC containers" },
      },
    },
  },
  {
    name: "pve_get_vm_status",
    description: "Get current status, CPU, memory, and uptime of a VM",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number", description: "VM ID" },
      },
    },
  },
  {
    name: "pve_get_vm_config",
    description: "Get full configuration of a VM (CPU, memory, disks, network, etc.)",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
      },
    },
  },
  {
    name: "pve_start_vm",
    description: "Start a VM",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
      },
    },
  },
  {
    name: "pve_stop_vm",
    description: "Gracefully shut down a VM (ACPI shutdown)",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        timeout: { type: "number", description: "Seconds to wait (default 60)" },
      },
    },
  },
  {
    name: "pve_kill_vm",
    description: "Force stop a VM (hard power off — use only if graceful stop fails)",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
      },
    },
  },
  {
    name: "pve_reboot_vm",
    description: "Reboot a VM",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
      },
    },
  },
  {
    name: "pve_clone_vm",
    description: "Clone a VM or template to create a new VM",
    inputSchema: {
      type: "object",
      required: ["node", "vmid", "newid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number", description: "Source VM/template ID" },
        newid: { type: "number", description: "New VM ID" },
        name: { type: "string", description: "New VM name" },
        full: { type: "boolean", description: "Full clone (true) vs linked clone (false). Default: true" },
        target: { type: "string", description: "Target node (for cross-node clone)" },
        storage: { type: "string", description: "Target storage for full clone" },
        description: { type: "string" },
      },
    },
  },
  {
    name: "pve_create_vm",
    description: "Create a new VM with specified resources",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        name: { type: "string" },
        memory: { type: "number", description: "RAM in MB (e.g. 2048)" },
        cores: { type: "number", description: "Number of CPU cores" },
        sockets: { type: "number", description: "Number of CPU sockets (default 1)" },
        cpu: { type: "string", description: "CPU type (e.g. host, kvm64)" },
        net0: { type: "string", description: "Network config (e.g. virtio,bridge=vmbr0)" },
        scsi0: { type: "string", description: "Boot disk (e.g. local-lvm:32)" },
        ostype: { type: "string", description: "OS type: l26, win10, etc." },
        iso: { type: "string", description: "ISO image (e.g. local:iso/ubuntu.iso)" },
        start: { type: "boolean", description: "Start VM after creation" },
      },
    },
  },
  {
    name: "pve_update_vm_config",
    description: "Update VM configuration (memory, CPU, description, etc.)",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        memory: { type: "number" },
        cores: { type: "number" },
        name: { type: "string" },
        description: { type: "string" },
        onboot: { type: "boolean", description: "Start on boot" },
        protection: { type: "boolean", description: "Enable protection against accidental deletion" },
      },
    },
  },
  {
    name: "pve_delete_vm",
    description: "Delete a VM and all its disks. VM must be stopped first.",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        purge: { type: "boolean", description: "Remove from backup jobs and HA (default true)" },
      },
    },
  },
  {
    name: "pve_migrate_vm",
    description: "Migrate a VM to another node in the cluster",
    inputSchema: {
      type: "object",
      required: ["node", "vmid", "target"],
      properties: {
        node: { type: "string", description: "Source node" },
        vmid: { type: "number" },
        target: { type: "string", description: "Target node" },
        online: { type: "boolean", description: "Live migration (VM stays running)" },
        with_local_disks: { type: "boolean", description: "Migrate local disks too" },
      },
    },
  },

  // ── Snapshots ──
  {
    name: "pve_list_snapshots",
    description: "List all snapshots for a VM",
    inputSchema: {
      type: "object",
      required: ["node", "vmid"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
      },
    },
  },
  {
    name: "pve_create_snapshot",
    description: "Create a snapshot of a VM",
    inputSchema: {
      type: "object",
      required: ["node", "vmid", "snapname"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        snapname: { type: "string", description: "Snapshot name (no spaces)" },
        description: { type: "string" },
        vmstate: { type: "boolean", description: "Include RAM state in snapshot" },
      },
    },
  },
  {
    name: "pve_rollback_snapshot",
    description: "Rollback a VM to a previous snapshot",
    inputSchema: {
      type: "object",
      required: ["node", "vmid", "snapname"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        snapname: { type: "string" },
      },
    },
  },
  {
    name: "pve_delete_snapshot",
    description: "Delete a VM snapshot",
    inputSchema: {
      type: "object",
      required: ["node", "vmid", "snapname"],
      properties: {
        node: { type: "string" },
        vmid: { type: "number" },
        snapname: { type: "string" },
      },
    },
  },

  // ── Storage ──
  {
    name: "pve_list_storage",
    description: "List storage pools on a node with capacity and usage",
    inputSchema: {
      type: "object",
      required: ["node"],
      properties: { node: { type: "string" } },
    },
  },
  {
    name: "pve_list_isos",
    description: "List available ISO images and VM templates on a storage",
    inputSchema: {
      type: "object",
      required: ["node", "storage"],
      properties: {
        node: { type: "string" },
        storage: { type: "string" },
        content: { type: "string", description: "Content type: iso, vztmpl, images (default: iso,vztmpl)" },
      },
    },
  },

  // ── Next available VMID ──
  {
    name: "pve_next_vmid",
    description: "Get the next available VM ID in the cluster",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Cluster status ──
  {
    name: "pve_cluster_status",
    description: "Get overall Proxmox cluster status, quorum, and HA state",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function callTool(name, args) {
  const node = args.node || DEFAULT_NODE;

  switch (name) {
    // Cluster
    case "pve_cluster_status":
      return await pveRequest("GET", "/cluster/status");

    case "pve_list_nodes":
      return await pveRequest("GET", "/nodes");

    case "pve_get_node_status":
      return await pveRequest("GET", `/nodes/${node}/status`);

    case "pve_list_tasks": {
      const limit = args.limit || 50;
      return await pveRequest("GET", `/nodes/${node}/tasks?limit=${limit}`);
    }

    case "pve_next_vmid":
      return await pveRequest("GET", "/cluster/nextid");

    // VMs
    case "pve_list_vms": {
      if (node) {
        const vms = await pveRequest("GET", `/nodes/${node}/qemu`);
        if (args.include_containers) {
          const cts = await pveRequest("GET", `/nodes/${node}/lxc`);
          return { vms, containers: cts };
        }
        return vms;
      }
      // All nodes
      const nodes = await pveRequest("GET", "/nodes");
      const results = await Promise.all(
        nodes.map(async (n) => {
          const vms = await pveRequest("GET", `/nodes/${n.node}/qemu`);
          const tagged = vms.map((v) => ({ ...v, node: n.node }));
          if (args.include_containers) {
            const cts = await pveRequest("GET", `/nodes/${n.node}/lxc`);
            return [...tagged, ...cts.map((c) => ({ ...c, node: n.node, type: "lxc" }))];
          }
          return tagged;
        })
      );
      return results.flat();
    }

    case "pve_get_vm_status":
      return await pveRequest("GET", `/nodes/${node}/qemu/${args.vmid}/status/current`);

    case "pve_get_vm_config":
      return await pveRequest("GET", `/nodes/${node}/qemu/${args.vmid}/config`);

    case "pve_start_vm":
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/status/start`);

    case "pve_stop_vm": {
      const body = args.timeout ? { timeout: args.timeout } : {};
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/status/shutdown`, body);
    }

    case "pve_kill_vm":
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/status/stop`);

    case "pve_reboot_vm":
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/status/reboot`);

    case "pve_clone_vm": {
      const body = {
        newid: args.newid,
        full: args.full !== false ? 1 : 0,
      };
      if (args.name) body.name = args.name;
      if (args.target) body.target = args.target;
      if (args.storage) body.storage = args.storage;
      if (args.description) body.description = args.description;
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/clone`, body);
    }

    case "pve_create_vm": {
      const body = { vmid: args.vmid };
      const fields = ["name", "memory", "cores", "sockets", "cpu", "net0", "scsi0", "ostype", "start"];
      for (const f of fields) if (args[f] !== undefined) body[f] = args[f];
      if (args.iso) body.cdrom = args.iso;
      return await pveRequest("POST", `/nodes/${node}/qemu`, body);
    }

    case "pve_update_vm_config": {
      const body = {};
      const fields = ["memory", "cores", "name", "description", "onboot", "protection"];
      for (const f of fields) if (args[f] !== undefined) body[f] = args[f];
      return await pveRequest("PUT", `/nodes/${node}/qemu/${args.vmid}/config`, body);
    }

    case "pve_delete_vm": {
      const purge = args.purge !== false ? "?purge=1" : "";
      return await pveRequest("DELETE", `/nodes/${node}/qemu/${args.vmid}${purge}`);
    }

    case "pve_migrate_vm": {
      const body = { target: args.target };
      if (args.online) body.online = 1;
      if (args.with_local_disks) body["with-local-disks"] = 1;
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/migrate`, body);
    }

    // Snapshots
    case "pve_list_snapshots":
      return await pveRequest("GET", `/nodes/${node}/qemu/${args.vmid}/snapshot`);

    case "pve_create_snapshot": {
      const body = { snapname: args.snapname };
      if (args.description) body.description = args.description;
      if (args.vmstate) body.vmstate = 1;
      return await pveRequest("POST", `/nodes/${node}/qemu/${args.vmid}/snapshot`, body);
    }

    case "pve_rollback_snapshot":
      return await pveRequest(
        "POST",
        `/nodes/${node}/qemu/${args.vmid}/snapshot/${args.snapname}/rollback`
      );

    case "pve_delete_snapshot":
      return await pveRequest(
        "DELETE",
        `/nodes/${node}/qemu/${args.vmid}/snapshot/${args.snapname}`
      );

    // Storage
    case "pve_list_storage":
      return await pveRequest("GET", `/nodes/${node}/storage`);

    case "pve_list_isos": {
      const content = args.content || "iso,vztmpl";
      return await pveRequest(
        "GET",
        `/nodes/${node}/storage/${args.storage}/content?content=${content}`
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "proxmox-manager", version: "0.1.0" },
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
