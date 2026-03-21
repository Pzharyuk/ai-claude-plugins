# VM Configuration Field Reference

## Resource Fields

| Field      | Description                              | Example          |
|------------|------------------------------------------|------------------|
| `memory`   | RAM in MB                                | `2048`           |
| `cores`    | vCPU cores per socket                    | `2`              |
| `sockets`  | CPU sockets                              | `1`              |
| `cpu`      | CPU type                                 | `host`, `kvm64`  |
| `balloon`  | Memory balloon device (dynamic RAM) MB   | `512`            |
| `numa`     | Enable NUMA                              | `0` or `1`       |

## Boot Options

| Field    | Description                             |
|----------|-----------------------------------------|
| `boot`   | Boot order (`order=scsi0;net0`)         |
| `onboot` | Start VM on host boot (`1` = yes)       |
| `startup`| Startup/shutdown order within host     |

## Network

| Field   | Example                              |
|---------|--------------------------------------|
| `net0`  | `virtio,bridge=vmbr0`                |
| `net0`  | `virtio,bridge=vmbr0,tag=100` (VLAN) |
| `net0`  | `virtio,bridge=vmbr0,macaddr=XX:XX:XX:XX:XX:XX` |

## Disks

| Field    | Example                          |
|----------|----------------------------------|
| `scsi0`  | `local-lvm:32` (32GB on local-lvm) |
| `scsi0`  | `ceph-pool:64,ssd=1`             |
| `ide2`   | `local:iso/ubuntu.iso,media=cdrom` |
| `efidisk0` | `local-lvm:1` (for UEFI boot)  |

## OS Types

| Value   | OS                   |
|---------|----------------------|
| `l26`   | Linux 2.6+ kernel    |
| `win11` | Windows 11           |
| `win10` | Windows 10/2016/2019 |
| `wxp`   | Windows XP           |
| `other` | Unknown/Other        |

## Useful CPU Types

| Type     | Use case                                      |
|----------|-----------------------------------------------|
| `host`   | Best performance — exposes host CPU features  |
| `kvm64`  | Max compatibility — good for live migration   |
| `x86-64-v2-AES` | Balanced — good default for Linux VMs |

## Protection and Tags

| Field        | Description                                         |
|--------------|-----------------------------------------------------|
| `protection` | Prevent accidental deletion/modification (`1`/`0`) |
| `tags`       | Comma-separated tags for organization               |
| `description`| Freeform text shown in UI                          |
