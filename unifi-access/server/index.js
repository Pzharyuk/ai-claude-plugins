#!/usr/bin/env node
/**
 * UniFi Access MCP Server
 * Manage doors, users, access policies, credentials, and activity logs.
 *
 * Required env vars:
 *   UNIFI_HOST      - e.g. https://192.168.1.1
 *   UNIFI_USERNAME  - admin username
 *   UNIFI_PASSWORD  - admin password
 *   UNIFI_VERIFY_SSL - "true" to enforce SSL (default: false)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import https from "https";

const HOST = process.env.UNIFI_HOST?.replace(/\/$/, "");
const USERNAME = process.env.UNIFI_USERNAME;
const PASSWORD = process.env.UNIFI_PASSWORD;
const VERIFY_SSL = process.env.UNIFI_VERIFY_SSL === "true";

if (!HOST || !USERNAME || !PASSWORD) {
  console.error("Error: UNIFI_HOST, UNIFI_USERNAME, and UNIFI_PASSWORD are required");
  process.exit(1);
}

const agent = new https.Agent({ rejectUnauthorized: VERIFY_SSL });
let sessionCookie = null;
let csrfToken = null;

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
  const data = await res.json();
  csrfToken = data?.csrfToken || "";
}

async function api(method, path, body) {
  if (!sessionCookie) await login();
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: sessionCookie, "X-Csrf-Token": csrfToken },
    body: body ? JSON.stringify(body) : undefined,
    agent,
  });
  if (res.status === 401) { sessionCookie = null; await login(); return api(method, path, body); }
  const text = await res.text();
  if (!res.ok) throw new Error(`UniFi Access API ${res.status}: ${text}`);
  try { const json = JSON.parse(text); return json.data ?? json; } catch { return text; }
}

const A = "/proxy/access/api/v1";

const TOOLS = [
  { name: "access_list_devices", description: "List all UniFi Access hardware devices (hubs, readers, door controllers)", inputSchema: { type: "object", properties: {} } },
  { name: "access_list_doors", description: "List all configured doors with lock status and access mode", inputSchema: { type: "object", properties: {} } },
  { name: "access_get_door", description: "Get details and current status of a specific door", inputSchema: { type: "object", required: ["door_id"], properties: { door_id: { type: "string" } } } },
  { name: "access_unlock_door", description: "Unlock a door (temporarily or set to unlocked mode)", inputSchema: { type: "object", required: ["door_id"], properties: { door_id: { type: "string" }, duration: { type: "number", description: "How long to unlock in seconds (default: momentary pulse)" } } } },
  { name: "access_lock_door", description: "Lock a door", inputSchema: { type: "object", required: ["door_id"], properties: { door_id: { type: "string" } } } },
  { name: "access_set_door_mode", description: "Set a door's access mode", inputSchema: { type: "object", required: ["door_id", "mode"], properties: { door_id: { type: "string" }, mode: { type: "string", description: "custom (normal access control), always_unlock (always open), lockdown (always locked)" } } } },
  { name: "access_list_users", description: "List all Access users with their name, status, and assigned door groups", inputSchema: { type: "object", properties: { page: { type: "number" }, page_size: { type: "number" } } } },
  { name: "access_get_user", description: "Get details for a specific access user", inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" } } } },
  { name: "access_create_user", description: "Create a new access user", inputSchema: { type: "object", required: ["first_name", "last_name"], properties: { first_name: { type: "string" }, last_name: { type: "string" }, email: { type: "string" }, employee_number: { type: "string" }, onboard_time: { type: "number", description: "Unix timestamp of access start (optional)" }, expiry_time: { type: "number", description: "Unix timestamp of access expiry (optional)" } } } },
  { name: "access_update_user", description: "Update an existing access user's details", inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" }, first_name: { type: "string" }, last_name: { type: "string" }, email: { type: "string" }, employee_number: { type: "string" } } } },
  { name: "access_delete_user", description: "Delete an access user (removes all their credentials and access)", inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" } } } },
  { name: "access_list_door_groups", description: "List door groups (access levels) — groups that link users to sets of doors", inputSchema: { type: "object", properties: {} } },
  { name: "access_get_door_group", description: "Get details of a door group including which doors and schedules", inputSchema: { type: "object", required: ["group_id"], properties: { group_id: { type: "string" } } } },
  { name: "access_create_door_group", description: "Create a new door group (access level)", inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" }, doors: { type: "array", items: { type: "string" }, description: "Array of door IDs to include" } } } },
  { name: "access_assign_user_to_group", description: "Add a user to a door group (grant access)", inputSchema: { type: "object", required: ["user_id", "group_id"], properties: { user_id: { type: "string" }, group_id: { type: "string" } } } },
  { name: "access_remove_user_from_group", description: "Remove a user from a door group (revoke access)", inputSchema: { type: "object", required: ["user_id", "group_id"], properties: { user_id: { type: "string" }, group_id: { type: "string" } } } },
  { name: "access_list_credentials", description: "List credentials (PINs, NFC cards, mobile passes) for a user", inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" } } } },
  { name: "access_create_pin", description: "Create a PIN credential for a user", inputSchema: { type: "object", required: ["user_id", "pin"], properties: { user_id: { type: "string" }, pin: { type: "string", description: "4-8 digit PIN" } } } },
  { name: "access_delete_credential", description: "Delete a credential from a user", inputSchema: { type: "object", required: ["user_id", "credential_id"], properties: { user_id: { type: "string" }, credential_id: { type: "string" } } } },
  { name: "access_get_activity_logs", description: "Get door access activity logs — who accessed what and when", inputSchema: { type: "object", properties: { door_id: { type: "string", description: "Filter by door (optional)" }, user_id: { type: "string", description: "Filter by user (optional)" }, start: { type: "number", description: "Start timestamp in ms (default: 24h ago)" }, end: { type: "number", description: "End timestamp in ms (default: now)" }, limit: { type: "number", description: "Max entries (default 100)" } } } },
  { name: "access_list_schedules", description: "List access schedules (time restrictions for door groups)", inputSchema: { type: "object", properties: {} } },
];

async function callTool(name, args) {
  switch (name) {
    case "access_list_devices": return await api("GET", `${A}/devices`);
    case "access_list_doors": return await api("GET", `${A}/doors`);
    case "access_get_door": return await api("GET", `${A}/doors/${args.door_id}`);
    case "access_unlock_door": return await api("PUT", `${A}/doors/${args.door_id}/unlock`, { duration: args.duration });
    case "access_lock_door": return await api("PUT", `${A}/doors/${args.door_id}/lock`);
    case "access_set_door_mode": return await api("PUT", `${A}/doors/${args.door_id}`, { door_guard_ids: [], access_mode: args.mode });
    case "access_list_users": {
      const params = new URLSearchParams({ page: args.page || 1, page_size: args.page_size || 50 });
      return await api("GET", `${A}/users?${params}`);
    }
    case "access_get_user": return await api("GET", `${A}/users/${args.user_id}`);
    case "access_create_user": {
      const body = { first_name: args.first_name, last_name: args.last_name };
      if (args.email) body.email = args.email;
      if (args.employee_number) body.employee_number = args.employee_number;
      if (args.onboard_time) body.onboard_time = args.onboard_time;
      if (args.expiry_time) body.expiry_time = args.expiry_time;
      return await api("POST", `${A}/users`, body);
    }
    case "access_update_user": {
      const { user_id, ...updates } = args;
      return await api("PUT", `${A}/users/${user_id}`, updates);
    }
    case "access_delete_user": return await api("DELETE", `${A}/users/${args.user_id}`);
    case "access_list_door_groups": return await api("GET", `${A}/door_groups`);
    case "access_get_door_group": return await api("GET", `${A}/door_groups/${args.group_id}`);
    case "access_create_door_group": return await api("POST", `${A}/door_groups`, { name: args.name, doors: args.doors || [] });
    case "access_assign_user_to_group": return await api("PUT", `${A}/door_groups/${args.group_id}/user/${args.user_id}`);
    case "access_remove_user_from_group": return await api("DELETE", `${A}/door_groups/${args.group_id}/user/${args.user_id}`);
    case "access_list_credentials": return await api("GET", `${A}/users/${args.user_id}/credentials`);
    case "access_create_pin": return await api("POST", `${A}/users/${args.user_id}/credentials`, { type: "pin", pin_code: args.pin });
    case "access_delete_credential": return await api("DELETE", `${A}/users/${args.user_id}/credentials/${args.credential_id}`);
    case "access_get_activity_logs": {
      const params = new URLSearchParams();
      const start = args.start || Date.now() - 86400000;
      const end = args.end || Date.now();
      params.set("start", start);
      params.set("end", end);
      params.set("limit", args.limit || 100);
      if (args.door_id) params.set("door_id", args.door_id);
      if (args.user_id) params.set("actor_id", args.user_id);
      return await api("GET", `${A}/activity_logs?${params}`);
    }
    case "access_list_schedules": return await api("GET", `${A}/schedules`);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server({ name: "unifi-access", version: "0.1.0" }, { capabilities: { tools: {} } });
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
