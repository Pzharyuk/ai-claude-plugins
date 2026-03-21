# proxmox-manager

A Claude Cowork plugin for full Proxmox VE management — VMs, LXC containers, snapshots, storage, and guided Kubernetes cluster provisioning.

Part of [ai-claude-plugins](https://github.com/Pzharyuk/ai-claude-plugins).

## What You Can Do

- List all VMs and containers across your cluster
- Start, stop, reboot, force-kill VMs
- Clone VMs and templates
- Create and configure new VMs
- Migrate VMs between nodes (live or offline)
- Snapshot and rollback VMs
- Check node resource usage and cluster health
- List storage pools and ISO images
- **Provision and bootstrap a full Kubernetes cluster** (k3s or kubeadm) on your Proxmox VMs

## Skills

| Skill | Triggers |
|-------|---------|
| `proxmox-vms` | "list VMs", "start a VM", "clone template", "snapshot", "migrate", "check node status" |
| `kubernetes-cluster` | "create k8s cluster", "set up k3s", "bootstrap Kubernetes on Proxmox" |

## MCP Tools

### Cluster & Nodes
- `pve_cluster_status` — cluster health and quorum
- `pve_list_nodes` — all nodes with resource usage
- `pve_get_node_status` — detailed node stats
- `pve_list_tasks` — recent tasks
- `pve_next_vmid` — next available VM ID

### VM Lifecycle
- `pve_list_vms` — list all VMs (optionally include LXC containers)
- `pve_get_vm_status` — current status, CPU, memory
- `pve_get_vm_config` — full VM configuration
- `pve_start_vm` / `pve_stop_vm` / `pve_reboot_vm` / `pve_kill_vm`
- `pve_create_vm` — create from scratch
- `pve_clone_vm` — clone a VM or template
- `pve_update_vm_config` — change CPU, RAM, name, onboot
- `pve_delete_vm` — delete VM and disks
- `pve_migrate_vm` — move VM to another node

### Snapshots
- `pve_list_snapshots` / `pve_create_snapshot` / `pve_rollback_snapshot` / `pve_delete_snapshot`

### Storage
- `pve_list_storage` — pools with capacity
- `pve_list_isos` — ISOs and templates on a storage

## Setup

### 1. Create a Proxmox API Token

In the Proxmox web UI: **Datacenter → Permissions → API Tokens → Add**

- User: `root@pam` (or a dedicated user)
- Token ID: e.g. `claude`
- Uncheck "Privilege Separation" for full access

Give the token the `Administrator` role at the datacenter level:
**Datacenter → Permissions → Add → API Token Permission**
- Path: `/`
- Token: `root@pam!claude`
- Role: `Administrator`

### 2. Set Environment Variables

```bash
export PROXMOX_HOST="https://192.168.1.10:8006"
export PROXMOX_TOKEN_ID="root@pam!claude"
export PROXMOX_TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export PROXMOX_NODE="pve"          # optional: default node name
export PROXMOX_VERIFY_SSL="false"  # set to "true" if you have a valid cert
```

### 3. Install the Plugin

Install `proxmox-manager.plugin` via the Cowork plugins interface.

### 4. Install Server Dependencies

The MCP server requires Node.js 18+ and needs its dependencies installed once:

```bash
cd <plugin-install-path>/server
npm install
```

## Usage Examples

- "List all my VMs and their status"
- "Start VM 101 on node pve1"
- "Clone template 9000 to a new VM called k8s-worker-03"
- "Take a snapshot of VM 200 called pre-upgrade"
- "Migrate VM 150 to pve2 with live migration"
- "Help me set up a 3-node k3s cluster on my Proxmox"
- "Show me storage usage on pve1"
