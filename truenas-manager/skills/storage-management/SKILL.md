---
name: storage-management
description: >
  Use this skill when the user asks to "manage storage", "create a pool",
  "create a dataset", "take a snapshot", "list pools", "check pool health",
  "rollback a snapshot", "manage ZFS", or any task involving TrueNAS storage.
metadata:
  version: "0.1.0"
---

# TrueNAS Storage Management

Use the `truenas-manager` MCP server tools to manage ZFS pools, datasets, and snapshots.

## Storage Pools

### Listing pools
Call `truenas_pool_list` to see all ZFS pools with their status and capacity.

### Checking pool health
Call `truenas_pool_status` with the pool ID to see vdev layout, disk health, and any errors.

### Creating a pool
1. First check available disks with `truenas_disk_list`.
2. Confirm the pool name, RAID topology (mirror, raidz1, raidz2, raidz3, stripe), and disk selection.
3. Call `truenas_pool_create` with the topology object.
4. **Warning:** This will erase all data on the selected disks.

### Scrubbing a pool
Call `truenas_pool_scrub` to start a data integrity check. Recommend running monthly.

## Datasets

### Listing datasets
Call `truenas_dataset_list`, optionally filtered by pool name.

### Creating a dataset
1. Confirm the full path (e.g. `tank/media/movies`), compression, quota, and share type.
2. Call `truenas_dataset_create`.
3. Recommend LZ4 compression for general use, ZSTD for archival.

### Updating a dataset
Call `truenas_dataset_update` to change compression, quotas, comments, or read-only status.

### Setting permissions
Call `truenas_dataset_set_permissions` with mode, uid/gid, or user/group names. Use `recursive: true` for existing data.

### Deleting a dataset
1. **Always confirm** — this destroys all data in the dataset.
2. Call `truenas_dataset_delete`. Use `recursive: true` if it has children.

## Snapshots

### Listing snapshots
Call `truenas_snapshot_list`, optionally filtered by dataset.

### Creating a snapshot
Call `truenas_snapshot_create` with dataset and snapshot name. Use descriptive names like `before-upgrade-2024-01`.

### Rolling back
1. **Warning:** Rollback destroys all data created after the snapshot.
2. Call `truenas_snapshot_rollback`.

### Cloning a snapshot
Call `truenas_snapshot_clone` to create a new dataset from a snapshot (useful for testing).

## Best Practices

- Use mirrors for important data, raidz2 for large arrays.
- Enable compression (LZ4) on all datasets — it's free performance.
- Take snapshots before major changes.
- Set quotas on user datasets to prevent runaway usage.
- Schedule regular scrubs to catch silent data corruption.

## Reference

See `references/zfs-properties.md` for ZFS dataset properties.
