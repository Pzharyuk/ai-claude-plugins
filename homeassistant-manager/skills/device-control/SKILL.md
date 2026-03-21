---
name: device-control
description: >
  Use this skill when the user asks to "control devices", "turn on lights",
  "turn off a switch", "set the thermostat", "lock the door", "dim the lights",
  "set brightness", "change color", "open the blinds", "control the TV",
  "play music", "set the fan speed", "start the vacuum", "check if lights are on",
  "list all devices", "what's the temperature", or any task involving
  controlling or querying Home Assistant devices.
metadata:
  version: "0.1.0"
---

# Home Assistant Device Control

Use the `homeassistant-manager` MCP server tools to control and query all devices in Home Assistant.

## Core Tool: ha_call_service

`ha_call_service` is the universal action tool. Most device control flows through it.

Structure:
- `domain` — device type (light, switch, climate, media_player, cover, lock, fan, vacuum, etc.)
- `service` — what to do (turn_on, turn_off, toggle, set_temperature, etc.)
- `entity_id` — target entity
- `service_data` — extra parameters (brightness, color_temp, temperature, etc.)

## Common Device Workflows

### Lights
```
turn_on: domain=light, service=turn_on, entity_id=light.living_room
dim to 50%: service_data={brightness_pct: 50}
warm white: service_data={color_temp_kelvin: 2700}
color: service_data={rgb_color: [255, 0, 0]}
turn off all: entity_id=all (with domain=light)
```

### Switches & Plugs
```
domain=switch, service=turn_on/turn_off/toggle
```

### Climate / Thermostat
```
set temp: domain=climate, service=set_temperature, service_data={temperature: 72}
set mode: domain=climate, service=set_hvac_mode, service_data={hvac_mode: "heat"/"cool"/"auto"/"off"}
set fan: domain=climate, service=set_fan_mode, service_data={fan_mode: "auto"/"low"/"high"}
```

### Locks
```
lock:   domain=lock, service=lock
unlock: domain=lock, service=unlock
```

### Covers (blinds, garage doors, curtains)
```
open:    domain=cover, service=open_cover
close:   domain=cover, service=close_cover
set pos: domain=cover, service=set_cover_position, service_data={position: 50}
```

### Media Players
```
play:   domain=media_player, service=media_play
pause:  domain=media_player, service=media_pause
volume: domain=media_player, service=volume_set, service_data={volume_level: 0.5}
source: domain=media_player, service=select_source, service_data={source: "Spotify"}
```

### Fans
```
turn on/off:  domain=fan, service=turn_on/turn_off
speed:        domain=fan, service=set_percentage, service_data={percentage: 50}
oscillate:    domain=fan, service=oscillate, service_data={oscillating: true}
```

### Vacuum
```
start:  domain=vacuum, service=start
return: domain=vacuum, service=return_to_base
pause:  domain=vacuum, service=pause
```

## Querying Devices

- `ha_get_states` with a domain filter — list all entities of a type
- `ha_get_state` — check a specific entity's state and attributes
- `ha_render_template` — compute values from state data (e.g. average temperature)

## Finding Entity IDs

If the user doesn't know an entity ID:
1. Call `ha_get_states` with the relevant domain
2. Match by `attributes.friendly_name` to find the right entity
3. Use that entity_id

## Reference
See `references/domains-and-services.md` for the full list of domains, services, and service data fields.
