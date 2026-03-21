#!/usr/bin/env node
/**
 * UniFi Network MCP Server
 * Manage UniFi network devices, clients, SSIDs, VLANs, firewall rules, and port forwarding.
 *
 * Required env vars:
 *   UNIFI_HOST      - e.g. https://192.168.1.1  (your UDM/controller IP)
 *   UNIFI_USERNAME  - admin username
 *   UNIFI_PASSWORD  - admin password
 *
 * Optional:
 *   UNIFI_SITE      - site name (default: "default")
 *   UNIFI_VERIFY_SSL - set "true" to enforce SSL (default: false, self-signed certs common)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import https from "https";

const HOST = process.env.UNIFI_HOST?.replace(/\/$/, "");
const USERNAME = process.env.UNIFI_USERNAME;
const PASSWORD = process.env.UNIFI_PASSWORD;
const SITE = process.env.UNIFI_SITE || "default";
const VERIFY_SSL = process.env.UNIFI_VERIFY_SSL === "true";

if (!HOST || !USERNAME || !PASSWORD) {
  console.error("Error: UNIFI_HOST, UNIFI_USERNAME, and UNIFI_PASSWORD are required");
  process.exit(1);
}

const agent = new https.Agent({ rejectUnauthorized: VERIFY_SSL });
let sessionCookie = null;

async function login() {
  const res = await fetch(`${HOST}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    agent,
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  sessionCookie = setCookie?.match(/TOKEN=[^;]+/)?.[0] || setCookie?.match(/unifises=[^;]+/)?.[0];
  return res.json();
}

async function api(method, path, body) {
  if (!sessionCookie) await login();
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
      "X-Csrf-Token": sessionCookie?.split("=")?.[1]?.substring(0, 20) || "",
    },
    body: body ? JSON.stringify(body) : undefined,
    agent,
  });
  if (res.status === 401) {
    sessionCookie = null;
    await login();
    return api(method, path, body);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`UniFi API ${res.status}: ${text}`);
  try {
    const json = JSON.parse(text);
    return json.data ?? json;
  } catch { return text; }
}

const N = (path) => `/proxy/network/api/s/${SITE}${path}`;

const TOOLS = [
  { name: "unifi_get_site_info", description: "Get site info and controller version", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_list_devices", description: "List all UniFi network devices (APs, switches, gateways) with status, uptime, and load", inputSchema: { type: "object", properties: { type: { type: "string", description: "Filter: uap (APs), usw (switches), ugw (gateways), udm — omit for all" } } } },
  { name: "unifi_get_device", description: "Get detailed info about a specific device", inputSchema: { type: "object", required: ["mac"], properties: { mac: { type: "string" } } } },
  { name: "unifi_restart_device", description: "Restart a UniFi device", inputSchema: { type: "object", required: ["mac"], properties: { mac: { type: "string" } } } },
  { name: "unifi_list_clients", description: "List connected clients (wireless and wired) with IP, hostname, signal, and usage stats", inputSchema: { type: "object", properties: { type: { type: "string", description: "wireless, wired, or all (default)" } } } },
  { name: "unifi_get_client", description: "Get details for a specific client by MAC address", inputSchema: { type: "object", required: ["mac"], properties: { mac: { type: "string" } } } },
  { name: "unifi_block_client", description: "Block a client from the network", inputSchema: { type: "object", required: ["mac"], properties: { mac: { type: "string" } } } },
  { name: "unifi_unblock_client", description: "Unblock a previously blocked client", inputSchema: { type: "object", required: ["mac"], properties: { mac: { type: "string" } } } },
  { name: "unifi_reconnect_client", description: "Force a wireless client to reconnect", inputSchema: { type: "object", required: ["mac"], properties: { mac: { type: "string" } } } },
  { name: "unifi_list_networks", description: "List all configured networks (VLANs and purpose networks)", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_list_wlans", description: "List all WiFi SSIDs with security settings and enabled status", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_toggle_wlan", description: "Enable or disable a WiFi SSID", inputSchema: { type: "object", required: ["wlan_id", "enabled"], properties: { wlan_id: { type: "string" }, enabled: { type: "boolean" } } } },
  { name: "unifi_update_wlan", description: "Update a WiFi network (name, password, security, band, etc.)", inputSchema: { type: "object", required: ["wlan_id"], properties: { wlan_id: { type: "string" }, name: { type: "string" }, x_passphrase: { type: "string", description: "WPA password" }, enabled: { type: "boolean" }, band: { type: "string", description: "2g, 5g, or both" }, vlan_enabled: { type: "boolean" }, vlanid: { type: "number" } } } },
  { name: "unifi_list_port_forwards", description: "List all port forwarding rules", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_create_port_forward", description: "Create a port forwarding rule", inputSchema: { type: "object", required: ["name", "dst_port", "fwd", "fwd_port", "proto"], properties: { name: { type: "string" }, dst_port: { type: "string", description: "External port (e.g. '80' or '8080-8090')" }, fwd: { type: "string", description: "Internal destination IP" }, fwd_port: { type: "string", description: "Internal port" }, proto: { type: "string", description: "tcp, udp, or tcp_udp" }, enabled: { type: "boolean" }, log: { type: "boolean" } } } },
  { name: "unifi_delete_port_forward", description: "Delete a port forwarding rule", inputSchema: { type: "object", required: ["rule_id"], properties: { rule_id: { type: "string" } } } },
  { name: "unifi_list_firewall_rules", description: "List firewall rules", inputSchema: { type: "object", properties: { ruleset: { type: "string", description: "WAN_IN, WAN_OUT, LAN_IN, LAN_OUT, GUEST_IN, GUEST_OUT — omit for all" } } } },
  { name: "unifi_list_known_clients", description: "List all known (ever-connected) clients including offline ones", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_get_stats", description: "Get site-level throughput and traffic statistics", inputSchema: { type: "object", properties: { attrs: { type: "array", items: { type: "string" }, description: "Specific stats to fetch (optional)" } } } },
  { name: "unifi_get_health", description: "Get overall network health summary (WAN, LAN, WLAN, VPN status)", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_list_vouchers", description: "List guest WiFi vouchers", inputSchema: { type: "object", properties: {} } },
  { name: "unifi_create_voucher", description: "Create guest WiFi voucher(s)", inputSchema: { type: "object", properties: { n: { type: "number", description: "Number of vouchers (default 1)" }, expire: { type: "number", description: "Expiry in minutes (default 1440 = 24h)" }, quota: { type: "number", description: "Usage quota in MB (0 = unlimited)" }, note: { type: "string" } } } },
];

async function callTool(name, args) {
  switch (name) {
    case "unifi_get_site_info": return await api("GET", "/proxy/network/api/self");
    case "unifi_get_health": return await api("GET", N("/stat/health"));
    case "unifi_get_stats": return await api("POST", N("/stat/report/5minutes.site"), { attrs: args.attrs || ["bytes", "num_sta", "time"] });
    case "unifi_list_devices": {
      const devices = await api("GET", N("/stat/device"));
      if (args.type) return devices.filter(d => d.type === args.type || d.model?.toLowerCase().startsWith(args.type.toLowerCase()));
      return devices.map(d => ({ name: d.name, mac: d.mac, model: d.model, type: d.type, state: d.state === 1 ? "connected" : "disconnected", uptime: d.uptime, ip: d.ip, version: d.version, num_sta: d.num_sta }));
    }
    case "unifi_get_device": return await api("GET", N(`/stat/device/${args.mac}`));
    case "unifi_restart_device": return await api("POST", N("/cmd/devmgr"), { cmd: "restart", mac: args.mac });
    case "unifi_list_clients": {
      const clients = await api("GET", N("/stat/sta"));
      const filtered = args.type === "wireless" ? clients.filter(c => c.is_wired === false)
        : args.type === "wired" ? clients.filter(c => c.is_wired === true) : clients;
      return filtered.map(c => ({ hostname: c.hostname, mac: c.mac, ip: c.ip, is_wired: c.is_wired, essid: c.essid, signal: c.signal, uptime: c.uptime, tx_bytes: c.tx_bytes, rx_bytes: c.rx_bytes, blocked: c.blocked, ap_mac: c.ap_mac }));
    }
    case "unifi_get_client": return await api("GET", N(`/stat/user/${args.mac}`));
    case "unifi_block_client": return await api("POST", N("/cmd/stamgr"), { cmd: "block-sta", mac: args.mac });
    case "unifi_unblock_client": return await api("POST", N("/cmd/stamgr"), { cmd: "unblock-sta", mac: args.mac });
    case "unifi_reconnect_client": return await api("POST", N("/cmd/stamgr"), { cmd: "kick-sta", mac: args.mac });
    case "unifi_list_networks": return await api("GET", N("/rest/networkconf"));
    case "unifi_list_wlans": return await api("GET", N("/rest/wlanconf"));
    case "unifi_toggle_wlan": {
      const wlan = (await api("GET", N(`/rest/wlanconf/${args.wlan_id}`)))[0];
      return await api("PUT", N(`/rest/wlanconf/${args.wlan_id}`), { ...wlan, enabled: args.enabled });
    }
    case "unifi_update_wlan": {
      const { wlan_id, ...updates } = args;
      const wlan = (await api("GET", N(`/rest/wlanconf/${wlan_id}`)))[0];
      return await api("PUT", N(`/rest/wlanconf/${wlan_id}`), { ...wlan, ...updates });
    }
    case "unifi_list_port_forwards": return await api("GET", N("/rest/portforward"));
    case "unifi_create_port_forward": return await api("POST", N("/rest/portforward"), { name: args.name, dst_port: args.dst_port, fwd: args.fwd, fwd_port: args.fwd_port, proto: args.proto, enabled: args.enabled !== false, log: args.log || false, pfwd_interface: "wan" });
    case "unifi_delete_port_forward": return await api("DELETE", N(`/rest/portforward/${args.rule_id}`));
    case "unifi_list_firewall_rules": {
      const rules = await api("GET", N("/rest/firewallrule"));
      if (args.ruleset) return rules.filter(r => r.ruleset === args.ruleset);
      return rules;
    }
    case "unifi_list_known_clients": return await api("GET", N("/rest/user"));
    case "unifi_list_vouchers": return await api("GET", N("/stat/voucher"));
    case "unifi_create_voucher": return await api("POST", N("/cmd/hotspot"), { cmd: "create-voucher", expire: args.expire || 1440, n: args.n || 1, quota: args.quota || 0, note: args.note || "" });
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server({ name: "unifi-network", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const result = await callTool(name, args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});
const transport = new StdioServerTransport();
await server.connect(transport);
