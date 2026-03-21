# Tunnel Ingress Configuration Reference

## Structure

An ingress config is an array of rules evaluated top-to-bottom. The **last rule must be a catch-all** (no `hostname` or `path`).

```json
{
  "ingress": [
    {
      "hostname": "app.example.com",
      "service": "http://localhost:3000"
    },
    {
      "hostname": "api.example.com",
      "path": "/v2/.*",
      "service": "http://localhost:4000"
    },
    {
      "service": "http_status:404"
    }
  ]
}
```

## Rule Fields

| Field      | Required | Description                                      |
|------------|----------|--------------------------------------------------|
| `hostname` | No       | Exact hostname to match (e.g. `app.example.com`) |
| `path`     | No       | Regex path to match (e.g. `/api/.*`)             |
| `service`  | Yes      | Backend to route to                              |

## Service URL Formats

| Service type           | Example                          |
|------------------------|----------------------------------|
| HTTP                   | `http://localhost:8080`          |
| HTTPS (self-signed OK) | `https://localhost:8443`         |
| SSH                    | `ssh://localhost:22`             |
| RDP                    | `rdp://localhost:3389`           |
| TCP                    | `tcp://localhost:5432`           |
| Return HTTP status     | `http_status:404`                |
| Hello World test       | `hello_world`                    |

## Common Configurations

### Single web app
```json
[
  { "hostname": "mysite.example.com", "service": "http://localhost:80" },
  { "service": "http_status:404" }
]
```

### Multiple services on one tunnel
```json
[
  { "hostname": "web.example.com",    "service": "http://localhost:3000" },
  { "hostname": "api.example.com",    "service": "http://localhost:8080" },
  { "hostname": "grafana.example.com","service": "http://localhost:3001" },
  { "service": "http_status:404" }
]
```

### SSH access
```json
[
  { "hostname": "ssh.example.com", "service": "ssh://localhost:22" },
  { "service": "http_status:404" }
]
```

## Important Notes

- Each hostname in ingress rules needs a DNS CNAME pointing to `<tunnel-id>.cfargotunnel.com`
- The CNAME should be proxied (orange cloud) through Cloudflare
- `cloudflared` must be running on the origin server with the tunnel token
- Tunnels are account-scoped, not zone-scoped — one tunnel can serve multiple zones
