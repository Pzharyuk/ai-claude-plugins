---
name: system-admin
description: >
  Use this skill when the user asks to "manage services", "check system info",
  "list disks", "manage users", "manage VMs", "manage apps", "restart a service",
  "check alerts", "manage network", "set up replication", or any TrueNAS
  system administration task.
metadata:
  version: "0.1.0"
---

# TrueNAS System Administration

Use the `truenas-manager` MCP server tools for system-level management.

## System Information

- `truenas_system_info` — hostname, version, uptime, hardware info
- `truenas_system_version` — version string
- `truenas_alert_list` — active system alerts
- `truenas_alert_dismiss` — dismiss a resolved alert

### Reboot/Shutdown
**Always confirm** before calling `truenas_reboot` or `truenas_shutdown`.

## Services

### Listing services
Call `truenas_service_list` to see all services and their running status.

### Managing services
- `truenas_service_start` / `truenas_service_stop` / `truenas_service_restart`
- Common services: `smb`, `nfs`, `ssh`, `iscsitarget`, `snmp`, `ups`, `smartd`
- `truenas_service_update` — enable/disable auto-start at boot

## Disks

- `truenas_disk_list` — list all physical disks with model, serial, size
- `truenas_disk_get` — detailed info on a specific disk
- `truenas_disk_wipe` — **destructive** — wipe a disk (QUICK or FULL). Always confirm first.

## Network

- `truenas_interface_list` — list all network interfaces
- `truenas_interface_get` — details of a specific interface
- `truenas_static_route_list` — list static routes

## Users & Groups

### Managing users
- `truenas_user_list` — list all local users
- `truenas_user_create` — create a new user (set `smb: true` for SMB access)
- `truenas_user_update` — change password, email, shell, lock/unlock
- `truenas_user_delete` — delete a user

### Managing groups
- `truenas_group_list`, `truenas_group_create`, `truenas_group_delete`

## Replication

### Setting up replication
1. Ensure SSH credentials are configured for remote targets.
2. Call `truenas_replication_create` with source datasets, target, and transport.
3. Set `auto: true` for scheduled replication.

### Managing replication
- `truenas_replication_list` — list all tasks
- `truenas_replication_run` — manually trigger a task
- `truenas_replication_delete` — remove a task

## VMs (SCALE only)

- `truenas_vm_list` — list all VMs
- `truenas_vm_get` — VM details (CPU, memory, disks)
- `truenas_vm_start` / `truenas_vm_stop` / `truenas_vm_restart`

## Apps (SCALE only)

- `truenas_app_list` — list installed apps
- `truenas_app_start` / `truenas_app_stop` — manage app lifecycle
- `truenas_app_upgrade` — upgrade to latest version

## Best Practices

- Check `truenas_alert_list` regularly for disk or pool warnings.
- Keep services you don't use disabled to reduce attack surface.
- Set up off-site replication for critical data.
- Create dedicated users for each SMB share rather than sharing credentials.

## Reference

See `references/services.md` for service names and common configurations.
