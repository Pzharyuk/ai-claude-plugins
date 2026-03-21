---
name: proxmox-vms
description: >
  Use this skill when the user asks to "manage VMs", "list virtual machines",
  "start a VM", "stop a VM", "reboot a VM", "create a VM", "clone a VM",
  "delete a VM", "migrate a VM", "take a snapshot", "rollback a snapshot",
  "check node status", "list Proxmox nodes", "check storage", or any task
  involving Proxmox VE virtual machine or container lifecycle management.
metadata:
  version: "0.1.0"
---

# Proxmox VM Management

Use the `proxmox-manager` MCP server tools to manage VMs, containers, nodes, storage, and snapshots on a Proxmox VE cluster.

## General Approach

- When a `node` is required and the user hasn't specified one, call `pve_list_nodes` first and ask which node to target — or list VMs across all nodes with `pve_list_vms` (omit `node` arg).
- For destructive actions (delete, force stop, rollback), always confirm with the user before proceeding.
- Long-running operations (clone, migrate) return a task ID — the user can track it with `pve_list_tasks`.

## Common Workflows

### Viewing the cluster
1. `pve_cluster_status` — overall health and quorum
2. `pve_list_nodes` — nodes with CPU/RAM usage
3. `pve_list_vms` — all VMs across all nodes (set `include_containers: true` to also see LXCs)

### VM lifecycle
- Start: `pve_start_vm`
- Graceful shutdown: `pve_stop_vm` (uses ACPI — guest OS shuts down cleanly)
- Force stop: `pve_kill_vm` (hard power off — only if graceful fails)
- Reboot: `pve_reboot_vm`

### Creating a VM from a template
1. Find a suitable template with `pve_list_vms` (templates show `template: 1` in config)
2. Get next free ID: `pve_next_vmid`
3. Clone: `pve_clone_vm` with `full: true` and target storage
4. Update config if needed: `pve_update_vm_config` (set name, memory, CPU, onboot)
5. Start: `pve_start_vm`

### Snapshots
- List: `pve_list_snapshots`
- Create: `pve_create_snapshot` (name must have no spaces; include description)
- Rollback: `pve_rollback_snapshot` (VM should be stopped first for clean rollback)
- Delete: `pve_delete_snapshot`

### Migration
Use `pve_migrate_vm` to move a VM to another node. Set `online: true` for live migration (VM stays running — requires shared storage or same-storage setup).

### Storage
- `pve_list_storage` — pools with free/used space
- `pve_list_isos` — ISO images and container templates on a storage

## Best Practices

- Always snapshot before major changes (OS upgrades, config changes)
- Use `onboot: true` on production VMs so they auto-start after node reboot
- For Kubernetes nodes, provision with at least 2 CPUs and 2 GB RAM per node (see kubernetes-cluster skill)
- Use descriptive VM names and descriptions — they help when managing many VMs

## Reference
See `references/vm-config-fields.md` for full VM configuration field reference.
