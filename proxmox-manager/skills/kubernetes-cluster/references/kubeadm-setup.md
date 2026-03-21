# kubeadm Cluster Setup

Production-grade Kubernetes using kubeadm. More control than k3s, standard upstream Kubernetes.

## Prerequisites (ALL nodes)

```bash
# Disable swap
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Load required kernel modules
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# Kernel settings
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# Install containerd
sudo apt update && sudo apt install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd

# Install kubeadm, kubelet, kubectl
sudo apt install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt update
sudo apt install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

## Initialize Control Plane

```bash
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=<CONTROL_PLANE_IP>

# Set up kubectl access
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Save the `kubeadm join` command printed at the end — you'll need it for workers.

## Install CNI (required — choose one)

### Flannel (simple)
```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

### Calico (full network policy support)
```bash
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/tigera-operator.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/custom-resources.yaml
```

### Cilium (advanced — eBPF-based)
```bash
curl -L --remote-name-all https://github.com/cilium/cilium-cli/releases/latest/download/cilium-linux-amd64.tar.gz
sudo tar xzvfC cilium-linux-amd64.tar.gz /usr/local/bin
cilium install
```

## Join Worker Nodes

Run the join command from `kubeadm init` output on each worker:

```bash
sudo kubeadm join <CP_IP>:6443 --token <TOKEN> \
  --discovery-token-ca-cert-hash sha256:<HASH>
```

If you lost the join command, regenerate it:
```bash
kubeadm token create --print-join-command
```

## Verify Cluster

```bash
kubectl get nodes
kubectl get pods -A
```

All nodes should show `Ready` after CNI is installed (may take 1-2 minutes).

## Recommended VM Specs for kubeadm

| Role           | vCPU | RAM   | Disk  |
|----------------|------|-------|-------|
| Control plane  | 2    | 4 GB  | 30 GB |
| Worker (light) | 2    | 4 GB  | 30 GB |
| Worker (heavy) | 4    | 8 GB  | 50 GB |

## HA Control Plane (3 nodes)

For 3 control plane nodes, you need a load balancer (HAProxy or kube-vip) in front.

With kube-vip (VIP-based, no external LB needed):
```bash
# Run on first control plane before kubeadm init
export VIP=<VIRTUAL_IP>
export INTERFACE=eth0
KVVERSION=$(curl -sL https://api.github.com/repos/kube-vip/kube-vip/releases | jq -r ".[0].name")
alias kube-vip="ctr image pull ghcr.io/kube-vip/kube-vip:$KVVERSION; ctr run --rm --net-host ghcr.io/kube-vip/kube-vip:$KVVERSION vip /kube-vip"
kube-vip manifest pod --interface $INTERFACE --address $VIP --controlplane --services --arp --leaderElection | tee /etc/kubernetes/manifests/kube-vip.yaml

# Then init with the VIP as control plane endpoint:
sudo kubeadm init --control-plane-endpoint "<VIP>:6443" --upload-certs \
  --pod-network-cidr=10.244.0.0/16
```

Join additional control planes with the `--control-plane` flag and `--certificate-key` from init output.
