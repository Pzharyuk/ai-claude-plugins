# TrueNAS Services Reference

## Common Services

| Service Name | Description | Default Port |
|-------------|-------------|--------------|
| `smb` | SMB/CIFS file sharing | 445 |
| `nfs` | NFS file sharing | 2049 |
| `ssh` | Secure Shell access | 22 |
| `iscsitarget` | iSCSI target service | 3260 |
| `ftp` | FTP file transfer | 21 |
| `snmp` | SNMP monitoring | 161 |
| `ups` | UPS monitoring (NUT) | 3493 |
| `smartd` | S.M.A.R.T. disk monitoring | — |
| `webdav` | WebDAV file access | 8080 |
| `rsync` | Rsync daemon | 873 |
| `lldp` | Link Layer Discovery Protocol | — |
| `s3` | MinIO S3-compatible storage | 9000 |
| `openvpn_server` | OpenVPN server | 1194 |
| `openvpn_client` | OpenVPN client | — |

## Service Management Pattern

1. **Start**: `truenas_service_start(service="smb")`
2. **Enable auto-start**: `truenas_service_update(service_id=X, enable=true)`
3. **Check status**: `truenas_service_list` (look at `state` field)
4. **Restart after config change**: `truenas_service_restart(service="smb")`

## Alert Severity Levels

| Level | Description |
|-------|-------------|
| INFO | Informational, no action needed |
| NOTICE | Notable event, review recommended |
| WARNING | Potential issue, investigate |
| ERROR | Problem detected, action required |
| CRITICAL | Immediate attention needed |
| ALERT | System-level emergency |

## Common Alert Types

- Pool degraded (disk failure)
- S.M.A.R.T. disk warnings
- High CPU/memory usage
- UPS on battery
- Scrub errors found
- Replication task failure
- Certificate expiration
