# k3s Cluster Setup

k3s is a lightweight, production-grade Kubernetes distribution. Ideal for homelabs and resource-constrained environments. Single binary, built-in containerd, SQLite or etcd backend.

## Prerequisites (run on ALL nodes)

```bash
# Disable swap
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y curl
```

## Install Control Plane (first server node)

```bash
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --tls-san <CONTROL_PLANE_IP> \
  --tls-san <OPTIONAL_LOAD_BALANCER_IP>
```

For a **single-node cluster** (no HA):
```bash
curl -sfL https://get.k3s.io | sh -
```

Wait for it to be ready:
```bash
sudo k3s kubectl get nodes
```

Get the node token (needed for joining workers and additional control planes):
```bash
sudo cat /var/lib/rancher/k3s/server/node-token
```

## Add Additional Control Plane Nodes (HA only)

```bash
curl -sfL https://get.k3s.io | sh -s - server \
  --server https://<FIRST_CP_IP>:6443 \
  --token <NODE_TOKEN>
```

## Join Worker Nodes

```bash
curl -sfL https://get.k3s.io | K3S_URL=https://<CONTROL_PLANE_IP>:6443 K3S_TOKEN=<NODE_TOKEN> sh -
```

## Get kubeconfig

```bash
# On control plane node:
sudo cat /etc/rancher/k3s/k3s.yaml

# Replace 127.0.0.1 with the control plane IP, then copy to your local machine:
# ~/.kube/config
```

Or on your local machine:
```bash
scp user@<CP_IP>:/etc/rancher/k3s/k3s.yaml ~/.kube/config
sed -i 's/127.0.0.1/<CP_IP>/g' ~/.kube/config
```

## Verify

```bash
kubectl get nodes
kubectl get pods -A
```

## Uninstall

```bash
# Server nodes
/usr/local/bin/k3s-uninstall.sh

# Agent/worker nodes
/usr/local/bin/k3s-agent-uninstall.sh
```

## Useful Add-ons

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install metrics-server (already included in k3s by default)

# Install ingress-nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx

# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true
```

## Recommended VM Specs for k3s

| Role           | vCPU | RAM   | Disk  |
|----------------|------|-------|-------|
| Control plane  | 2    | 2 GB  | 20 GB |
| Worker (light) | 2    | 4 GB  | 20 GB |
| Worker (heavy) | 4    | 8 GB  | 50 GB |
