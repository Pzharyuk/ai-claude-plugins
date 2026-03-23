# Share Protocol Comparison

## SMB vs NFS vs iSCSI

| Feature | SMB | NFS | iSCSI |
|---------|-----|-----|-------|
| Type | File-level | File-level | Block-level |
| Best for | Windows clients | Linux/macOS clients | VMs, databases |
| Authentication | Username/password | Host/network-based | CHAP |
| ACL support | Full Windows ACLs | POSIX or NFSv4 ACLs | N/A |
| Performance | Good | Very good | Best (raw block) |
| Ease of setup | Easy | Easy | Moderate |

## SMB Share Options

| Option | Description |
|--------|-------------|
| `name` | Share name visible on the network |
| `path` | Filesystem path to share |
| `ro` | Read-only access |
| `browsable` | Visible in network browse (Windows Explorer) |
| `guestok` | Allow unauthenticated access |
| `recyclebin` | Deleted files go to recycle bin instead of permanent delete |
| `hostsallow` | Restrict access to specific hosts |
| `hostsdeny` | Block specific hosts |

## NFS Share Options

| Option | Description |
|--------|-------------|
| `path` | Filesystem path to share |
| `networks` | Allowed networks in CIDR notation (e.g. `192.168.1.0/24`) |
| `hosts` | Allowed hostnames |
| `ro` | Read-only access |
| `maproot_user` | Map root access to this user |
| `mapall_user` | Map all access to this user |

## Common Mount Commands

### SMB (Linux)
```bash
mount -t cifs //truenas.local/sharename /mnt/share -o username=user,password=pass
```

### NFS (Linux)
```bash
mount -t nfs truenas.local:/mnt/pool/dataset /mnt/share
```

### iSCSI (Linux)
```bash
iscsiadm -m discovery -t sendtargets -p truenas.local
iscsiadm -m node --login
```
