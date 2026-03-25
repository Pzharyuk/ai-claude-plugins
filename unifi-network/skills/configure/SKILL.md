# Configure: unifi-network

Walk the user through setting up UniFi Network controller credentials and persist them to `~/.mcp.json` so the MCP server can authenticate on every Claude Code launch.

## Steps

### 1. Ask for the UniFi Host
Say: "What is the URL of your UniFi Network controller? (e.g. https://192.168.1.1 or https://unifi.local)"

Store as `UNIFI_HOST`.

### 2. Ask for the Username
Say: "What is your UniFi controller admin username?"

Store as `UNIFI_USERNAME`.

### 3. Ask for the Password
Say: "What is your UniFi controller admin password?"

Store as `UNIFI_PASSWORD`.

### 4. Ask about SSL verification
Say: "Should SSL certificates be verified? Most homelabs use self-signed certs. Enter true or false (default: false)."

Default to `false` if unsure. Store as `UNIFI_VERIFY_SSL`.

### 5. Look up available sites

Using the credentials from steps 1–4, query the UniFi controller to discover available sites. Run this Python script via Bash:

```python
import json, urllib.request, ssl, http.cookiejar

host = "<UNIFI_HOST>"
username = "<UNIFI_USERNAME>"
password = "<UNIFI_PASSWORD>"
verify_ssl = <True or False from step 4>

ctx = ssl.create_default_context()
if not verify_ssl:
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cj),
    urllib.request.HTTPSHandler(context=ctx),
)

# Login
req = urllib.request.Request(
    f"{host}/api/auth/login",
    data=json.dumps({"username": username, "password": password}).encode(),
    headers={"Content-Type": "application/json"},
)
opener.open(req)

# Fetch sites
req2 = urllib.request.Request(f"{host}/proxy/network/api/self/sites")
resp = opener.open(req2)
sites = json.loads(resp.read())["data"]

for s in sites:
    print(json.dumps({"name": s["name"], "desc": s.get("desc", s["name"])}))
```

**If the script fails** (e.g. connection refused, auth error), tell the user what went wrong and ask them to double-check the host URL, username, and password.

**If exactly one site is returned**, use its `name` value as `UNIFI_SITE` and tell the user:
"Found one site: **{desc}** (id: `{name}`). Using it automatically."

**If multiple sites are returned**, present a numbered list using each site's `desc` (display name) and `name` (API id), then ask:
"I found multiple sites on your controller:
1. **{desc1}** (id: `{name1}`)
2. **{desc2}** (id: `{name2}`)
...
Which site should the plugin use? Enter the number."

Store the chosen site's `name` as `UNIFI_SITE`.

### 6. Write to ~/.mcp.json
Use Python to read `~/.mcp.json` (create if missing), set the env vars under the `unifi-network` server, and write it back:

```python
import json, os

path = os.path.expanduser("~/.mcp.json")
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)

config.setdefault("mcpServers", {}).setdefault("unifi-network", {}).setdefault("env", {}).update({
    "UNIFI_HOST": "<value from step 1>",
    "UNIFI_USERNAME": "<value from step 2>",
    "UNIFI_PASSWORD": "<value from step 3>",
    "UNIFI_SITE": "<value from step 5>",
    "UNIFI_VERIFY_SSL": "<value from step 4>"
})

with open(path, "w") as f:
    json.dump(config, f, indent=2)

print("Saved.")
```

### 7. Confirm and prompt reload
Say: "UniFi Network credentials saved to ~/.mcp.json. Run `/reload-plugins` to apply them."

## Notes
- Never echo the password back after saving.
- Overwrite existing values if the keys already exist.
- If `~/.mcp.json` is missing, create it with the full structure.
- The site lookup uses only Python stdlib (no external dependencies).
