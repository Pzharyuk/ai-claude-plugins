#!/usr/bin/env node
/**
 * UniFi Protect MCP Server
 * Manage cameras, view events, snapshots, recordings, and smart detections.
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
  csrfToken = data?.csrfToken || res.headers.get("x-csrf-token") || "";
}

async function api(method, path, body, raw = false) {
  if (!sessionCookie) await login();
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: sessionCookie, "X-Csrf-Token": csrfToken },
    body: body ? JSON.stringify(body) : undefined,
    agent,
  });
  if (res.status === 401) { sessionCookie = null; await login(); return api(method, path, body, raw); }
  if (raw) return res;
  const text = await res.text();
  if (!res.ok) throw new Error(`UniFi Protect API ${res.status}: ${text}`);
  try { const json = JSON.parse(text); return json.data ?? json; } catch { return text; }
}

const P = "/proxy/protect/api";

const TOOLS = [
  { name: "protect_bootstrap", description: "Get full UniFi Protect system state — NVR info, all cameras, viewers, and sensors", inputSchema: { type: "object", properties: {} } },
  { name: "protect_list_cameras", description: "List all cameras with status, resolution, recording mode, and connection state", inputSchema: { type: "object", properties: {} } },
  { name: "protect_get_camera", description: "Get full configuration and status of a specific camera", inputSchema: { type: "object", required: ["camera_id"], properties: { camera_id: { type: "string" } } } },
  { name: "protect_update_camera", description: "Update camera settings (name, recording mode, motion sensitivity, smart detections, etc.)", inputSchema: { type: "object", required: ["camera_id"], properties: { camera_id: { type: "string" }, name: { type: "string" }, recordingMode: { type: "string", description: "always, motion, smart, never" }, motionSensitivity: { type: "number", description: "0-100" }, enableMotionDetection: { type: "boolean" }, smartDetectTypes: { type: "array", items: { type: "string" }, description: "person, vehicle, package, face, license_plate, animal" }, statusLight: { type: "boolean" } } } },
  { name: "protect_get_snapshot", description: "Get a snapshot URL from a camera (returns the direct URL to the JPEG image)", inputSchema: { type: "object", required: ["camera_id"], properties: { camera_id: { type: "string" }, width: { type: "number" }, ts: { type: "number", description: "Timestamp in ms for historical snapshot" } } } },
  { name: "protect_list_events", description: "List recent Protect events (motion, smart detections, rings, connections)", inputSchema: { type: "object", properties: { type: { type: "string", description: "motion, ring, smartDetectZone, disconnected, connected — omit for all" }, camera_id: { type: "string", description: "Filter by camera" }, start: { type: "number", description: "Start timestamp in ms (default: 1 hour ago)" }, end: { type: "number", description: "End timestamp in ms (default: now)" }, limit: { type: "number", description: "Max events to return (default 50)" } } } },
  { name: "protect_get_recording_url", description: "Get a URL to stream or download a recording clip for a time range", inputSchema: { type: "object", required: ["camera_id", "start", "end"], properties: { camera_id: { type: "string" }, start: { type: "number", description: "Start timestamp in ms" }, end: { type: "number", description: "End timestamp in ms" } } } },
  { name: "protect_list_viewers", description: "List UniFi Protect viewers (display monitors)", inputSchema: { type: "object", properties: {} } },
  { name: "protect_set_viewer_liveview", description: "Set which liveview a viewer/display shows", inputSchema: { type: "object", required: ["viewer_id", "liveview_id"], properties: { viewer_id: { type: "string" }, liveview_id: { type: "string" } } } },
  { name: "protect_list_liveviews", description: "List configured liveview layouts", inputSchema: { type: "object", properties: {} } },
  { name: "protect_reboot_camera", description: "Reboot a camera", inputSchema: { type: "object", required: ["camera_id"], properties: { camera_id: { type: "string" } } } },
  { name: "protect_nvr_info", description: "Get NVR hardware info, storage usage, and software version", inputSchema: { type: "object", properties: {} } },
];

async function callTool(name, args) {
  switch (name) {
    case "protect_bootstrap": {
      const data = await api("GET", `${P}/bootstrap`);
      return { nvr: { name: data.nvr?.name, version: data.nvr?.version, storage: data.nvr?.storageStats }, cameras: data.cameras?.map(c => ({ id: c.id, name: c.name, state: c.state, type: c.type, recordingMode: c.recordingSettings?.mode })) };
    }
    case "protect_nvr_info": {
      const data = await api("GET", `${P}/bootstrap`);
      return data.nvr;
    }
    case "protect_list_cameras": {
      const data = await api("GET", `${P}/cameras`);
      return data.map(c => ({ id: c.id, name: c.name, state: c.state, type: c.type, model: c.type, mac: c.mac, ip: c.host, recordingMode: c.recordingSettings?.mode, isConnected: c.isConnected, isMotionDetected: c.isMotionDetected, lastMotion: c.lastMotion, resolution: c.videoMode }));
    }
    case "protect_get_camera": return await api("GET", `${P}/cameras/${args.camera_id}`);
    case "protect_update_camera": {
      const { camera_id, ...updates } = args;
      const current = await api("GET", `${P}/cameras/${camera_id}`);
      const body = { ...current };
      if (updates.name) body.name = updates.name;
      if (updates.recordingMode) body.recordingSettings = { ...body.recordingSettings, mode: updates.recordingMode };
      if (updates.motionSensitivity !== undefined) body.motionZones = body.motionZones?.map(z => ({ ...z, sensitivity: updates.motionSensitivity }));
      if (updates.enableMotionDetection !== undefined) body.motionSettings = { ...body.motionSettings, isEnabled: updates.enableMotionDetection };
      if (updates.smartDetectTypes) body.smartDetectSettings = { ...body.smartDetectSettings, objectTypes: updates.smartDetectTypes };
      if (updates.statusLight !== undefined) body.ledSettings = { ...body.ledSettings, isEnabled: updates.statusLight };
      return await api("PATCH", `${P}/cameras/${camera_id}`, body);
    }
    case "protect_get_snapshot": {
      const params = new URLSearchParams();
      if (args.width) params.set("w", args.width);
      if (args.ts) params.set("ts", args.ts);
      const url = `${HOST}${P}/cameras/${args.camera_id}/snapshot?${params}`;
      return { snapshot_url: url, note: "Open this URL in a browser (authenticated session required). The image is served as JPEG." };
    }
    case "protect_list_events": {
      const params = new URLSearchParams();
      const start = args.start || Date.now() - 3600000;
      const end = args.end || Date.now();
      params.set("start", start);
      params.set("end", end);
      params.set("limit", args.limit || 50);
      if (args.type) params.set("types[]", args.type);
      if (args.camera_id) params.set("cameras[]", args.camera_id);
      const events = await api("GET", `${P}/events?${params}`);
      return events.map(e => ({ id: e.id, type: e.type, camera: e.cameraId, start: e.start, end: e.end, score: e.score, smartDetectTypes: e.smartDetectTypes, thumbnail: e.thumbnail }));
    }
    case "protect_get_recording_url": {
      const url = `${HOST}${P}/video/export?camera=${args.camera_id}&start=${args.start}&end=${args.end}`;
      return { recording_url: url, note: "Authenticated session required to stream/download this URL." };
    }
    case "protect_list_viewers": return await api("GET", `${P}/viewers`);
    case "protect_list_liveviews": return await api("GET", `${P}/liveviews`);
    case "protect_set_viewer_liveview": return await api("PATCH", `${P}/viewers/${args.viewer_id}`, { liveview: args.liveview_id });
    case "protect_reboot_camera": return await api("POST", `${P}/cameras/${args.camera_id}/reboot`);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server({ name: "unifi-protect", version: "0.1.0" }, { capabilities: { tools: {} } });
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
