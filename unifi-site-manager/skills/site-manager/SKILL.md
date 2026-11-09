# UniFi Site Manager (read-only)

Use the `unifi-site-manager` MCP tools to read Paul's locations from UniFi Site Manager cloud (`https://api.ui.com`). Do not use `unifi-network` for this. Do not change firewall, VPN, WiFi, or any other UniFi configuration with these tools. None of them write.

If `unifi_sm_api_limitations` is available, call it before answering a question about what can be changed. Trust that result over memory.

## Tools

### Discovery and health

- `unifi_sm_discover_locations` — hosts, sites, and the firmware gate for each console. Start here for "what locations do we have?"
- `unifi_sm_list_hosts` / `unifi_sm_get_host` — Site Manager hosts (`GET /v1/hosts`).
- `unifi_sm_list_sites` — sites plus permission and `isOwner`.
- `unifi_sm_list_site_health` — WAN uptime, device counts, ISP info, and internet issues from the documented site `statistics` object. There is no separate health URL.
- `unifi_sm_list_devices` — devices. Console firmware is `version` on the device with `isConsole: true`.

A firmware or permission problem is reported on that console. Do not drop the other locations, and do not invent a successful VPN status for a console that was skipped.

### WAN metrics

- `unifi_sm_get_isp_metrics` — all accessible sites. `type` `5m` allows duration `24h`. `type` `1h` allows `7d` or `30d`. Do not send `duration` together with `beginTimestamp` or `endTimestamp`.
- `unifi_sm_query_isp_metrics` — specific `{hostId, siteId}` pairs. The POST is a read query. `status: partialSuccess` means some sites were not visible. It does not mean the configuration changed.

### SD-WAN

- `unifi_sm_list_sdwan_configs`
- `unifi_sm_get_sdwan_config`
- `unifi_sm_get_sdwan_status` — deployment state, hub and spoke WAN status, errors, and warnings.

These are reads. Site Manager v1.0.0 does not document an SD-WAN create or update.

### VPN status

- `unifi_sm_list_vpn_status` — for each console at firmware `>= 5.0.3`, GET Network sites, then GET VPN servers and GET site-to-site tunnels.

Network OpenAPI v11.0.97 documents those VPN routes as GET only. Do not claim this plugin can create a peer, change a pre-shared key, or enable a tunnel. If firmware is unknown or below 5.0.3, the tool skips the connector call and returns `firmware_unknown` or `firmware_unsupported` for that console only.

Site Manager site ids and Network site UUIDs are different. The tool learns the UUID from the connector's Network site list. Do not paste a Site Manager site id into a Network path yourself.

### Limits

- `unifi_sm_api_limitations` — static document of the verified limits. No network call.

## How a cross-location read should go

```
unifi_sm_discover_locations
→ report every host, and any firmware_unknown / firmware_unsupported console
→ unifi_sm_list_site_health
→ unifi_sm_get_isp_metrics (type 5m, duration 24h) for recent WAN metrics
→ unifi_sm_list_sdwan_configs, then unifi_sm_get_sdwan_status for each id
→ unifi_sm_list_vpn_status
→ keep permission_denied rows next to the consoles that succeeded
```

## Cloud Connector rules to say out loud

- Minimum console firmware is 5.0.3. The official device example `4.1.13` is below that and must not be proxied.
- Non-organization keys only reach the owner's consoles. Organization keys reach the organization's consoles. HTTP 403 means insufficient permissions or not the owner. Do not bypass that by trying another path.
- Official connector budget is 100 requests per minute per console, a 25 second proxy timeout, and a 10 MB body. This client is stricter (50 per minute, 20 second client timeout, 3 attempts, 8 second maximum retry wait).
- Retries cover HTTP 429 (including the documented `retry after Ns` message and `Retry-After`), 408, and 502. HTTP 401 and 403 are not retried.
- Protect and Access are out of scope.

## Configuration possibilities for a later review

Do not implement these from this skill. Tell the user they are documented elsewhere and not available here:

- Connector POST, PUT, PATCH, and DELETE exist in the Site Manager spec. This plugin does not expose them and does not accept an arbitrary path.
- Network writes exist for firewall policy and zone, network, WiFi, ACL, DNS policy, traffic matching list, device adoption, client action, and voucher operations. Not exposed.
- VPN peer writes are not in Network OpenAPI v11.0.97. Do not describe them as a missing toggle this plugin could flip.

## Secrets

Do not paste an API key into chat. Do not copy tool output that still contains a credential into memory, a ticket, or a log. The server redacts known secret fields and any echo of the API key before it returns JSON. Email fields on host `userData` are redacted.
