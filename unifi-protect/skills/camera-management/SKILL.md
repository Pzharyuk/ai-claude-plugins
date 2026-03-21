# UniFi Protect Camera Management

You can manage the full UniFi Protect camera system via the `unifi-protect` MCP tools — cameras, motion events, smart detections, recordings, snapshots, viewers, and NVR status.

## Tools Overview

### System
- `protect_bootstrap` — Full system state: NVR info, all cameras, viewers. **Start here for an overview.**
- `protect_nvr_info` — NVR hardware, storage stats, software version

### Cameras
- `protect_list_cameras` — All cameras with status, recording mode, connection state, last motion
- `protect_get_camera` — Full config and status for one camera
- `protect_update_camera` — Update camera settings (name, recording mode, motion sensitivity, smart detections, status LED)
- `protect_reboot_camera` — Reboot a camera (brief offline period)

### Events
- `protect_list_events` — Recent events filtered by type, camera, and time range
  - Event types: `motion`, `ring`, `smartDetectZone`, `disconnected`, `connected`
- `protect_get_snapshot` — Get snapshot URL from a camera (current or historical)
- `protect_get_recording_url` — Get URL to stream/download a recording clip

### Viewers & Liveviews
- `protect_list_viewers` — UniFi Protect display monitors
- `protect_list_liveviews` — Configured liveview layouts
- `protect_set_viewer_liveview` — Change what a display monitor shows

## Workflows

### Check what's happening right now
```
protect_list_cameras → see all camera states
protect_list_events (start: <1h ago>) → recent activity
```

### Check motion events on a specific camera
```
protect_list_cameras → find camera_id
→ protect_list_events (camera_id: "...", type: "motion", start: <timestamp>)
```

### Enable smart detection for people and vehicles
```
protect_list_cameras → find camera_id
→ protect_update_camera (
    camera_id: "...",
    smartDetectTypes: ["person", "vehicle"],
    recordingMode: "smart"
  )
```

### Get a live snapshot
```
protect_get_snapshot (camera_id: "...", width: 1920)
→ returns snapshot_url — open in browser to view
```

### Get a recording clip
```
protect_get_recording_url (
  camera_id: "...",
  start: <start_ms>,
  end: <end_ms>
)
→ returns recording_url — stream or download in browser
```

### Change what a display monitor shows
```
protect_list_viewers → find viewer_id
protect_list_liveviews → find liveview_id
→ protect_set_viewer_liveview (viewer_id: "...", liveview_id: "...")
```

## Recording Modes
| Mode | Description |
|------|-------------|
| `always` | Record continuously |
| `motion` | Record on motion only |
| `smart` | Record on smart detections only |
| `never` | Do not record |

## Smart Detection Types
`person`, `vehicle`, `package`, `face`, `license_plate`, `animal`

## Notes
- Timestamps are in **milliseconds** (Unix ms). Use `Date.now()` for current time.
- Snapshot and recording URLs require an authenticated browser session to view.
- Smart detection requires a Protect-compatible camera (G4 series or newer).
- Rebooting a camera causes it to go offline for ~30 seconds.
- NVR storage stats are in the `protect_nvr_info` response under `storageStats`.
