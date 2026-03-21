#!/usr/bin/env node
/**
 * Home Assistant MCP Server
 * Full management of devices, automations, scripts, scenes, history, and more.
 *
 * Required env vars:
 *   HA_URL    - e.g. http://homeassistant.local:8123
 *   HA_TOKEN  - Long-lived access token from HA Profile → Security → Long-Lived Access Tokens
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const HA_URL = process.env.HA_URL?.replace(/\/$/, "");
const HA_TOKEN = process.env.HA_TOKEN;

if (!HA_URL || !HA_TOKEN) {
  console.error("Error: HA_URL and HA_TOKEN environment variables are required");
  process.exit(1);
}

// ─── HA API helper ────────────────────────────────────────────────────────────

async function haRequest(method, path, body) {
  const res = await fetch(`${HA_URL}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { success: true };
  const text = await res.text();
  if (!res.ok) throw new Error(`HA API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  // ── System ──
  {
    name: "ha_get_config",
    description: "Get Home Assistant configuration info (version, location, components)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ha_check_api",
    description: "Check if the Home Assistant API is reachable and the token is valid",
    inputSchema: { type: "object", properties: {} },
  },

  // ── States / Entities ──
  {
    name: "ha_get_states",
    description: "List all entity states. Optionally filter by domain (light, switch, climate, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Filter by domain: light, switch, climate, sensor, binary_sensor, media_player, cover, lock, fan, vacuum, etc." },
        area: { type: "string", description: "Filter by area name (e.g. 'Living Room')" },
      },
    },
  },
  {
    name: "ha_get_state",
    description: "Get the current state and attributes of a specific entity",
    inputSchema: {
      type: "object",
      required: ["entity_id"],
      properties: {
        entity_id: { type: "string", description: "e.g. light.living_room" },
      },
    },
  },
  {
    name: "ha_set_state",
    description: "Directly set the state of an entity (for virtual/input entities). For real devices use ha_call_service.",
    inputSchema: {
      type: "object",
      required: ["entity_id", "state"],
      properties: {
        entity_id: { type: "string" },
        state: { type: "string" },
        attributes: { type: "object", description: "Optional state attributes" },
      },
    },
  },

  // ── Services (universal device control) ──
  {
    name: "ha_call_service",
    description: "Call any Home Assistant service to control devices. This is the primary way to control lights, switches, climate, media players, locks, covers, fans, etc.",
    inputSchema: {
      type: "object",
      required: ["domain", "service"],
      properties: {
        domain: { type: "string", description: "Service domain: light, switch, climate, media_player, cover, lock, fan, vacuum, input_boolean, script, scene, etc." },
        service: { type: "string", description: "Service name: turn_on, turn_off, toggle, set_temperature, play_media, lock, unlock, open_cover, start, etc." },
        entity_id: { type: "string", description: "Target entity ID (or comma-separated list)" },
        service_data: { type: "object", description: "Additional service data (e.g. brightness, color_temp, temperature, hvac_mode, media_content_id)" },
      },
    },
  },
  {
    name: "ha_list_services",
    description: "List all available services, optionally filtered by domain",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Filter by domain (optional)" },
      },
    },
  },

  // ── Areas & Devices ──
  {
    name: "ha_list_areas",
    description: "List all areas (rooms) defined in Home Assistant",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ha_list_devices",
    description: "List all devices registered in Home Assistant with their areas and entities",
    inputSchema: {
      type: "object",
      properties: {
        area_id: { type: "string", description: "Filter by area ID (optional)" },
      },
    },
  },

  // ── Automations ──
  {
    name: "ha_list_automations",
    description: "List all automations with their state (enabled/disabled) and last triggered time",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ha_get_automation",
    description: "Get the full configuration of a specific automation",
    inputSchema: {
      type: "object",
      required: ["automation_id"],
      properties: {
        automation_id: { type: "string", description: "Automation ID (e.g. automation.turn_off_lights)" },
      },
    },
  },
  {
    name: "ha_create_automation",
    description: "Create a new automation",
    inputSchema: {
      type: "object",
      required: ["alias", "trigger", "action"],
      properties: {
        alias: { type: "string", description: "Human-readable name for the automation" },
        description: { type: "string" },
        mode: { type: "string", description: "Automation mode: single, restart, queued, parallel (default: single)" },
        trigger: { type: "array", description: "Array of trigger definitions" },
        condition: { type: "array", description: "Optional array of condition definitions" },
        action: { type: "array", description: "Array of action definitions" },
        enabled: { type: "boolean", description: "Whether the automation is enabled (default: true)" },
      },
    },
  },
  {
    name: "ha_update_automation",
    description: "Update an existing automation by ID",
    inputSchema: {
      type: "object",
      required: ["automation_id"],
      properties: {
        automation_id: { type: "string" },
        alias: { type: "string" },
        description: { type: "string" },
        mode: { type: "string" },
        trigger: { type: "array" },
        condition: { type: "array" },
        action: { type: "array" },
        enabled: { type: "boolean" },
      },
    },
  },
  {
    name: "ha_delete_automation",
    description: "Delete an automation permanently",
    inputSchema: {
      type: "object",
      required: ["automation_id"],
      properties: {
        automation_id: { type: "string" },
      },
    },
  },
  {
    name: "ha_trigger_automation",
    description: "Manually trigger an automation to run immediately",
    inputSchema: {
      type: "object",
      required: ["entity_id"],
      properties: {
        entity_id: { type: "string", description: "Automation entity ID (e.g. automation.my_automation)" },
      },
    },
  },
  {
    name: "ha_toggle_automation",
    description: "Enable or disable an automation",
    inputSchema: {
      type: "object",
      required: ["entity_id", "enabled"],
      properties: {
        entity_id: { type: "string" },
        enabled: { type: "boolean", description: "true to enable, false to disable" },
      },
    },
  },

  // ── Scripts ──
  {
    name: "ha_list_scripts",
    description: "List all scripts defined in Home Assistant",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ha_run_script",
    description: "Run a script by entity ID",
    inputSchema: {
      type: "object",
      required: ["entity_id"],
      properties: {
        entity_id: { type: "string" },
        variables: { type: "object", description: "Optional variables to pass to the script" },
      },
    },
  },
  {
    name: "ha_create_script",
    description: "Create a new script",
    inputSchema: {
      type: "object",
      required: ["script_id", "alias", "sequence"],
      properties: {
        script_id: { type: "string", description: "Script ID (lowercase, underscores)" },
        alias: { type: "string" },
        description: { type: "string" },
        mode: { type: "string", description: "single, restart, queued, parallel" },
        sequence: { type: "array", description: "Array of action steps" },
        fields: { type: "object", description: "Optional variable fields definition" },
      },
    },
  },
  {
    name: "ha_delete_script",
    description: "Delete a script",
    inputSchema: {
      type: "object",
      required: ["script_id"],
      properties: {
        script_id: { type: "string" },
      },
    },
  },

  // ── Scenes ──
  {
    name: "ha_list_scenes",
    description: "List all scenes",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ha_activate_scene",
    description: "Activate a scene",
    inputSchema: {
      type: "object",
      required: ["entity_id"],
      properties: {
        entity_id: { type: "string" },
        transition: { type: "number", description: "Transition time in seconds (for light scenes)" },
      },
    },
  },
  {
    name: "ha_create_scene",
    description: "Create a new scene with specific entity states",
    inputSchema: {
      type: "object",
      required: ["scene_id", "name", "entities"],
      properties: {
        scene_id: { type: "string" },
        name: { type: "string" },
        entities: { type: "object", description: "Map of entity_id to desired state/attributes" },
      },
    },
  },

  // ── History & Logbook ──
  {
    name: "ha_get_history",
    description: "Get state history for one or more entities over a time period",
    inputSchema: {
      type: "object",
      required: ["entity_ids"],
      properties: {
        entity_ids: { type: "array", items: { type: "string" }, description: "List of entity IDs" },
        start_time: { type: "string", description: "ISO 8601 start time (default: 1 day ago)" },
        end_time: { type: "string", description: "ISO 8601 end time (default: now)" },
      },
    },
  },
  {
    name: "ha_get_logbook",
    description: "Get logbook entries (human-readable event log)",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Filter by entity (optional)" },
        start_time: { type: "string", description: "ISO 8601 start time (default: 24h ago)" },
        hours: { type: "number", description: "Number of hours to look back (alternative to start_time)" },
      },
    },
  },

  // ── Notifications ──
  {
    name: "ha_send_notification",
    description: "Send a notification via Home Assistant (mobile app, persistent, or other notify services)",
    inputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        title: { type: "string" },
        target: { type: "string", description: "Notify service target, e.g. notify.mobile_app_iphone or notify.all_devices (default: notify.notify)" },
        data: { type: "object", description: "Extra notification data (e.g. actions, image, url)" },
      },
    },
  },

  // ── Template ──
  {
    name: "ha_render_template",
    description: "Render a Jinja2 template string using Home Assistant state data",
    inputSchema: {
      type: "object",
      required: ["template"],
      properties: {
        template: { type: "string", description: "Jinja2 template string, e.g. '{{ states(\"light.living_room\") }}'" },
      },
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {
    // System
    case "ha_check_api":
      return await haRequest("GET", "/");
    case "ha_get_config":
      return await haRequest("GET", "/config");

    // States
    case "ha_get_states": {
      const states = await haRequest("GET", "/states");
      let filtered = states;
      if (args.domain) {
        filtered = filtered.filter((s) => s.entity_id.startsWith(`${args.domain}.`));
      }
      // Area filtering requires device registry — return with note if requested
      return filtered.map((s) => ({
        entity_id: s.entity_id,
        state: s.state,
        attributes: s.attributes,
        last_changed: s.last_changed,
      }));
    }
    case "ha_get_state":
      return await haRequest("GET", `/states/${args.entity_id}`);
    case "ha_set_state":
      return await haRequest("POST", `/states/${args.entity_id}`, {
        state: args.state,
        attributes: args.attributes || {},
      });

    // Services
    case "ha_list_services": {
      const services = await haRequest("GET", "/services");
      if (args.domain) return services.filter((s) => s.domain === args.domain);
      return services;
    }
    case "ha_call_service": {
      const data = { ...(args.service_data || {}) };
      if (args.entity_id) data.entity_id = args.entity_id;
      return await haRequest("POST", `/services/${args.domain}/${args.service}`, data);
    }

    // Areas & Devices
    case "ha_list_areas":
      return await haRequest("POST", "/template", {
        template: `{{ areas() | map('area_name') | list | tojson }}`
      }).catch(() =>
        haRequest("GET", "/config/area_registry/list").catch(() =>
          ({ note: "Area registry API not available in this HA version. Use ha_render_template with areas() for area info." })
        )
      );
    case "ha_list_devices":
      return await haRequest("GET", "/config/device_registry/list").catch(() =>
        ({ note: "Device registry direct API may not be available. Try ha_get_states with a domain filter instead." })
      );

    // Automations
    case "ha_list_automations": {
      const states = await haRequest("GET", "/states");
      return states
        .filter((s) => s.entity_id.startsWith("automation."))
        .map((s) => ({
          entity_id: s.entity_id,
          alias: s.attributes.friendly_name,
          state: s.state,
          last_triggered: s.attributes.last_triggered,
        }));
    }
    case "ha_get_automation": {
      const id = args.automation_id.replace("automation.", "");
      return await haRequest("GET", `/config/automation/config/${id}`);
    }
    case "ha_create_automation": {
      const id = (args.alias || "automation").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const body = {
        alias: args.alias,
        description: args.description || "",
        mode: args.mode || "single",
        trigger: args.trigger,
        condition: args.condition || [],
        action: args.action,
      };
      const result = await haRequest("POST", `/config/automation/config/${id}`, body);
      await haRequest("POST", "/services/automation/reload", {});
      return result;
    }
    case "ha_update_automation": {
      const id = args.automation_id.replace("automation.", "");
      const current = await haRequest("GET", `/config/automation/config/${id}`);
      const body = { ...current };
      for (const f of ["alias", "description", "mode", "trigger", "condition", "action"]) {
        if (args[f] !== undefined) body[f] = args[f];
      }
      const result = await haRequest("POST", `/config/automation/config/${id}`, body);
      await haRequest("POST", "/services/automation/reload", {});
      return result;
    }
    case "ha_delete_automation": {
      const id = args.automation_id.replace("automation.", "");
      const result = await haRequest("DELETE", `/config/automation/config/${id}`);
      await haRequest("POST", "/services/automation/reload", {});
      return result;
    }
    case "ha_trigger_automation":
      return await haRequest("POST", "/services/automation/trigger", {
        entity_id: args.entity_id,
      });
    case "ha_toggle_automation":
      return await haRequest("POST", `/services/automation/${args.enabled ? "turn_on" : "turn_off"}`, {
        entity_id: args.entity_id,
      });

    // Scripts
    case "ha_list_scripts": {
      const states = await haRequest("GET", "/states");
      return states
        .filter((s) => s.entity_id.startsWith("script."))
        .map((s) => ({
          entity_id: s.entity_id,
          name: s.attributes.friendly_name,
          state: s.state,
          last_triggered: s.attributes.last_triggered,
        }));
    }
    case "ha_run_script": {
      const data = { entity_id: args.entity_id };
      if (args.variables) Object.assign(data, args.variables);
      return await haRequest("POST", "/services/script/turn_on", data);
    }
    case "ha_create_script": {
      const body = {
        alias: args.alias,
        description: args.description || "",
        mode: args.mode || "single",
        sequence: args.sequence,
      };
      if (args.fields) body.fields = args.fields;
      const result = await haRequest("POST", `/config/script/config/${args.script_id}`, body);
      await haRequest("POST", "/services/script/reload", {});
      return result;
    }
    case "ha_delete_script": {
      const result = await haRequest("DELETE", `/config/script/config/${args.script_id}`);
      await haRequest("POST", "/services/script/reload", {});
      return result;
    }

    // Scenes
    case "ha_list_scenes": {
      const states = await haRequest("GET", "/states");
      return states
        .filter((s) => s.entity_id.startsWith("scene."))
        .map((s) => ({
          entity_id: s.entity_id,
          name: s.attributes.friendly_name,
          last_activated: s.attributes.last_activated,
        }));
    }
    case "ha_activate_scene": {
      const data = { entity_id: args.entity_id };
      if (args.transition !== undefined) data.transition = args.transition;
      return await haRequest("POST", "/services/scene/turn_on", data);
    }
    case "ha_create_scene":
      return await haRequest("POST", "/services/scene/create", {
        scene_id: args.scene_id,
        friendly_name: args.name,
        entities: args.entities,
      });

    // History & Logbook
    case "ha_get_history": {
      const start = args.start_time || new Date(Date.now() - 86400000).toISOString();
      const end = args.end_time ? `?end_time=${args.end_time}` : "";
      const ids = args.entity_ids.join(",");
      return await haRequest("GET", `/history/period/${start}?filter_entity_id=${ids}${end ? "&" + end.slice(1) : ""}`);
    }
    case "ha_get_logbook": {
      const hours = args.hours || 24;
      const start = args.start_time || new Date(Date.now() - hours * 3600000).toISOString();
      const entityParam = args.entity_id ? `?entity=${args.entity_id}` : "";
      return await haRequest("GET", `/logbook/${start}${entityParam}`);
    }

    // Notifications
    case "ha_send_notification": {
      const target = args.target || "notify/notify";
      const service = target.replace("notify.", "");
      const body = { message: args.message };
      if (args.title) body.title = args.title;
      if (args.data) body.data = args.data;
      return await haRequest("POST", `/services/notify/${service}`, body);
    }

    // Template
    case "ha_render_template":
      return await haRequest("POST", "/template", { template: args.template });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "homeassistant-manager", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
