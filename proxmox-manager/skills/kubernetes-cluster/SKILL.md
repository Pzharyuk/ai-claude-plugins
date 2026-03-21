---
name: kubernetes-cluster
description: >
  Use this skill when the user asks to "create a Kubernetes cluster", "set up
  k8s on Proxmox", "deploy k3s", "bootstrap a cluster", "add worker nodes",
  "install kubeadm", "set up a control plane", "join nodes to a cluster", or
  any task involving provisioning or managing a Kubernetes cluster on Proxmox VMs.
metadata:
  version: "0.1.0"
---

# Kubernetes Cluster on Proxmox

Guide the user through provisioning and bootstrapping a Kubernetes cluster on their Proxmox VE infrastructure. Two supported paths: **k3s** (simpler, recommended for homelabs) and **kubeadm** (production-grade).

## Step 1 — Gather Requirements

Ask the user:
- How many control plane nodes? (1 for homelab, 3 for HA)
- How many worker nodes?
- Which Proxmox nodes to spread VMs across?
- k3s or kubeadm?
- VM specs (recommended minimums: 2 vCPU, 2GB RAM, 20GB disk per node)
- Base OS? (Ubuntu 22.04 LTS recommended)
- Do they have a cloud-init template already? If not, guide them through creating one.

## Step 2 — Provision VMs via Proxmox API

Use the `proxmox-manager` MCP tools:

1. `pve_next_vmid` — get starting VMID
2. `pve_clone_vm` — clone the base template for each node (control plane + workers)
3. `pve_update_vm_config` — set name, memory, cores, `onboot: true` for each VM
4. `pve_start_vm` — start all nodes

Name VMs clearly: `k8s-cp-01`, `k8s-worker-01`, `k8s-worker-02`, etc.

Spread VMs across Proxmox nodes for fault tolerance. Use `target` parameter in `pve_clone_vm`.

## Step 3 — Bootstrap the Cluster

After VMs are running, the user must SSH into each node. Provide exact commands.

See `references/k3s-setup.md` for k3s installation commands.
See `references/kubeadm-setup.md` for kubeadm installation commands.

## Step 4 — Verify and Post-Setup

After cluster is up:
1. Confirm nodes are Ready: `kubectl get nodes`
2. Install a CNI if using kubeadm (Flannel, Calico, or Cilium)
3. Optionally install: metrics-server, ingress-nginx, cert-manager
4. Save kubeconfig: `~/.kube/config`

## Ongoing Management

Once the cluster is running, you can use the Proxmox tools to:
- Snapshot all k8s VMs before upgrades: `pve_create_snapshot`
- Scale by cloning worker template and joining new nodes
- Migrate nodes to different Proxmox hosts for maintenance: `pve_migrate_vm`

## Cloud-Init Template Setup

If the user needs to create a cloud-init template, guide them through these steps on a Proxmox node (requires SSH to the node):

```bash
# Download Ubuntu 22.04 cloud image
wget https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img

# Create base VM
qm create 9000 --memory 2048 --cores 2 --name ubuntu-2204-template --net0 virtio,bridge=vmbr0

# Import disk
qm importdisk 9000 jammy-server-cloudimg-amd64.img local-lvm

# Configure boot disk and cloud-init
qm set 9000 --scsihw virtio-scsi-pci --scsi0 local-lvm:vm-9000-disk-0
qm set 9000 --boot c --bootdisk scsi0
qm set 9000 --ide2 local-lvm:cloudinit
qm set 9000 --serial0 socket --vga serial0
qm set 9000 --agent enabled=1
qm set 9000 --ipconfig0 ip=dhcp

# Convert to template
qm template 9000
```

Then set SSH keys and username via the Proxmox UI Cloud-Init tab before cloning.
