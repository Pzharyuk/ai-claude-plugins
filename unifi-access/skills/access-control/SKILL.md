# UniFi Access Control Management

You can manage the full UniFi Access system via the `unifi-access` MCP tools — doors, users, door groups, PIN/NFC credentials, activity logs, and access schedules.

## Tools Overview

### Devices & Doors
- `access_list_devices` — All UniFi Access hardware (hubs, readers, door controllers)
- `access_list_doors` — All configured doors with lock status and access mode
- `access_get_door` — Details and current status of a specific door
- `access_unlock_door` — Unlock a door (momentary or timed)
- `access_lock_door` — Lock a door
- `access_set_door_mode` — Set door access mode: `custom`, `always_unlock`, `lockdown`

### Users
- `access_list_users` — All access users with name, status, and groups
- `access_get_user` — Details for one user
- `access_create_user` — Create a new access user
- `access_update_user` — Update user info (name, email, employee number)
- `access_delete_user` — Remove a user and all their credentials

### Door Groups (Access Levels)
- `access_list_door_groups` — All door groups with doors and schedules
- `access_get_door_group` — Details of a specific group
- `access_create_door_group` — Create a new access level with specific doors
- `access_assign_user_to_group` — Grant a user access to a group's doors
- `access_remove_user_from_group` — Revoke a user's access to a group

### Credentials
- `access_list_credentials` — List a user's credentials (PIN, NFC, mobile pass)
- `access_create_pin` — Assign a PIN code to a user
- `access_delete_credential` — Remove a credential from a user

### Activity & Schedules
- `access_get_activity_logs` — Door access history (who, what door, when); filter by door or user
- `access_list_schedules` — Access schedules (time restrictions for door groups)

## Workflows

### Let someone in remotely
```
access_list_doors → find door_id
→ access_unlock_door (door_id: "...")
```

### Onboard a new employee
```
access_create_user (first_name: "Jane", last_name: "Smith", email: "jane@company.com")
→ save returned user_id
→ access_list_door_groups → find appropriate group_id
→ access_assign_user_to_group (user_id: "...", group_id: "...")
→ access_create_pin (user_id: "...", pin: "1234")
```

### Offboard an employee
```
access_list_users → find user_id by name
→ access_delete_user (user_id: "...")
```

### Review who entered the building today
```
access_get_activity_logs (start: <start of day in ms>, limit: 200)
```

### Check activity for a specific person
```
access_list_users → find user_id
→ access_get_activity_logs (user_id: "...", start: <7 days ago>)
```

### Put a door in lockdown
```
access_list_doors → find door_id
→ access_set_door_mode (door_id: "...", mode: "lockdown")
```

### Create a temporary access group for contractors
```
access_create_door_group (name: "Contractors", doors: ["door_id_1", "door_id_2"])
→ access_create_user (first_name: "John", last_name: "Contractor", expiry_time: <unix_timestamp>)
→ access_assign_user_to_group (user_id: "...", group_id: "...")
```

## Door Access Modes
| Mode | Description |
|------|-------------|
| `custom` | Normal access control — credentials required |
| `always_unlock` | Door stays unlocked, anyone can enter |
| `lockdown` | Door stays locked, no entry |

## Notes
- Timestamps are in **milliseconds** (Unix ms). Use `Date.now()` for current time.
- `expiry_time` and `onboard_time` on users are Unix timestamps in **seconds** (not ms).
- PINs should be 4–8 digits.
- Deleting a user automatically removes all their credentials and group memberships.
- Activity logs default to the last 24 hours; pass `start`/`end` for other ranges.
- Use `access_list_schedules` to apply time restrictions when assigning door groups.
