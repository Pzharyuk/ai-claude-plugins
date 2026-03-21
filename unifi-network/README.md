# unifi-network

A Claude Cowork plugin for full UniFi network management — devices, clients, WiFi SSIDs, VLANs, port forwarding, firewall rules, and guest vouchers.

Part of [ai-claude-plugins](https://github.com/Pzharyuk/ai-claude-plugins).

## What You Can Do

- See all network devices (APs, switches, gateways) and their status
- List and manage connected clients — block, unblock, or reconnect them
- Enable/disable WiFi SSIDs and update passwords, bands, VLANs
- Create and delete port forwarding rules
- View firewall rules by ruleset
- Create guest WiFi vouchers
- Get overall network health (WAN, LAN, WLAN, VPN)
- View traffic statistics

## Skills

| Skill | Triggers |
|-------|---------|
| `network-management` | "list devices", "block client", "disable WiFi", "port forward", "network health", "create voucher" |

## MCP Tools (22 tools)

### Health & Stats
- `unifi_get_health` — WAN, LAN, WLAN, VPN health summary
- `unifi_get_site_info` — Controller version and site info
- `unifi_get_stats` — Traffic and throughput statistics

### Devices
- `unifi_list_devices` — All APs, switches, gateways
- `unifi_get_device` — Full details for a device
- `unifi_restart_device` — Reboot a device

### Clients
- `unifi_list_clients` / `unifi_get_client` / `unifi_list_known_clients`
- `unifi_block_client` / `unifi_unblock_client` / `unifi_reconnect_client`

### Networks & WiFi
- `unifi_list_networks` — VLANs and purpose networks
- `unifi_list_wlans` — All WiFi SSIDs
- `unifi_toggle_wlan` — Enable or disable an SSID
- `unifi_update_wlan` — Update SSID settings

### Port Forwarding
- `unifi_list_port_forwards` / `unifi_create_port_forward` / `unifi_delete_port_forward`

### Firewall
- `unifi_list_firewall_rules` — All rules, filterable by ruleset

### Guest Vouchers
- `unifi_list_vouchers` / `unifi_create_voucher`

## Setup

### 1. Set Environment Variables

```bash
export UNIFI_HOST="https://192.168.1.1"
export UNIFI_USERNAME="admin"
export UNIFI_PASSWORD="your-password"
export UNIFI_SITE="default"         # optional, default: "default"
export UNIFI_VERIFY_SSL="false"     # optional, set "true" for valid SSL certs
```

### 2. Install the Plugin

Install `unifi-network.plugin` via the Cowork plugins interface.

### 3. Install Server Dependencies

```bash
cd <plugin-install-path>/server
npm install
```

## Usage Examples

- "What devices are on my network?"
- "Block the device with MAC aa:bb:cc:dd:ee:ff"
- "Disable the guest WiFi"
- "Change the office WiFi password to NewPass123"
- "Forward port 443 to 192.168.1.10"
- "Show me network health"
- "Create 5 guest vouchers valid for 8 hours"
