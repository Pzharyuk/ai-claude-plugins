# UniFi Network Management

You have full control over the UniFi network infrastructure via the `unifi-network` MCP tools. Use them to manage devices, clients, WiFi networks, VLANs, port forwarding, and firewall rules.

## Tools Overview

### Health & Stats
- `unifi_get_health` — Overall network health: WAN, LAN, WLAN, VPN status. **Start here for status checks.**
- `unifi_get_site_info` — Controller version and site metadata
- `unifi_get_stats` — Throughput and traffic statistics (bytes, clients, time)

### Devices (APs, Switches, Gateways)
- `unifi_list_devices` — List all devices; filter by type: `uap` (APs), `usw` (switches), `ugw` (gateways)
- `unifi_get_device` — Full details for a device by MAC address
- `unifi_restart_device` — Reboot a device by MAC

### Clients
- `unifi_list_clients` — Active connected clients; filter by `wireless`, `wired`, or `all`
- `unifi_get_client` — Details for one client by MAC
- `unifi_list_known_clients` — All ever-seen clients including offline ones
- `unifi_block_client` — Block a client from the network
- `unifi_unblock_client` — Unblock a client
- `unifi_reconnect_client` — Force a wireless client to reconnect (kick-sta)

### Networks & WiFi
- `unifi_list_networks` — All configured networks (VLANs, purpose networks)
- `unifi_list_wlans` — All WiFi SSIDs with security and status
- `unifi_toggle_wlan` — Enable or disable a WiFi SSID
- `unifi_update_wlan` — Update SSID name, password, band, VLAN, etc.

### Port Forwarding
- `unifi_list_port_forwards` — List all port forwarding rules
- `unifi_create_port_forward` — Create a new rule (name, external port, internal IP/port, protocol)
- `unifi_delete_port_forward` — Remove a rule by ID

### Firewall
- `unifi_list_firewall_rules` — List rules; filter by ruleset: `WAN_IN`, `WAN_OUT`, `LAN_IN`, `LAN_OUT`, `GUEST_IN`, `GUEST_OUT`

### Guest Vouchers
- `unifi_list_vouchers` — List active guest WiFi vouchers
- `unifi_create_voucher` — Generate voucher(s) with custom expiry, quota, and note

## Workflows

### Check network health
```
unifi_get_health → review WAN/LAN/WLAN status
```

### Find and block an unknown device
```
unifi_list_clients (type: wireless)
→ identify suspicious MAC
→ unifi_block_client (mac: "xx:xx:xx:xx:xx:xx")
```

### Disable guest WiFi after hours
```
unifi_list_wlans → find guest SSID ID
→ unifi_toggle_wlan (wlan_id: "...", enabled: false)
```

### Change WiFi password
```
unifi_list_wlans → find SSID ID
→ unifi_update_wlan (wlan_id: "...", x_passphrase: "newpassword")
```

### Open a port for a service
```
unifi_create_port_forward (
  name: "Plex",
  dst_port: "32400",
  fwd: "192.168.1.50",
  fwd_port: "32400",
  proto: "tcp"
)
```

### Create guest WiFi vouchers
```
unifi_create_voucher (n: 5, expire: 480, note: "Conference guests")
→ unifi_list_vouchers → share codes with guests
```

## Notes
- MAC addresses are case-insensitive but typically lowercase with colons: `aa:bb:cc:dd:ee:ff`
- `UNIFI_SITE` defaults to `default` — only change if you have multiple sites
- Use `unifi_list_known_clients` to find devices that aren't currently connected
- Restarting a device causes a brief outage for clients connected to it
