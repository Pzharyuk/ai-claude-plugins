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

## Installation

### 1. Download the plugin

Grab `unifi-access.plugin` from this repo, or build it yourself:

```bash
git clone https://github.com/Pzharyuk/ai-claude-plugins.git
cd ai-claude-plugins/unifi-access
npm install --prefix server
zip -r ../unifi-access.plugin . -x "*/node_modules/*"
```

### 2. Install in Claude Cowork

1. Open the **Plugins** panel (puzzle piece icon in the sidebar)
2. Click **Install from file** → select `unifi-access.plugin`
3. Enter your environment variables when prompted:

| Variable | Required | Description |
|----------|----------|-------------|
| `UNIFI_HOST` | ✅ | Controller URL, e.g. `https://192.168.1.1` |
| `UNIFI_USERNAME` | ✅ | Admin username |
| `UNIFI_PASSWORD` | ✅ | Admin password |
| `UNIFI_VERIFY_SSL` | optional | `true` to enforce SSL validation (default: `false`) |

### 3. Install server dependencies (first run only)

```bash
cd <plugin-install-path>/server
npm install
```

> **Requires Node.js.** Download from [nodejs.org](https://nodejs.org) if needed.

## Usage Examples

- "Unlock the front door"
- "Put the server room in lockdown"
- "Add John Smith as a new user and give him office access"
- "Remove Jane Doe's access"
- "Give John a PIN of 4821"
- "Who entered the building today?"
- "Show me all activity for the front door this week"
- "Create a temporary access group for contractors valid until Friday"
