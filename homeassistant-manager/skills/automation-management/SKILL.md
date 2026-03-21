---
name: automation-management
description: >
  Use this skill when the user asks to "create an automation", "make an
  automation", "set up an automation", "list automations", "edit an automation",
  "delete an automation", "trigger an automation", "enable or disable an
  automation", "automate my lights", "when X happens do Y", "turn off lights
  at sunset", "notify me when someone arrives", "run something on a schedule",
  or any task involving Home Assistant automation creation or management.
metadata:
  version: "0.1.0"
---

# Home Assistant Automation Management

Use the `homeassistant-manager` MCP server to create, update, and manage Home Assistant automations.

## Creating Automations

When the user describes an automation in natural language, translate it into HA automation structure and call `ha_create_automation`.

### Gather requirements
Ask (if not already clear):
- **Trigger**: What starts this automation? (time, state change, event, sun, etc.)
- **Conditions**: Any conditions that must be true? (optional)
- **Actions**: What should happen?
- **Mode**: How to handle re-triggers? (single = ignore, restart, queued, parallel)

### Automation structure
```json
{
  "alias": "Human-readable name",
  "description": "What this does",
  "mode": "single",
  "trigger": [...],
  "condition": [...],
  "action": [...]
}
```

See `references/trigger-types.md` for trigger syntax.
See `references/action-types.md` for action syntax.

## Managing Existing Automations

- List: `ha_list_automations` — shows all automations with enabled/disabled state
- View: `ha_get_automation` — full config of a specific automation
- Edit: `ha_update_automation` — modify any field
- Enable/Disable: `ha_toggle_automation`
- Trigger manually: `ha_trigger_automation`
- Delete: `ha_delete_automation` (always confirm first)

## Common Automation Examples

### Turn off lights at bedtime
```json
trigger: [{ platform: "time", at: "23:00:00" }]
action: [{ service: "light.turn_off", target: { entity_id: "all" } }]
```

### Motion-activated light
```json
trigger: [{ platform: "state", entity_id: "binary_sensor.hallway_motion", to: "on" }]
action: [{ service: "light.turn_on", target: { entity_id: "light.hallway" } }]
```

### Notify when door unlocked
```json
trigger: [{ platform: "state", entity_id: "lock.front_door", to: "unlocked" }]
action: [{ service: "notify.mobile_app_iphone", data: { message: "Front door unlocked" } }]
```

### Sunrise/sunset
```json
trigger: [{ platform: "sun", event: "sunset", offset: "-00:30:00" }]
action: [{ service: "light.turn_on", target: { entity_id: "light.outdoor" }, data: { brightness_pct: 80 } }]
```

### Temperature alert
```json
trigger: [{ platform: "numeric_state", entity_id: "sensor.temperature", above: 80 }]
action: [{ service: "notify.notify", data: { message: "Temperature too high: {{ trigger.to_state.state }}°F" } }]
```

## Best Practices

- Always use descriptive aliases — they appear in the HA UI and logs
- Add descriptions explaining the purpose
- Use `mode: restart` for state-based automations that should restart if triggered again
- Use `mode: queued` for sequential actions that shouldn't overlap
- Test with `ha_trigger_automation` before relying on the trigger
- Use conditions to prevent unwanted triggers (e.g. only run if someone is home)
- Templates in action data use `{{ }}` syntax for dynamic values
