# unifi-protect

A Claude Cowork plugin for full UniFi Protect management — cameras, motion events, smart detections, snapshots, recordings, viewers, and NVR status.

Part of [ai-claude-plugins](https://github.com/Pzharyuk/ai-claude-plugins).

## What You Can Do

- List all cameras and their status, recording mode, connection state
- View recent events: motion, rings, smart detections (person, vehicle, package, etc.)
- Get camera snapshots (current or historical)
- Get recording clip URLs for any time range
- Update camera settings: recording mode, motion sensitivity, smart detection types, status LED
- Reboot cameras
- Manage display monitors (viewers) and switch liveview layouts
- Check NVR hardware info and storage usage

## Skills

| Skill | Triggers |
|-------|---------|
| `camera-management` | "show cameras", "recent motion", "get snapshot", "recording", "smart detection", "NVR storage" |

## MCP Tools (12 tools)

### System
- `protect_bootstrap` — Full system state (NVR + all cameras)
- `protect_nvr_info` — NVR hardware, storage, software version

### Cameras
- `protect_list_cameras` — All cameras with status
- `protect_get_camera` — Full config for one camera
- `protect_update_camera` — Update recording mode, sensitivity, smart detections
- `protect_reboot_camera` — Reboot a camera

### Events & Media
- `protect_list_events` — Motion, ring, smart detection events
- `protect_get_snapshot` — Snapshot URL (current or historical timestamp)
- `protect_get_recording_url` — Recording clip URL for a time range

### Viewers
- `protect_list_viewers` — Display monitors
- `protect_list_liveviews` — Configured liveview layouts
- `protect_set_viewer_liveview` — Change what a monitor shows

## Installation

### 1. Download the plugin

Grab `unifi-protect.plugin` from this repo, or build it yourself:

```bash
git clone https://github.com/Pzharyuk/ai-claude-plugins.git
cd ai-claude-plugins/unifi-protect
npm install --prefix server
zip -r ../unifi-protect.plugin . -x "*/node_modules/*"
```

### 2. Install in Claude Cowork

1. Open the **Plugins** panel (puzzle piece icon in the sidebar)
2. Click **Install from file** → select `unifi-protect.plugin`
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

- "Show me all my cameras"
- "Any motion detected in the last hour?"
- "Get a snapshot from the front door camera"
- "Enable person detection on the driveway camera"
- "Switch the main monitor to the outdoor liveview"
- "How much storage does my NVR have left?"
- "Get the recording from camera X between 2pm and 3pm today"
