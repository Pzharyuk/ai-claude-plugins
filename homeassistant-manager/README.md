# homeassistant-manager

A Claude Cowork plugin for full Home Assistant management — control any device, create and manage automations, scenes, and scripts, view history, and send notifications.

Part of [ai-claude-plugins](https://github.com/Pzharyuk/ai-claude-plugins).

## What You Can Do

- Control lights, switches, climate, locks, covers, fans, vacuums, media players — any HA device
- Create automations from natural language descriptions ("turn off the lights at 11pm", "notify me when the front door opens")
- List, edit, enable/disable, trigger, and delete automations
- Create and activate scenes (captured snapshots of device states)
- Create and run scripts (reusable action sequences)
- Check the state of any entity
- View history and logbook for any entity
- Send push notifications to your phone or other notify targets
- Render Jinja2 templates against live state data

## Skills

| Skill | Triggers |
|-------|---------|
| `device-control` | "turn on lights", "set thermostat", "lock the door", "dim kitchen to 50%" |
| `automation-management` | "create an automation", "list automations", "edit automation", "trigger automation" |
| `scenes-scripts` | "activate movie mode", "create a scene", "run goodnight routine", "create a script" |

## MCP Tools (30 tools)

### System
- `ha_check_api` — verify connectivity
- `ha_get_config` — HA version, location, loaded components

### States & Entities
- `ha_get_states` — list all entities, filterable by domain
- `ha_get_state` — get state + attributes of one entity
- `ha_set_state` — set state directly (for virtual entities)

### Device Control
- `ha_call_service` — universal service caller (controls all device types)
- `ha_list_services` — list available services by domain

### Areas & Devices
- `ha_list_areas` — list rooms/areas
- `ha_list_devices` — list all registered devices

### Automations
- `ha_list_automations` / `ha_get_automation`
- `ha_create_automation` / `ha_update_automation` / `ha_delete_automation`
- `ha_trigger_automation` / `ha_toggle_automation`

### Scripts
- `ha_list_scripts` / `ha_run_script`
- `ha_create_script` / `ha_delete_script`

### Scenes
- `ha_list_scenes` / `ha_activate_scene` / `ha_create_scene`

### History & Logbook
- `ha_get_history` — entity state history over time
- `ha_get_logbook` — human-readable event log

### Utilities
- `ha_send_notification` — push notifications via any notify service
- `ha_render_template` — evaluate Jinja2 templates against live data

## Setup

### 1. Generate a Long-Lived Access Token

In Home Assistant: **Profile → Security → Long-Lived Access Tokens → Create Token**

Give it a name (e.g. "Claude") and copy the token.

### 2. Set Environment Variables

```bash
export HA_URL="http://homeassistant.local:8123"
export HA_TOKEN="your-long-lived-access-token"
```

If your HA is remote (via Nabu Casa or a VPN), use the full URL:
```bash
export HA_URL="https://your-instance.ui.nabu.casa"
```

### 3. Install the Plugin

Install `homeassistant-manager.plugin` via the Cowork plugins interface.

### 4. Install Server Dependencies

```bash
cd <plugin-install-path>/server
npm install
```

## Usage Examples

- "Turn off all the lights"
- "Set the living room to 40% brightness warm white"
- "What's the temperature in the bedroom?"
- "Create an automation to turn on the porch light at sunset"
- "Show me all my automations"
- "Activate the movie scene"
- "Run the goodnight script"
- "Send me a notification that dinner is ready"
- "Show me the history for the front door sensor"
- "Create a scene called Focus Mode with office lights at 100% cool white"
