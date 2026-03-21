# Automation Trigger Types Reference

## State Trigger
Fires when an entity's state changes.
```json
{
  "platform": "state",
  "entity_id": "binary_sensor.front_door",
  "to": "on",
  "from": "off",
  "for": "00:00:30"
}
```
- `to`/`from` are optional — omit to trigger on any change
- `for` requires the state to hold for a duration before triggering

## Time Trigger
Fires at a specific time daily.
```json
{ "platform": "time", "at": "07:00:00" }
```
Or using an input_datetime entity:
```json
{ "platform": "time", "at": "input_datetime.alarm_time" }
```

## Time Pattern Trigger
Fires on a repeating schedule.
```json
{ "platform": "time_pattern", "hours": "/2", "minutes": "0", "seconds": "0" }
```
- Use `/N` for "every N" (e.g. `/30` = every 30 minutes)
- Use `*` for any value

## Sun Trigger
```json
{ "platform": "sun", "event": "sunset", "offset": "-00:30:00" }
```
- `event`: `sunrise` or `sunset`
- `offset`: time before (-) or after (+) the event

## Numeric State Trigger
Fires when a numeric sensor crosses a threshold.
```json
{
  "platform": "numeric_state",
  "entity_id": "sensor.temperature",
  "above": 75,
  "below": 90,
  "for": "00:05:00"
}
```

## Zone Trigger
Fires when a device tracker enters or leaves a zone.
```json
{
  "platform": "zone",
  "entity_id": "device_tracker.my_phone",
  "zone": "zone.home",
  "event": "enter"
}
```
- `event`: `enter` or `leave`

## Webhook Trigger
Fires when an HTTP POST is sent to the webhook URL.
```json
{ "platform": "webhook", "webhook_id": "my_webhook_id" }
```

## Event Trigger
Fires on a Home Assistant event.
```json
{
  "platform": "event",
  "event_type": "call_service",
  "event_data": {}
}
```

## MQTT Trigger
Fires on an MQTT message.
```json
{
  "platform": "mqtt",
  "topic": "home/sensor/temperature",
  "payload": "on"
}
```

## Template Trigger
Fires when a template evaluates to true.
```json
{
  "platform": "template",
  "value_template": "{{ states('sensor.temperature') | float > 80 }}"
}
```

## Calendar Trigger
```json
{ "platform": "calendar", "entity_id": "calendar.work", "event": "start" }
```

## Conversation Trigger (voice)
```json
{ "platform": "conversation", "command": ["turn off the lights", "lights off"] }
```

## Multiple Triggers
Any trigger in the list can fire the automation:
```json
[
  { "platform": "state", "entity_id": "sensor.motion", "to": "on" },
  { "platform": "time", "at": "08:00:00" }
]
```
