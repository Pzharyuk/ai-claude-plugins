#!/usr/bin/env node
/**
 * TrueNAS MCP Server
 * Provides full storage, sharing, system, and VM management via the TrueNAS REST API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";

const TRUENAS_URL = (process.env.TRUENAS_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.TRUENAS_API_KEY;
const VERIFY_SSL = process.env.TRUENAS_VERIFY_SSL === "true";

if (!TRUENAS_URL) {
  console.error("Error: TRUENAS_URL environment variable is required");
  process.exit(1);
}
if (!API_KEY) {
  console.error("Error: TRUENAS_API_KEY environment variable is required");
  process.exit(1);
}

// ─── TrueNAS API helper ──────────────────────────────────────────────────────

const agent = TRUENAS_URL.startsWith("https")
  ? new https.Agent({ rejectUnauthorized: VERIFY_SSL })
  : undefined;

async function tnRequest(method, path, body) {
  const url = `${TRUENAS_URL}/api/v2.0${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (agent) opts.agent = agent;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  if (res.status === 204) return { success: true };

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.ok) return { raw: text };
    throw new Error(`TrueNAS API error (${res.status}): ${text}`);
  }

  if (!res.ok) {
    const msg = typeof data === "object" ? (data.message || JSON.stringify(data)) : text;
    throw new Error(`TrueNAS API error (${res.status}): ${msg}`);
  }
  return data;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  // ── System ──
  {
    name: "truenas_system_info",
    description: "Get TrueNAS system information (hostname, version, uptime, etc.)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_system_version",
    description: "Get the TrueNAS version string",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_reboot",
    description: "Reboot the TrueNAS system",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_shutdown",
    description: "Shut down the TrueNAS system",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_alert_list",
    description: "List all system alerts",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_alert_dismiss",
    description: "Dismiss a system alert by ID",
    inputSchema: {
      type: "object",
      required: ["alert_id"],
      properties: {
        alert_id: { type: "string", description: "Alert UUID to dismiss" },
      },
    },
  },

  // ── Storage Pools ──
  {
    name: "truenas_pool_list",
    description: "List all ZFS storage pools",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_pool_get",
    description: "Get details of a specific storage pool",
    inputSchema: {
      type: "object",
      required: ["pool_id"],
      properties: {
        pool_id: { type: "number", description: "Pool ID" },
      },
    },
  },
  {
    name: "truenas_pool_create",
    description: "Create a new ZFS storage pool",
    inputSchema: {
      type: "object",
      required: ["name", "topology"],
      properties: {
        name: { type: "string", description: "Pool name" },
        topology: { type: "object", description: "Pool topology with data, cache, log, spare vdevs" },
        encryption: { type: "boolean", description: "Enable encryption" },
        deduplication: { type: "string", description: "Dedup setting: ON, OFF, VERIFY" },
      },
    },
  },
  {
    name: "truenas_pool_status",
    description: "Get the status and health of a storage pool",
    inputSchema: {
      type: "object",
      required: ["pool_id"],
      properties: {
        pool_id: { type: "number", description: "Pool ID" },
      },
    },
  },
  {
    name: "truenas_pool_scrub",
    description: "Start a scrub on a storage pool",
    inputSchema: {
      type: "object",
      required: ["pool_name"],
      properties: {
        pool_name: { type: "string", description: "Pool name to scrub" },
      },
    },
  },

  // ── Datasets ──
  {
    name: "truenas_dataset_list",
    description: "List all ZFS datasets, optionally filtered by pool",
    inputSchema: {
      type: "object",
      properties: {
        pool: { type: "string", description: "Filter by pool name" },
      },
    },
  },
  {
    name: "truenas_dataset_get",
    description: "Get details of a specific dataset",
    inputSchema: {
      type: "object",
      required: ["dataset_id"],
      properties: {
        dataset_id: { type: "string", description: "Dataset ID (e.g. 'tank/data')" },
      },
    },
  },
  {
    name: "truenas_dataset_create",
    description: "Create a new ZFS dataset",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Full dataset path (e.g. 'tank/my-dataset')" },
        type: { type: "string", description: "FILESYSTEM or VOLUME" },
        compression: { type: "string", description: "Compression algorithm (LZ4, GZIP, ZSTD, OFF)" },
        quota: { type: "number", description: "Quota in bytes" },
        refquota: { type: "number", description: "Reference quota in bytes" },
        recordsize: { type: "string", description: "Record size (e.g. '128K')" },
        acltype: { type: "string", description: "ACL type: POSIX, NFSV4, OFF" },
        share_type: { type: "string", description: "SMB, NFS, or GENERIC" },
        comments: { type: "string", description: "Dataset comments" },
      },
    },
  },
  {
    name: "truenas_dataset_update",
    description: "Update properties of an existing dataset",
    inputSchema: {
      type: "object",
      required: ["dataset_id"],
      properties: {
        dataset_id: { type: "string", description: "Dataset ID (e.g. 'tank/data')" },
        compression: { type: "string", description: "Compression algorithm" },
        quota: { type: "number", description: "Quota in bytes" },
        refquota: { type: "number", description: "Reference quota in bytes" },
        comments: { type: "string", description: "Dataset comments" },
        readonly: { type: "boolean", description: "Set read-only" },
      },
    },
  },
  {
    name: "truenas_dataset_delete",
    description: "Delete a ZFS dataset",
    inputSchema: {
      type: "object",
      required: ["dataset_id"],
      properties: {
        dataset_id: { type: "string", description: "Dataset ID (e.g. 'tank/data')" },
        recursive: { type: "boolean", description: "Recursively delete children" },
        force: { type: "boolean", description: "Force delete even if in use" },
      },
    },
  },
  {
    name: "truenas_dataset_set_permissions",
    description: "Set permissions on a dataset (POSIX or ACL)",
    inputSchema: {
      type: "object",
      required: ["dataset_id"],
      properties: {
        dataset_id: { type: "string", description: "Dataset ID" },
        mode: { type: "string", description: "POSIX mode (e.g. '755')" },
        uid: { type: "number", description: "Owner UID" },
        gid: { type: "number", description: "Group GID" },
        user: { type: "string", description: "Owner username" },
        group: { type: "string", description: "Group name" },
        recursive: { type: "boolean", description: "Apply recursively" },
      },
    },
  },

  // ── Snapshots ──
  {
    name: "truenas_snapshot_list",
    description: "List ZFS snapshots, optionally filtered by dataset",
    inputSchema: {
      type: "object",
      properties: {
        dataset: { type: "string", description: "Filter by dataset name" },
      },
    },
  },
  {
    name: "truenas_snapshot_create",
    description: "Create a ZFS snapshot",
    inputSchema: {
      type: "object",
      required: ["dataset", "name"],
      properties: {
        dataset: { type: "string", description: "Dataset to snapshot (e.g. 'tank/data')" },
        name: { type: "string", description: "Snapshot name" },
        recursive: { type: "boolean", description: "Include child datasets" },
      },
    },
  },
  {
    name: "truenas_snapshot_delete",
    description: "Delete a ZFS snapshot",
    inputSchema: {
      type: "object",
      required: ["snapshot_id"],
      properties: {
        snapshot_id: { type: "string", description: "Snapshot ID (e.g. 'tank/data@snap1')" },
      },
    },
  },
  {
    name: "truenas_snapshot_rollback",
    description: "Rollback a dataset to a snapshot",
    inputSchema: {
      type: "object",
      required: ["snapshot_id"],
      properties: {
        snapshot_id: { type: "string", description: "Snapshot ID to rollback to" },
        recursive: { type: "boolean", description: "Recursively rollback child datasets" },
        force: { type: "boolean", description: "Force rollback, destroying newer snapshots" },
      },
    },
  },
  {
    name: "truenas_snapshot_clone",
    description: "Clone a snapshot to a new dataset",
    inputSchema: {
      type: "object",
      required: ["snapshot_id", "dataset_dst"],
      properties: {
        snapshot_id: { type: "string", description: "Source snapshot ID" },
        dataset_dst: { type: "string", description: "Destination dataset path" },
      },
    },
  },

  // ── SMB Shares ──
  {
    name: "truenas_smb_list",
    description: "List all SMB shares",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_smb_create",
    description: "Create a new SMB share",
    inputSchema: {
      type: "object",
      required: ["path", "name"],
      properties: {
        path: { type: "string", description: "Filesystem path to share" },
        name: { type: "string", description: "Share name" },
        comment: { type: "string", description: "Share description" },
        ro: { type: "boolean", description: "Read-only" },
        browsable: { type: "boolean", description: "Visible in network browse" },
        guestok: { type: "boolean", description: "Allow guest access" },
        recyclebin: { type: "boolean", description: "Enable recycle bin" },
        hostsallow: { type: "array", items: { type: "string" }, description: "Allowed hosts" },
        hostsdeny: { type: "array", items: { type: "string" }, description: "Denied hosts" },
      },
    },
  },
  {
    name: "truenas_smb_update",
    description: "Update an existing SMB share",
    inputSchema: {
      type: "object",
      required: ["share_id"],
      properties: {
        share_id: { type: "number", description: "Share ID" },
        comment: { type: "string" },
        ro: { type: "boolean" },
        browsable: { type: "boolean" },
        guestok: { type: "boolean" },
        recyclebin: { type: "boolean" },
      },
    },
  },
  {
    name: "truenas_smb_delete",
    description: "Delete an SMB share",
    inputSchema: {
      type: "object",
      required: ["share_id"],
      properties: {
        share_id: { type: "number", description: "Share ID" },
      },
    },
  },

  // ── NFS Shares ──
  {
    name: "truenas_nfs_list",
    description: "List all NFS shares",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_nfs_create",
    description: "Create a new NFS share",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Filesystem path to share" },
        comment: { type: "string", description: "Share description" },
        networks: { type: "array", items: { type: "string" }, description: "Allowed networks (CIDR)" },
        hosts: { type: "array", items: { type: "string" }, description: "Allowed hostnames" },
        ro: { type: "boolean", description: "Read-only" },
        maproot_user: { type: "string", description: "Map root to user" },
        maproot_group: { type: "string", description: "Map root to group" },
        mapall_user: { type: "string", description: "Map all to user" },
        mapall_group: { type: "string", description: "Map all to group" },
      },
    },
  },
  {
    name: "truenas_nfs_update",
    description: "Update an existing NFS share",
    inputSchema: {
      type: "object",
      required: ["share_id"],
      properties: {
        share_id: { type: "number", description: "Share ID" },
        comment: { type: "string" },
        networks: { type: "array", items: { type: "string" } },
        hosts: { type: "array", items: { type: "string" } },
        ro: { type: "boolean" },
      },
    },
  },
  {
    name: "truenas_nfs_delete",
    description: "Delete an NFS share",
    inputSchema: {
      type: "object",
      required: ["share_id"],
      properties: {
        share_id: { type: "number", description: "Share ID" },
      },
    },
  },

  // ── iSCSI ──
  {
    name: "truenas_iscsi_target_list",
    description: "List all iSCSI targets",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_iscsi_extent_list",
    description: "List all iSCSI extents",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_iscsi_target_create",
    description: "Create a new iSCSI target",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Target name" },
        alias: { type: "string", description: "Target alias" },
        groups: { type: "array", description: "Portal/initiator group mappings" },
      },
    },
  },
  {
    name: "truenas_iscsi_extent_create",
    description: "Create a new iSCSI extent",
    inputSchema: {
      type: "object",
      required: ["name", "type"],
      properties: {
        name: { type: "string", description: "Extent name" },
        type: { type: "string", description: "DISK or FILE" },
        disk: { type: "string", description: "zvol path (for DISK type)" },
        path: { type: "string", description: "File path (for FILE type)" },
        filesize: { type: "number", description: "File size in bytes (for FILE type)" },
        blocksize: { type: "number", description: "Block size (512 or 4096)" },
      },
    },
  },

  // ── Services ──
  {
    name: "truenas_service_list",
    description: "List all system services and their status",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_service_start",
    description: "Start a system service",
    inputSchema: {
      type: "object",
      required: ["service"],
      properties: {
        service: { type: "string", description: "Service name (e.g. 'smb', 'nfs', 'ssh', 'iscsitarget')" },
      },
    },
  },
  {
    name: "truenas_service_stop",
    description: "Stop a system service",
    inputSchema: {
      type: "object",
      required: ["service"],
      properties: {
        service: { type: "string", description: "Service name" },
      },
    },
  },
  {
    name: "truenas_service_restart",
    description: "Restart a system service",
    inputSchema: {
      type: "object",
      required: ["service"],
      properties: {
        service: { type: "string", description: "Service name" },
      },
    },
  },
  {
    name: "truenas_service_update",
    description: "Update service configuration (enable/disable auto-start)",
    inputSchema: {
      type: "object",
      required: ["service_id"],
      properties: {
        service_id: { type: "number", description: "Service ID" },
        enable: { type: "boolean", description: "Enable auto-start at boot" },
      },
    },
  },

  // ── Disks ──
  {
    name: "truenas_disk_list",
    description: "List all physical disks in the system",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_disk_get",
    description: "Get details of a specific disk",
    inputSchema: {
      type: "object",
      required: ["disk_id"],
      properties: {
        disk_id: { type: "string", description: "Disk identifier (e.g. 'sda')" },
      },
    },
  },
  {
    name: "truenas_disk_wipe",
    description: "Wipe a disk (QUICK or FULL)",
    inputSchema: {
      type: "object",
      required: ["disk_id", "method"],
      properties: {
        disk_id: { type: "string", description: "Disk identifier" },
        method: { type: "string", description: "QUICK or FULL" },
      },
    },
  },

  // ── Network ──
  {
    name: "truenas_interface_list",
    description: "List all network interfaces",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_interface_get",
    description: "Get details of a network interface",
    inputSchema: {
      type: "object",
      required: ["interface_id"],
      properties: {
        interface_id: { type: "string", description: "Interface name (e.g. 'ens18')" },
      },
    },
  },
  {
    name: "truenas_static_route_list",
    description: "List all static routes",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Users & Groups ──
  {
    name: "truenas_user_list",
    description: "List all local users",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_user_create",
    description: "Create a new local user",
    inputSchema: {
      type: "object",
      required: ["username", "full_name", "password"],
      properties: {
        username: { type: "string", description: "Username" },
        full_name: { type: "string", description: "Full name" },
        password: { type: "string", description: "Password" },
        uid: { type: "number", description: "User ID (auto-assigned if omitted)" },
        group: { type: "number", description: "Primary group ID" },
        home: { type: "string", description: "Home directory path" },
        shell: { type: "string", description: "Login shell" },
        smb: { type: "boolean", description: "SMB user" },
        sudo_commands: { type: "array", items: { type: "string" }, description: "Allowed sudo commands" },
        email: { type: "string", description: "Email address" },
      },
    },
  },
  {
    name: "truenas_user_update",
    description: "Update an existing user",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        user_id: { type: "number", description: "User ID" },
        full_name: { type: "string" },
        password: { type: "string" },
        email: { type: "string" },
        shell: { type: "string" },
        smb: { type: "boolean" },
        locked: { type: "boolean", description: "Lock the account" },
      },
    },
  },
  {
    name: "truenas_user_delete",
    description: "Delete a local user",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        user_id: { type: "number", description: "User ID" },
        delete_group: { type: "boolean", description: "Also delete the user's primary group" },
      },
    },
  },
  {
    name: "truenas_group_list",
    description: "List all local groups",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_group_create",
    description: "Create a new local group",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Group name" },
        gid: { type: "number", description: "Group ID (auto-assigned if omitted)" },
        smb: { type: "boolean", description: "SMB group" },
        sudo_commands: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "truenas_group_delete",
    description: "Delete a local group",
    inputSchema: {
      type: "object",
      required: ["group_id"],
      properties: {
        group_id: { type: "number", description: "Group ID" },
      },
    },
  },

  // ── Replication ──
  {
    name: "truenas_replication_list",
    description: "List all replication tasks",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_replication_create",
    description: "Create a new replication task",
    inputSchema: {
      type: "object",
      required: ["name", "source_datasets", "target_dataset", "transport"],
      properties: {
        name: { type: "string", description: "Task name" },
        direction: { type: "string", description: "PUSH or PULL" },
        transport: { type: "string", description: "SSH, SSH+NETCAT, LOCAL, LEGACY" },
        source_datasets: { type: "array", items: { type: "string" }, description: "Source dataset paths" },
        target_dataset: { type: "string", description: "Target dataset path" },
        recursive: { type: "boolean", description: "Include child datasets" },
        auto: { type: "boolean", description: "Run automatically on schedule" },
        retention_policy: { type: "string", description: "SOURCE, CUSTOM, NONE" },
        ssh_credentials: { type: "number", description: "SSH credential ID for remote replication" },
      },
    },
  },
  {
    name: "truenas_replication_run",
    description: "Manually trigger a replication task",
    inputSchema: {
      type: "object",
      required: ["replication_id"],
      properties: {
        replication_id: { type: "number", description: "Replication task ID" },
      },
    },
  },
  {
    name: "truenas_replication_delete",
    description: "Delete a replication task",
    inputSchema: {
      type: "object",
      required: ["replication_id"],
      properties: {
        replication_id: { type: "number", description: "Replication task ID" },
      },
    },
  },

  // ── VMs (SCALE) ──
  {
    name: "truenas_vm_list",
    description: "List all virtual machines",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_vm_get",
    description: "Get details of a specific VM",
    inputSchema: {
      type: "object",
      required: ["vm_id"],
      properties: {
        vm_id: { type: "number", description: "VM ID" },
      },
    },
  },
  {
    name: "truenas_vm_start",
    description: "Start a virtual machine",
    inputSchema: {
      type: "object",
      required: ["vm_id"],
      properties: {
        vm_id: { type: "number", description: "VM ID" },
        overcommit: { type: "boolean", description: "Allow memory overcommit" },
      },
    },
  },
  {
    name: "truenas_vm_stop",
    description: "Stop a virtual machine",
    inputSchema: {
      type: "object",
      required: ["vm_id"],
      properties: {
        vm_id: { type: "number", description: "VM ID" },
        force: { type: "boolean", description: "Force stop (power off)" },
      },
    },
  },
  {
    name: "truenas_vm_restart",
    description: "Restart a virtual machine",
    inputSchema: {
      type: "object",
      required: ["vm_id"],
      properties: {
        vm_id: { type: "number", description: "VM ID" },
      },
    },
  },

  // ── Apps (SCALE) ──
  {
    name: "truenas_app_list",
    description: "List all installed applications",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_app_start",
    description: "Start an application",
    inputSchema: {
      type: "object",
      required: ["app_name"],
      properties: {
        app_name: { type: "string", description: "Application name" },
      },
    },
  },
  {
    name: "truenas_app_stop",
    description: "Stop an application",
    inputSchema: {
      type: "object",
      required: ["app_name"],
      properties: {
        app_name: { type: "string", description: "Application name" },
      },
    },
  },
  {
    name: "truenas_app_upgrade",
    description: "Upgrade an application to the latest version",
    inputSchema: {
      type: "object",
      required: ["app_name"],
      properties: {
        app_name: { type: "string", description: "Application name" },
      },
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {
    // System
    case "truenas_system_info": {
      return await tnRequest("GET", "/system/info");
    }
    case "truenas_system_version": {
      return await tnRequest("GET", "/system/version");
    }
    case "truenas_reboot": {
      return await tnRequest("POST", "/system/reboot");
    }
    case "truenas_shutdown": {
      return await tnRequest("POST", "/system/shutdown");
    }
    case "truenas_alert_list": {
      return await tnRequest("GET", "/alert/list");
    }
    case "truenas_alert_dismiss": {
      return await tnRequest("DELETE", `/alert/dismiss?id=${encodeURIComponent(args.alert_id)}`);
    }

    // Pools
    case "truenas_pool_list": {
      return await tnRequest("GET", "/pool");
    }
    case "truenas_pool_get": {
      return await tnRequest("GET", `/pool/id/${args.pool_id}`);
    }
    case "truenas_pool_create": {
      const body = { name: args.name, topology: args.topology };
      if (args.encryption !== undefined) body.encryption = args.encryption;
      if (args.deduplication) body.deduplication = args.deduplication;
      return await tnRequest("POST", "/pool", body);
    }
    case "truenas_pool_status": {
      return await tnRequest("GET", `/pool/id/${args.pool_id}`);
    }
    case "truenas_pool_scrub": {
      return await tnRequest("POST", `/pool/scrub`, { name: args.pool_name });
    }

    // Datasets
    case "truenas_dataset_list": {
      const qs = args.pool ? `?pool=${encodeURIComponent(args.pool)}` : "";
      return await tnRequest("GET", `/pool/dataset${qs}`);
    }
    case "truenas_dataset_get": {
      return await tnRequest("GET", `/pool/dataset/id/${encodeURIComponent(args.dataset_id)}`);
    }
    case "truenas_dataset_create": {
      const body = { name: args.name };
      if (args.type) body.type = args.type;
      if (args.compression) body.compression = args.compression;
      if (args.quota) body.quota = args.quota;
      if (args.refquota) body.refquota = args.refquota;
      if (args.recordsize) body.recordsize = args.recordsize;
      if (args.acltype) body.acltype = args.acltype;
      if (args.share_type) body.share_type = args.share_type;
      if (args.comments) body.comments = args.comments;
      return await tnRequest("POST", "/pool/dataset", body);
    }
    case "truenas_dataset_update": {
      const body = {};
      if (args.compression) body.compression = args.compression;
      if (args.quota !== undefined) body.quota = args.quota;
      if (args.refquota !== undefined) body.refquota = args.refquota;
      if (args.comments !== undefined) body.comments = args.comments;
      if (args.readonly !== undefined) body.readonly = args.readonly;
      return await tnRequest("PUT", `/pool/dataset/id/${encodeURIComponent(args.dataset_id)}`, body);
    }
    case "truenas_dataset_delete": {
      const body = {};
      if (args.recursive) body.recursive = args.recursive;
      if (args.force) body.force = args.force;
      return await tnRequest("DELETE", `/pool/dataset/id/${encodeURIComponent(args.dataset_id)}`, body);
    }
    case "truenas_dataset_set_permissions": {
      const body = {};
      if (args.mode) body.mode = args.mode;
      if (args.uid !== undefined) body.uid = args.uid;
      if (args.gid !== undefined) body.gid = args.gid;
      if (args.user) body.user = args.user;
      if (args.group) body.group = args.group;
      const options = {};
      if (args.recursive) options.recursive = true;
      if (Object.keys(options).length) body.options = options;
      return await tnRequest("POST", `/pool/dataset/id/${encodeURIComponent(args.dataset_id)}/permission`, body);
    }

    // Snapshots
    case "truenas_snapshot_list": {
      const qs = args.dataset ? `?dataset=${encodeURIComponent(args.dataset)}` : "";
      return await tnRequest("GET", `/zfs/snapshot${qs}`);
    }
    case "truenas_snapshot_create": {
      const body = { dataset: args.dataset, name: args.name };
      if (args.recursive) body.recursive = args.recursive;
      return await tnRequest("POST", "/zfs/snapshot", body);
    }
    case "truenas_snapshot_delete": {
      return await tnRequest("DELETE", `/zfs/snapshot/id/${encodeURIComponent(args.snapshot_id)}`);
    }
    case "truenas_snapshot_rollback": {
      const body = {};
      if (args.recursive) body.recursive = args.recursive;
      if (args.force) body.force = args.force;
      return await tnRequest("POST", `/zfs/snapshot/id/${encodeURIComponent(args.snapshot_id)}/rollback`, body);
    }
    case "truenas_snapshot_clone": {
      return await tnRequest("POST", `/zfs/snapshot/id/${encodeURIComponent(args.snapshot_id)}/clone`, {
        dataset_dst: args.dataset_dst,
      });
    }

    // SMB
    case "truenas_smb_list": {
      return await tnRequest("GET", "/sharing/smb");
    }
    case "truenas_smb_create": {
      const body = { path: args.path, name: args.name };
      if (args.comment) body.comment = args.comment;
      if (args.ro !== undefined) body.ro = args.ro;
      if (args.browsable !== undefined) body.browsable = args.browsable;
      if (args.guestok !== undefined) body.guestok = args.guestok;
      if (args.recyclebin !== undefined) body.recyclebin = args.recyclebin;
      if (args.hostsallow) body.hostsallow = args.hostsallow;
      if (args.hostsdeny) body.hostsdeny = args.hostsdeny;
      return await tnRequest("POST", "/sharing/smb", body);
    }
    case "truenas_smb_update": {
      const body = {};
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.ro !== undefined) body.ro = args.ro;
      if (args.browsable !== undefined) body.browsable = args.browsable;
      if (args.guestok !== undefined) body.guestok = args.guestok;
      if (args.recyclebin !== undefined) body.recyclebin = args.recyclebin;
      return await tnRequest("PUT", `/sharing/smb/id/${args.share_id}`, body);
    }
    case "truenas_smb_delete": {
      return await tnRequest("DELETE", `/sharing/smb/id/${args.share_id}`);
    }

    // NFS
    case "truenas_nfs_list": {
      return await tnRequest("GET", "/sharing/nfs");
    }
    case "truenas_nfs_create": {
      const body = { path: args.path };
      if (args.comment) body.comment = args.comment;
      if (args.networks) body.networks = args.networks;
      if (args.hosts) body.hosts = args.hosts;
      if (args.ro !== undefined) body.ro = args.ro;
      if (args.maproot_user) body.maproot_user = args.maproot_user;
      if (args.maproot_group) body.maproot_group = args.maproot_group;
      if (args.mapall_user) body.mapall_user = args.mapall_user;
      if (args.mapall_group) body.mapall_group = args.mapall_group;
      return await tnRequest("POST", "/sharing/nfs", body);
    }
    case "truenas_nfs_update": {
      const body = {};
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.networks) body.networks = args.networks;
      if (args.hosts) body.hosts = args.hosts;
      if (args.ro !== undefined) body.ro = args.ro;
      return await tnRequest("PUT", `/sharing/nfs/id/${args.share_id}`, body);
    }
    case "truenas_nfs_delete": {
      return await tnRequest("DELETE", `/sharing/nfs/id/${args.share_id}`);
    }

    // iSCSI
    case "truenas_iscsi_target_list": {
      return await tnRequest("GET", "/iscsi/target");
    }
    case "truenas_iscsi_extent_list": {
      return await tnRequest("GET", "/iscsi/extent");
    }
    case "truenas_iscsi_target_create": {
      const body = { name: args.name };
      if (args.alias) body.alias = args.alias;
      if (args.groups) body.groups = args.groups;
      return await tnRequest("POST", "/iscsi/target", body);
    }
    case "truenas_iscsi_extent_create": {
      const body = { name: args.name, type: args.type };
      if (args.disk) body.disk = args.disk;
      if (args.path) body.path = args.path;
      if (args.filesize) body.filesize = args.filesize;
      if (args.blocksize) body.blocksize = args.blocksize;
      return await tnRequest("POST", "/iscsi/extent", body);
    }

    // Services
    case "truenas_service_list": {
      return await tnRequest("GET", "/service");
    }
    case "truenas_service_start": {
      return await tnRequest("POST", "/service/start", { service: args.service });
    }
    case "truenas_service_stop": {
      return await tnRequest("POST", "/service/stop", { service: args.service });
    }
    case "truenas_service_restart": {
      return await tnRequest("POST", "/service/restart", { service: args.service });
    }
    case "truenas_service_update": {
      const body = {};
      if (args.enable !== undefined) body.enable = args.enable;
      return await tnRequest("PUT", `/service/id/${args.service_id}`, body);
    }

    // Disks
    case "truenas_disk_list": {
      return await tnRequest("GET", "/disk");
    }
    case "truenas_disk_get": {
      return await tnRequest("GET", `/disk/id/${encodeURIComponent(args.disk_id)}`);
    }
    case "truenas_disk_wipe": {
      return await tnRequest("POST", `/disk/id/${encodeURIComponent(args.disk_id)}/wipe`, {
        method: args.method,
      });
    }

    // Network
    case "truenas_interface_list": {
      return await tnRequest("GET", "/interface");
    }
    case "truenas_interface_get": {
      return await tnRequest("GET", `/interface/id/${encodeURIComponent(args.interface_id)}`);
    }
    case "truenas_static_route_list": {
      return await tnRequest("GET", "/staticroute");
    }

    // Users & Groups
    case "truenas_user_list": {
      return await tnRequest("GET", "/user");
    }
    case "truenas_user_create": {
      const body = {
        username: args.username,
        full_name: args.full_name,
        password: args.password,
      };
      if (args.uid !== undefined) body.uid = args.uid;
      if (args.group !== undefined) body.group = args.group;
      if (args.home) body.home = args.home;
      if (args.shell) body.shell = args.shell;
      if (args.smb !== undefined) body.smb = args.smb;
      if (args.sudo_commands) body.sudo_commands = args.sudo_commands;
      if (args.email) body.email = args.email;
      return await tnRequest("POST", "/user", body);
    }
    case "truenas_user_update": {
      const body = {};
      if (args.full_name) body.full_name = args.full_name;
      if (args.password) body.password = args.password;
      if (args.email !== undefined) body.email = args.email;
      if (args.shell) body.shell = args.shell;
      if (args.smb !== undefined) body.smb = args.smb;
      if (args.locked !== undefined) body.locked = args.locked;
      return await tnRequest("PUT", `/user/id/${args.user_id}`, body);
    }
    case "truenas_user_delete": {
      const body = {};
      if (args.delete_group !== undefined) body.delete_group = args.delete_group;
      return await tnRequest("DELETE", `/user/id/${args.user_id}`, body);
    }
    case "truenas_group_list": {
      return await tnRequest("GET", "/group");
    }
    case "truenas_group_create": {
      const body = { name: args.name };
      if (args.gid !== undefined) body.gid = args.gid;
      if (args.smb !== undefined) body.smb = args.smb;
      if (args.sudo_commands) body.sudo_commands = args.sudo_commands;
      return await tnRequest("POST", "/group", body);
    }
    case "truenas_group_delete": {
      return await tnRequest("DELETE", `/group/id/${args.group_id}`);
    }

    // Replication
    case "truenas_replication_list": {
      return await tnRequest("GET", "/replication");
    }
    case "truenas_replication_create": {
      const body = {
        name: args.name,
        source_datasets: args.source_datasets,
        target_dataset: args.target_dataset,
        transport: args.transport,
      };
      if (args.direction) body.direction = args.direction;
      if (args.recursive !== undefined) body.recursive = args.recursive;
      if (args.auto !== undefined) body.auto = args.auto;
      if (args.retention_policy) body.retention_policy = args.retention_policy;
      if (args.ssh_credentials) body.ssh_credentials = args.ssh_credentials;
      return await tnRequest("POST", "/replication", body);
    }
    case "truenas_replication_run": {
      return await tnRequest("POST", `/replication/id/${args.replication_id}/run`);
    }
    case "truenas_replication_delete": {
      return await tnRequest("DELETE", `/replication/id/${args.replication_id}`);
    }

    // VMs
    case "truenas_vm_list": {
      return await tnRequest("GET", "/vm");
    }
    case "truenas_vm_get": {
      return await tnRequest("GET", `/vm/id/${args.vm_id}`);
    }
    case "truenas_vm_start": {
      const body = {};
      if (args.overcommit !== undefined) body.overcommit = args.overcommit;
      return await tnRequest("POST", `/vm/id/${args.vm_id}/start`, body);
    }
    case "truenas_vm_stop": {
      const body = {};
      if (args.force) body.force = args.force;
      return await tnRequest("POST", `/vm/id/${args.vm_id}/stop`, body);
    }
    case "truenas_vm_restart": {
      return await tnRequest("POST", `/vm/id/${args.vm_id}/restart`);
    }

    // Apps
    case "truenas_app_list": {
      return await tnRequest("GET", "/app");
    }
    case "truenas_app_start": {
      return await tnRequest("POST", `/app/id/${encodeURIComponent(args.app_name)}/start`);
    }
    case "truenas_app_stop": {
      return await tnRequest("POST", `/app/id/${encodeURIComponent(args.app_name)}/stop`);
    }
    case "truenas_app_upgrade": {
      return await tnRequest("POST", `/app/id/${encodeURIComponent(args.app_name)}/upgrade`);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "truenas-manager", version: "0.1.0" },
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
