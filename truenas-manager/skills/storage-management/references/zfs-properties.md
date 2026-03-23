# ZFS Dataset Properties Reference

## Compression Algorithms

| Algorithm | CPU Usage | Ratio | Best For |
|-----------|-----------|-------|----------|
| LZ4 | Very low | 1.5-2x | General purpose (default recommendation) |
| ZSTD | Low-medium | 2-3x | Archival, backups |
| GZIP-1 to GZIP-9 | Medium-high | 2-3x | Legacy, not recommended over ZSTD |
| OFF | None | 1x | Pre-compressed data (videos, images) |

## Common Properties

| Property | Description | Example |
|----------|-------------|---------|
| `compression` | Compression algorithm | `LZ4`, `ZSTD`, `OFF` |
| `quota` | Max space for dataset + children (bytes) | `1073741824` (1 GB) |
| `refquota` | Max space for dataset only (bytes) | `536870912` (512 MB) |
| `recordsize` | Block size | `128K` (default), `1M` (large files), `16K` (databases) |
| `acltype` | Access control list type | `POSIX`, `NFSV4`, `OFF` |
| `readonly` | Prevent writes | `true`, `false` |
| `deduplication` | Dedup (requires lots of RAM) | `ON`, `OFF`, `VERIFY` |
| `share_type` | Optimize for sharing protocol | `SMB`, `NFS`, `GENERIC` |

## Recommended Record Sizes

| Use Case | Record Size |
|----------|-------------|
| General file storage | 128K (default) |
| Large media files | 1M |
| Databases (PostgreSQL, MySQL) | 16K |
| VM images | 64K |
| Small files / source code | 32K-64K |

## Pool Topologies

| Layout | Min Disks | Fault Tolerance | Usable Capacity |
|--------|-----------|-----------------|-----------------|
| Stripe | 1 | None | 100% |
| Mirror | 2 | 1 disk per vdev | 50% |
| RAIDZ1 | 3 | 1 disk per vdev | (n-1)/n |
| RAIDZ2 | 4 | 2 disks per vdev | (n-2)/n |
| RAIDZ3 | 5 | 3 disks per vdev | (n-3)/n |
