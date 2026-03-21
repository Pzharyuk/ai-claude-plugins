# Automation Action Types Reference

## Call Service
Most common — controls devices.
```json
{
  "service": "light.turn_on",
  "target": { "entity_id": "light.living_room" },
  "data": { "brightness_pct": 80, "color_temp_kelvin": 3000 }
}
```

## Delay
Pause before next action.
```json
{ "delay": "00:01:30" }
```
Or with template:
```json
{ "delay": { "seconds": "{{ wait_time }}" } }
```

## Wait for Trigger
Pause until a trigger fires (optional timeout).
```json
{
  "wait_for_trigger": [{ "platform": "state", "entity_id": "binary_sensor.motion", "to": "off" }],
  "timeout": "00:05:00",
  "continue_on_timeout": true
}
```

## Wait for Template
Pause until a condition becomes true.
```json
{
  "wait_template": "{{ is_state('light.living_room', 'on') }}",
  "timeout": "00:01:00"
}
```

## Conditional (If/Then/Else)
```json
{
  "if": [{ "condition": "state", "entity_id": "sun.sun", "state": "below_horizon" }],
  "then": [{ "service": "light.turn_on", "target": { "entity_id": "light.outdoor" } }],
  "else": [{ "service": "light.turn_off", "target": { "entity_id": "light.outdoor" } }]
}
```

## Choose (Switch/Case)
```json
{
  "choose": [
    {
      "conditions": [{ "condition": "state", "entity_id": "sensor.time_of_day", "state": "morning" }],
      "sequence": [{ "service": "light.turn_on", "data": { "brightness_pct": 100 } }]
    },
    {
      "conditions": [{ "condition": "state", "entity_id": "sensor.time_of_day", "state": "evening" }],
      "sequence": [{ "service": "light.turn_on", "data": { "brightness_pct": 40 } }]
    }
  ],
  "default": [{ "service": "light.turn_on", "data": { "brightness_pct": 70 } }]
}
```

## Repeat
Loop actions.
```json
{
  "repeat": {
    "count": 3,
    "sequence": [
      { "service": "light.toggle", "target": { "entity_id": "light.alarm" } },
      { "delay": "00:00:01" }
    ]
  }
}
```
Or while condition is true:
```json
{
  "repeat": {
    "while": [{ "condition": "state", "entity_id": "binary_sensor.motion", "state": "on" }],
    "sequence": [...]
  }
}
```

## Variables
Set variables for use later in the automation.
```json
{ "variables": { "room": "living_room", "brightness": 80 } }
```

## Fire Event
```json
{ "event": "my_custom_event", "event_data": { "key": "value" } }
```

## Notify
Shorthand for notification:
```json
{
  "service": "notify.mobile_app_iphone",
  "data": {
    "title": "Alert",
    "message": "Motion detected in {{ trigger.to_state.attributes.friendly_name }}",
    "data": {
      "actions": [
        { "action": "IGNORE", "title": "Ignore" },
        { "action": "ALERT", "title": "Alert me" }
      ]
    }
  }
}
```

## Scene Activation
```json
{ "service": "scene.turn_on", "target": { "entity_id": "scene.movie_time" } }
```

## Script Run
```json
{ "service": "script.goodnight_routine" }
```

## Stop Automation
Stop the current automation run.
```json
{ "stop": "User cancelled" }
```

## Templates in Actions
Use `{{ }}` in any string value:
```json
{
  "service": "notify.notify",
  "data": {
    "message": "Temperature is {{ states('sensor.temperature') }}°F"
  }
}
```

## Conditions in Actions
Reference: condition objects use the same format as automation conditions:
```json
{ "condition": "state", "entity_id": "input_boolean.guest_mode", "state": "off" }
{ "condition": "time", "after": "22:00:00", "before": "07:00:00" }
{ "condition": "numeric_state", "entity_id": "sensor.temperature", "above": 70 }
{ "condition": "sun", "after": "sunset", "before": "sunrise" }
{ "condition": "template", "value_template": "{{ is_state('device_tracker.phone', 'home') }}" }
```
