---
name: scenes-scripts
description: >
  Use this skill when the user asks to "create a scene", "activate a scene",
  "save the current lights as a scene", "list scenes", "create a script",
  "run a script", "make a script that does X", "list scripts", "delete a
  script", "movie mode", "goodnight routine", "morning routine", or any task
  involving Home Assistant scenes or scripts.
metadata:
  version: "0.1.0"
---

# Home Assistant Scenes & Scripts

## Scenes

Scenes capture a snapshot of entity states and restore them on activation.

### List scenes
`ha_list_scenes` — shows all scenes with last activated time.

### Activate a scene
`ha_activate_scene` with `entity_id` and optional `transition` (seconds for light transitions).

### Create a scene
`ha_create_scene` with:
- `scene_id` — lowercase, underscores (e.g. `movie_time`)
- `name` — friendly name (e.g. "Movie Time")
- `entities` — map of entity_id → desired state

Entity state formats:
```json
{
  "light.living_room": { "state": "on", "brightness": 80, "color_temp_kelvin": 2700 },
  "light.kitchen": { "state": "off" },
  "media_player.tv": { "state": "on" },
  "switch.fan": { "state": "on" }
}
```

### Common scene ideas
- `morning` — bright lights, warm color temperature
- `movie_time` — dim lights, close blinds, turn on TV
- `dinner` — medium warm lights
- `bedtime` — all off except hallway dim
- `away` — all lights and devices off
- `party` — colored lights, music on

## Scripts

Scripts are reusable sequences of actions, optionally accepting input variables.

### List scripts
`ha_list_scripts` — shows all scripts with last triggered time.

### Run a script
`ha_run_script` with `entity_id` (e.g. `script.goodnight`) and optional `variables`.

### Create a script
`ha_create_script` with:
- `script_id` — lowercase, underscores
- `alias` — friendly name
- `sequence` — array of action steps (same format as automation actions)
- `fields` — optional variable definitions for parameterized scripts

### Delete a script
`ha_delete_script` — always confirm before deleting.

### Script vs Automation
- **Script**: A reusable sequence you call explicitly. No trigger.
- **Automation**: Runs automatically in response to a trigger.
- Automations often call scripts to share action sequences between multiple automations.

### Example: Goodnight routine script
```json
{
  "script_id": "goodnight",
  "alias": "Goodnight Routine",
  "sequence": [
    { "service": "light.turn_off", "target": { "entity_id": "all" } },
    { "service": "lock.lock", "target": { "entity_id": "lock.front_door" } },
    { "service": "media_player.turn_off", "target": { "entity_id": "all" } },
    { "service": "climate.set_temperature", "target": { "entity_id": "climate.thermostat" }, "data": { "temperature": 68 } },
    { "service": "notify.mobile_app_iphone", "data": { "message": "Goodnight! All locked up." } }
  ]
}
```

### Example: Parameterized scene script
```json
{
  "script_id": "set_room_brightness",
  "alias": "Set Room Brightness",
  "fields": {
    "room": { "description": "Light entity ID", "example": "light.living_room" },
    "level": { "description": "Brightness 0-100", "example": 70 }
  },
  "sequence": [
    { "service": "light.turn_on", "target": { "entity_id": "{{ room }}" }, "data": { "brightness_pct": "{{ level }}" } }
  ]
}
```
