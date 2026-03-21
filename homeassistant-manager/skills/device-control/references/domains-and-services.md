# Home Assistant Domains & Services Reference

## light
| Service | Key service_data fields |
|---------|------------------------|
| turn_on | brightness (0-255), brightness_pct (0-100), color_temp_kelvin, rgb_color ([r,g,b]), hs_color, transition (secs), effect |
| turn_off | transition |
| toggle | — |

## switch / input_boolean
| Service | Notes |
|---------|-------|
| turn_on | — |
| turn_off | — |
| toggle | — |

## climate
| Service | Key service_data fields |
|---------|------------------------|
| set_temperature | temperature, target_temp_high, target_temp_low |
| set_hvac_mode | hvac_mode: off, heat, cool, heat_cool, auto, dry, fan_only |
| set_fan_mode | fan_mode: auto, low, medium, high |
| set_preset_mode | preset_mode: away, home, eco, boost, sleep |
| set_swing_mode | swing_mode: off, vertical, horizontal, both |
| turn_on | — |
| turn_off | — |

## media_player
| Service | Key service_data fields |
|---------|------------------------|
| media_play | — |
| media_pause | — |
| media_stop | — |
| media_next_track | — |
| media_previous_track | — |
| volume_set | volume_level (0.0-1.0) |
| volume_mute | is_volume_muted: true/false |
| select_source | source |
| select_sound_mode | sound_mode |
| shuffle_set | shuffle: true/false |
| repeat_set | repeat: off, one, all |
| play_media | media_content_id, media_content_type (music, video, playlist, etc.) |

## cover
| Service | Key service_data fields |
|---------|------------------------|
| open_cover | — |
| close_cover | — |
| stop_cover | — |
| set_cover_position | position (0-100) |
| toggle | — |
| set_cover_tilt_position | tilt_position (0-100) |

## lock
| Service | Notes |
|---------|-------|
| lock | code (if required) |
| unlock | code (if required) |
| open | (if supported) |

## fan
| Service | Key service_data fields |
|---------|------------------------|
| turn_on | percentage, preset_mode |
| turn_off | — |
| toggle | — |
| set_percentage | percentage (0-100) |
| set_preset_mode | preset_mode |
| oscillate | oscillating: true/false |
| set_direction | direction: forward/reverse |

## vacuum
| Service | Notes |
|---------|-------|
| start | — |
| pause | — |
| stop | — |
| return_to_base | — |
| clean_spot | — |
| locate | — |
| set_fan_speed | fan_speed |
| send_command | command, params |

## water_heater
| Service | Key service_data fields |
|---------|------------------------|
| set_temperature | temperature |
| set_operation_mode | operation_mode |
| set_away_mode | away_mode: true/false |

## alarm_control_panel
| Service | Key service_data fields |
|---------|------------------------|
| alarm_disarm | code |
| alarm_arm_away | code |
| alarm_arm_home | code |
| alarm_arm_night | code |
| alarm_arm_vacation | code |
| alarm_trigger | — |

## input_number / counter
| Service | Key service_data fields |
|---------|------------------------|
| set_value | value |
| increment | — |
| decrement | — |

## input_select
| Service | Key service_data fields |
|---------|------------------------|
| select_option | option |
| select_first | — |
| select_last | — |
| select_next | — |
| select_previous | — |

## input_text
| Service | Key service_data fields |
|---------|------------------------|
| set_value | value |

## timer
| Service | Key service_data fields |
|---------|------------------------|
| start | duration (HH:MM:SS) |
| pause | — |
| cancel | — |
| finish | — |

## notify
| Service | Key service_data fields |
|---------|------------------------|
| notify (or mobile_app_*) | message, title, data (actions, image, url, etc.) |

## Targeting Multiple Entities
You can target multiple entities in one call:
- `entity_id: "light.kitchen,light.dining_room"` (comma-separated string)
- Or use area targeting: `service_data: {area_id: "living_room"}`
- Or label targeting: `service_data: {label_id: "my_label"}`
