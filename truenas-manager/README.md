# TrueNAS Manager Plugin

Full TrueNAS management from Claude — covering storage pools, datasets, snapshots, SMB/NFS/iSCSI shares, services, disks, network, users, replication, VMs, and apps.

## Overview

This plugin adds a local MCP server that connects directly to the TrueNAS REST API (v2.0), giving Claude full control over your TrueNAS SCALE (or CORE) instance for storage and system administration.

## Components

| Component | Purpose |
|-----------|---------|
| MCP Server (`truenas-manager`) | Wraps the TrueNAS REST API for storage, sharing, and system tools |
| Skill: `storage-management` | Guides for pools, datasets, and snapshots |
| Skill: `sharing` | Guides for SMB, NFS, and iSCSI share setup |
| Skill: `system-admin` | Guides for services, disks, users, VMs, apps, and replication |

## Available Tools (62)

### System (6)
- `truenas_system_info` — hostname, version, uptime
- `truenas_system_version` — version string
- `truenas_reboot` / `truenas_shutdown` — power management
- `truenas_alert_list` / `truenas_alert_dismiss` — system alerts

### Storage Pools (5)
- `truenas_pool_list` / `truenas_pool_get` / `truenas_pool_status` — view pools
- `truenas_pool_create` — create a new ZFS pool
- `truenas_pool_scrub` — start a data integrity check

### Datasets (6)
- `truenas_dataset_list` / `truenas_dataset_get` — view datasets
- `truenas_dataset_create` / `truenas_dataset_update` / `truenas_dataset_delete` — manage datasets
- `truenas_dataset_set_permissions` — set POSIX permissions

### Snapshots (5)
- `truenas_snapshot_list` / `truenas_snapshot_create` / `truenas_snapshot_delete`
- `truenas_snapshot_rollback` — revert to a snapshot
- `truenas_snapshot_clone` — create a dataset from a snapshot

### SMB Shares (4)
- `truenas_smb_list` / `truenas_smb_create` / `truenas_smb_update` / `truenas_smb_delete`

### NFS Shares (4)
- `truenas_nfs_list` / `truenas_nfs_create` / `truenas_nfs_update` / `truenas_nfs_delete`

### iSCSI (4)
- `truenas_iscsi_target_list` / `truenas_iscsi_target_create`
- `truenas_iscsi_extent_list` / `truenas_iscsi_extent_create`

### Services (5)
- `truenas_service_list` — list all services
- `truenas_service_start` / `truenas_service_stop` / `truenas_service_restart`
- `truenas_service_update` — enable/disable auto-start

### Disks (3)
- `truenas_disk_list` / `truenas_disk_get` / `truenas_disk_wipe`

### Network (3)
- `truenas_interface_list` / `truenas_interface_get` / `truenas_static_route_list`

### Users & Groups (7)
- `truenas_user_list` / `truenas_user_create` / `truenas_user_update` / `truenas_user_delete`
- `truenas_group_list` / `truenas_group_create` / `truenas_group_delete`

### Replication (4)
- `truenas_replication_list` / `truenas_replication_create` / `truenas_replication_run` / `truenas_replication_delete`

### VMs — SCALE only (5)
- `truenas_vm_list` / `truenas_vm_get`
- `truenas_vm_start` / `truenas_vm_stop` / `truenas_vm_restart`

### Apps — SCALE only (4)
- `truenas_app_list` / `truenas_app_start` / `truenas_app_stop` / `truenas_app_upgrade`

## Setup

### 1. Create a TrueNAS API Key

In the TrueNAS web UI, click your user icon (top-right) → API Keys → Add. Copy the generated key.

### 2. Set Environment Variables

```bash
export TRUENAS_URL="https://truenas.local"
export TRUENAS_API_KEY="1-your-api-key-here"
export TRUENAS_VERIFY_SSL="false"  # Set to true for CA-signed certs
```

### 3. Install the Plugin

Install `truenas-manager.plugin` via the Cowork plugins interface.

## Usage Examples

- "List all storage pools and their health status"
- "Create a dataset called tank/backups with LZ4 compression and a 500GB quota"
- "Take a snapshot of tank/media before the upgrade"
- "Set up an SMB share for the tank/shared dataset"
- "Create an NFS export for tank/vms restricted to 10.0.0.0/24"
- "Show me all system alerts"
- "Create a new user 'mediauser' with SMB access"
- "Start the VM named 'dev-server'"
- "List all installed apps and their status"
