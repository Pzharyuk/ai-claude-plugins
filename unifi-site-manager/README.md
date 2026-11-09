# unifi-site-manager

Read-only UniFi Site Manager cloud plugin. It lists every location the API key can see through `https://api.ui.com`. It does not log in to a local UniFi controller.

This plugin is a sibling of [unifi-network](../unifi-network). Leave that plugin installed as it is. `unifi-network` uses a controller URL plus a username and password against the legacy local API. This plugin uses a Site Manager API key and the official cloud API. Same vendor, different credential plane. Do not reinstall `unifi-network` to get this behavior.

Part of [ai-claude-plugins](https://github.com/Pzharyuk/ai-claude-plugins).

## What you can read

- Hosts and one host by id
- Sites, including permission, ownership, and the documented statistics block used as cloud health (WAN uptime, device counts, ISP info, internet issues)
- Devices, including console firmware when `isConsole` is true
- A cross-location discovery summary that keeps per-console firmware and permission failures
- WAN/ISP metrics (`5m` for 24 hours, `1h` for 7 or 30 days) and a per-site metrics query
- SD-WAN configuration and status
- Network VPN server and site-to-site tunnel status, through Cloud Connector GET routes, only when console firmware is known and at least 5.0.3

There is no tool that creates, updates, deletes, adopts, restarts, or blocks anything. There is no generic proxy tool.

## Verified API limits

Checked against:

- https://developer.ui.com/llms.txt
- https://developer.ui.com/site-manager/v1.0.0/openapi.json (Site Manager 1.0.0)
- https://developer.ui.com/network/v11.0.97/openapi.json (Network 11.0.97)

| Rule | Official behavior | What this plugin does |
| --- | --- | --- |
| Auth | Header `X-API-KEY` (OpenAPI scheme name `X-API-Key`). Base URL `https://api.ui.com`. Keys are generated at unifi.ui.com. | Sends that header only to `https://api.ui.com`. Ignores any base-URL override. |
| Native reads | `GET /v1/hosts`, `GET /v1/hosts/{id}`, `GET /v1/sites`, `GET /v1/devices`, `GET /v1/isp-metrics/{type}`, `POST /v1/isp-metrics/{type}/query`, `GET /v1/sd-wan-configs`, `GET /v1/sd-wan-configs/{id}`, `GET /v1/sd-wan-configs/{id}/status`. | Exposes those reads. The ISP POST is the documented query. It does not change configuration. |
| Site Manager writes | No create, update, or delete is documented for hosts, sites, devices, or SD-WAN configs. | No write tools. |
| Pagination | Hosts, sites, and devices use `pageSize` and `nextToken`. OpenAPI types `pageSize` as a string and does not publish a numeric maximum (the example is `10`). Network lists use `offset` and `limit`, with `limit` maximum `200` and default `25`. | Follows every page, then stops. Site Manager page size is capped at 100 and at 20 pages. Network limit is capped at 200 and at 20 pages. A repeated token stops the walk. The result says when it was truncated and, when the token is safe, returns it. |
| Cloud Connector | `GET/POST/PUT/PATCH/DELETE /v1/connector/consoles/{id}/*path`. Proxies to `http://127.0.0.1/proxy/[path]` on the console. | GET only, and only for the three Network paths below. The path is not caller-controlled. |
| Connector requirements | Console firmware must be `>= 5.0.3`. A non-organization key can use only consoles owned by the key owner. An organization key can use consoles in that organization. | Firmware comes from `GET /v1/devices` where `isConsole` is true. Below 5.0.3 is skipped. Missing or non-numeric firmware is skipped. The official network-server host example puts a Network application version such as `8.3.11` in `reportedState.version`; that field is not treated as console firmware. |
| Connector errors | HTTP 403 example: `insufficient permissions or not the owner of the host`. HTTP 408: device timeout. HTTP 429 example: `rate limit exceeded, retry after 5.372786998s`. | A 403, firmware skip, or bad site id is stored on that console or site. Other consoles are still returned. |
| Connector budget | 100 requests per minute per console, 25 second proxy timeout, 10 MB response body. | Client stays under that: 50 requests per minute per console, at least 250 ms between requests, 20 second client timeout, 3 attempts, retry wait capped at 8 seconds, 10 MB body cap. |
| VPN | Network documents only `GET /v1/sites/{siteId}/vpn/servers` and `GET /v1/sites/{siteId}/vpn/site-to-site-tunnels`. | Those two GETs, plus `GET /v1/sites` on the same connector so the Network site UUID is known. Site Manager `siteId` values are not assumed to be that UUID. No VPN peer write is exposed or claimed. |
| Connector path | The Site Manager operation example is `GET /v1/connector/consoles/{id}/network/integration/v1/sites`, which matches the proxy target `http://127.0.0.1/proxy/network/integration/v1/sites`. The Network OpenAPI server URL also contains an extra `/proxy` segment (`/v1/connector/consoles/{consoleId}/proxy/network/integration`). | This client uses the Site Manager example, without a second `proxy` segment. |
| Protect and Access | The connector can reach them. | Not called. |

`POST /v1/isp-metrics/{type}/query` returns `status: partialSuccess` when only some requested sites are visible. The description says a caller with no access to the requested sites receives HTTP 502.

## Documented configuration that this version does not perform

These are official capabilities. They need a separate review before any tool is added. This plugin does not call them.

- Cloud Connector allows POST, PUT, PATCH, and DELETE. Exposing that as a general proxy would also expose Protect, Access, and every Network write.
- Network OpenAPI v11.0.97 documents writes for firewall policies and zones, networks, WiFi broadcasts, ACL rules, DNS policies, traffic matching lists, device adoption and removal, client actions, and hotspot vouchers.
- VPN servers and site-to-site tunnels have no POST, PUT, PATCH, or DELETE in that Network spec. A future change still cannot honestly offer "create a VPN peer" from the current official document.
- SD-WAN in Site Manager v1.0.0 is list, get, and status. There is no documented create or update.
- Local controller actions in `unifi-network` (block a client, change a WiFi password, port forward, restart a device) are a different API and stay in that plugin.

## Secure setup

Do not paste the API key into chat. If a key appears in the transcript, revoke it at unifi.ui.com and create another one. This repository never stores a key.

The process reads the key once at startup and keeps it in memory. It is sent only as `X-API-KEY` to `https://api.ui.com`. Redirects are not followed. Proxy environment variables are cleared before any request, because this runtime does not send the key to an HTTP proxy.

Set exactly one of these. If both are set, the process exits. It does not prefer one of them.

| Variable | What it is |
| --- | --- |
| `UNIFI_SITE_MANAGER_API_KEY` | The key itself. Use this for the Claude/Cowork plugin secret field. |
| `UNIFI_SITE_MANAGER_API_KEY_FILE` | An absolute path to a regular file that contains only the key. Not a secret. Use this for a custom MCP registration that cannot hold the key. |

### Plugin install

1. In the UniFi Site Manager UI at [unifi.ui.com](https://unifi.ui.com), create an API key. Official docs: "Generate keys at unifi.ui.com". That cloud key is not the local Network integration key under UniFi Network > Integrations, and it is not `UNIFI_USERNAME` / `UNIFI_PASSWORD` from `unifi-network`.
2. Install the plugin from this marketplace (commands below) after this change is merged. The install prompt has one secret field, `UNIFI_SITE_MANAGER_API_KEY` (`secret: true` in the plugin manifest).
3. Enter the key in that secret field yourself. `.mcp.json` only references `${UNIFI_SITE_MANAGER_API_KEY}`. That placeholder is for the plugin host, not for a raw MCP env map. Do not write the key into `~/.mcp.json`, a skill file, or the repository. Leave `UNIFI_SITE_MANAGER_API_KEY_FILE` unset.
4. Install the local server dependencies once:

```bash
cd <plugin-install-path>/server
npm install
```

Node.js 20 or newer is required.

5. Reload plugins. The server reads the key from its own environment. It exits if the variable is missing, and the error does not contain a key value.

A presence check, if you already exported the variable in your own shell, may print only `set` or `missing`:

```bash
node -e 'console.log(process.env.UNIFI_SITE_MANAGER_API_KEY ? "set" : "missing")'
```

Do not print the value. An agent shell often cannot see the plugin secret, so a `missing` result there does not mean the plugin field is empty.

### Custom MCP registration (key file)

`AddMcpServer` accepts a literal env map. It has no documented secret reference and it does not prompt for this API key. Do not put `${UNIFI_SITE_MANAGER_API_KEY}` in that map: the child would receive those characters, not a key. Do not assume the child inherits the bot shell environment.

The bridge below is sound only when the registered env map is what the child actually receives. If a launcher also injects `UNIFI_SITE_MANAGER_API_KEY` from the parent shell, startup refuses with a conflict and this bridge will not run. That is intentional. There is no host automation in this repo that unsets inherited variables for you.

Staging is done by Network Engineer in the shell where the masked secret request already stored the key under the name `UNIFI_SITE_MANAGER_API_KEY`. The recipe reads that process environment. It does not put the key in argv, and it writes no stdout.

```bash
python3 - << 'PY'
import os, stat
from pathlib import Path
key = os.environ.get("UNIFI_SITE_MANAGER_API_KEY")
if not isinstance(key, str) or len(key) < 16 or len(key) > 512 or any(ch.isspace() for ch in key) or "\0" in key:
    raise SystemExit(1)
path = Path("/home/box/unifi-site-manager-api-key")
path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
try:
    os.write(fd, key.encode("utf-8"))
    os.fchmod(fd, 0o600)
    st = os.fstat(fd)
    if stat.S_IMODE(st.st_mode) != 0o600 or st.st_uid != os.getuid() or not stat.S_ISREG(st.st_mode):
        raise SystemExit(1)
finally:
    os.close(fd)
PY
```

The file must be a regular file, not a symlink, owned by the user who will run the MCP process, and mode `0600` or `0400`. No path component may be a symlink. The bytes are the key with no trailing newline. The MCP process reads it once. A later edit does not affect the running process.

Register the extracted runtime, not a git checkout. `command` and `args` are absolute paths on the parent machine. The env map contains the path only:

```json
{
  "command": "/usr/bin/node",
  "args": ["/absolute/path/to/extracted/unifi-site-manager-runtime/index.js"],
  "env": {
    "UNIFI_SITE_MANAGER_API_KEY_FILE": "/home/box/unifi-site-manager-api-key"
  }
}
```

`/usr/bin/node` is an example. Use the absolute Node binary on the parent host. Do not pass the key as an argument. Do not add a wrapper that prints the environment.

## Install

Marketplace registration in this repo is the `unifi-site-manager` entry in [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json). There is no separate catalog id or deployment URL in this repository.

Claude Code or Cowork, after merge:

```
/plugin marketplace add Pzharyuk/ai-claude-plugins
/plugin install unifi-site-manager@ai-claude-plugins
```

Grok, using the same marketplace command this repo already documents for `harness-memory`:

```
grok plugin marketplace add Pzharyuk/ai-claude-plugins
grok plugin install unifi-site-manager --trust
```

Build a local `.plugin` archive only if you install from a file:

```bash
git clone https://github.com/Pzharyuk/ai-claude-plugins.git
cd ai-claude-plugins/unifi-site-manager
npm install --prefix server
zip -r ../unifi-site-manager.plugin . -x "*/node_modules/*"
```

### Catalog handoff

This pull request does not install the plugin, bind a key, call UniFi, or publish anything.

If "the Grok Bot connector catalog" means a hosted catalog separate from this git marketplace, that publication is a platform action by the account owner. This repo does not define a catalog id, publication endpoint, or approval API for that catalog, so none is called here. Blocker: merge updates only `Pzharyuk/ai-claude-plugins`. The owner still has to install `unifi-site-manager` from that marketplace and enter `UNIFI_SITE_MANAGER_API_KEY` in the secret field. Live reads stay blocked until that secret exists; this change did not collect a key and did not run credentialed tests.

The GitHub auto-release workflow bumps a fixed plugin list that does not include later plugins such as `harness-memory`. This plugin was not added to that list.

## Tools (13)

- `unifi_sm_list_hosts`
- `unifi_sm_get_host`
- `unifi_sm_list_sites`
- `unifi_sm_list_site_health`
- `unifi_sm_list_devices`
- `unifi_sm_discover_locations`
- `unifi_sm_get_isp_metrics`
- `unifi_sm_query_isp_metrics`
- `unifi_sm_list_sdwan_configs`
- `unifi_sm_get_sdwan_config`
- `unifi_sm_get_sdwan_status`
- `unifi_sm_list_vpn_status`
- `unifi_sm_api_limitations`

## Tests

From `unifi-site-manager/server`:

```bash
npm test
npm run build
```

Tests use a mock fetch. They do not call `api.ui.com`.
