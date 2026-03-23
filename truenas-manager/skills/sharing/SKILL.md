---
name: sharing
description: >
  Use this skill when the user asks to "create a share", "set up SMB",
  "configure NFS", "manage iSCSI", "share a folder", "set up a network share",
  "create a Windows share", or any task involving TrueNAS file sharing.
metadata:
  version: "0.1.0"
---

# TrueNAS Sharing Management

Use the `truenas-manager` MCP server tools to manage SMB, NFS, and iSCSI shares.

## SMB (Windows) Shares

### Listing shares
Call `truenas_smb_list` to see all SMB shares.

### Creating an SMB share
1. Ensure the target dataset exists (create with `truenas_dataset_create` if needed, with `share_type: "SMB"`).
2. Confirm the path, share name, and access settings.
3. Call `truenas_smb_create`.
4. Ensure the SMB service is running: `truenas_service_start(service="smb")`.
5. If the user needs Windows access, remind them to create a TrueNAS user with SMB enabled.

### Updating an SMB share
Call `truenas_smb_update` to change comment, read-only, browsable, guest access, or recycle bin settings.

### Deleting an SMB share
1. Confirm with the user — this removes the share (not the data).
2. Call `truenas_smb_delete`.

## NFS (Unix/Linux) Shares

### Creating an NFS share
1. Ensure the target dataset exists (create with `share_type: "NFS"` if needed).
2. Confirm the path, allowed networks/hosts, and access settings.
3. Call `truenas_nfs_create`.
4. Ensure the NFS service is running: `truenas_service_start(service="nfs")`.

### Managing NFS shares
- `truenas_nfs_list` — list all shares
- `truenas_nfs_update` — change allowed networks, hosts, or read-only setting
- `truenas_nfs_delete` — remove a share

## iSCSI (Block Storage)

### Setting up iSCSI
1. Create a zvol dataset for the block device.
2. Create an extent: `truenas_iscsi_extent_create` (type: "DISK", disk: zvol path).
3. Create a target: `truenas_iscsi_target_create`.
4. Associate the extent with the target via the TrueNAS UI (target-extent mapping).
5. Ensure the iSCSI service is running: `truenas_service_start(service="iscsitarget")`.

### Listing iSCSI resources
- `truenas_iscsi_target_list` — list targets
- `truenas_iscsi_extent_list` — list extents

## Best Practices

- Create a dedicated dataset for each share with appropriate permissions.
- Use SMB for Windows clients, NFS for Linux/macOS clients.
- Restrict NFS access by network CIDR rather than allowing all.
- Enable guest access only for read-only public shares.
- Enable the recycle bin on SMB shares to prevent accidental data loss.

## Reference

See `references/share-protocols.md` for protocol comparison.
