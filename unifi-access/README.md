# unifi-access

A Claude Cowork plugin for full UniFi Access management — doors, users, access groups, PIN/NFC credentials, activity logs, and access schedules.

Part of [ai-claude-plugins](https://github.com/Pzharyuk/ai-claude-plugins).

## What You Can Do

- Remotely unlock or lock any door
- Put doors in lockdown or always-open mode
- Create and manage access users (onboarding/offboarding)
- Organize users into door groups (access levels)
- Assign PIN codes and manage NFC credentials
- View detailed access logs — who entered which door and when
- Create temporary access groups for contractors or visitors

## Skills

| Skill | Triggers |
|-------|---------|
| `access-control` | "unlock door", "lock door", "add user", "remove user", "grant access", "activity log", "PIN", "credentials" |

## MCP Tools (21 tools)

### Doors
- `access_list_doors` / `access_get_door`
- `access_unlock_door` — Momentary or timed unlock
- `access_lock_door` — Lock a door
- `access_set_door_mode` — `custom` (normal), `always_unlock`, `lockdown`

### Users
- `access_list_users` / `access_get_user`
- `access_create_user` — With optional expiry for temporary access
- `access_update_user` / `access_delete_user`

### Door Groups
- `access_list_door_groups` / `access_get_door_group`
- `access_create_door_group` — Create an access level with specific doors
- `access_assign_user_to_group` — Grant access
- `access_remove_user_from_group` — Revoke access

### Credentials
- `access_list_credentials` — PINs, NFC cards, mobile passes for a user
- `access_create_pin` — Assign a PIN (4-8 digits)
- `access_delete_credential` — Remove a credential

### Activity & Schedules
- `access_get_activity_logs` — Filter by door, user, or time range
- `access_list_schedules` — Time-based access restrictions
- `access_list_devices` — UniFi Access hardware inventory

## Setup

### 1. Set Environment Variables

```bash
export UNIFI_HOST="https://192.168.1.1"
export UNIFI_USERNAME="admin"
export UNIFI_PASSWORD="your-password"
export UNIFI_VERIFY_SSL="false"     # optional, set "true" for valid SSL certs
```

### 2. Install the Plugin

Install `unifi-access.plugin` via the Cowork plugins interface.

### 3. Install Server Dependencies

```bash
cd <plugin-install-path>/server
npm install
```

## Usage Examples

- "Unlock the front door"
- "Put the server room in lockdown"
- "Add John Smith as a new user and give him office access"
- "Remove Jane Doe's access"
- "Give John a PIN of 4821"
- "Who entered the building today?"
- "Show me all activity for the front door this week"
- "Create a temporary access group for contractors valid until Friday"
