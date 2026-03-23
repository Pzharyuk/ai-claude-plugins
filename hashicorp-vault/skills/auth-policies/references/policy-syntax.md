# Vault ACL Policy Syntax Reference

## Basic Structure

```hcl
path "<path-pattern>" {
  capabilities = [<list-of-capabilities>]
}
```

## Capabilities

| Capability | HTTP Verbs | Description |
|-----------|------------|-------------|
| `create` | POST/PUT | Create new data |
| `read` | GET | Read data |
| `update` | POST/PUT | Update existing data |
| `delete` | DELETE | Delete data |
| `list` | LIST | List keys at a path |
| `sudo` | — | Access sudo-protected paths |
| `deny` | — | Explicitly deny access (overrides all) |

## Path Patterns

- Exact: `path "secret/data/myapp/config"` — matches only this path
- Glob: `path "secret/data/myapp/*"` — matches one level deep
- Prefix: `path "secret/data/myapp/"` — matches the path itself (trailing slash)
- Plus glob: `path "secret/data/+/config"` — matches any single segment

## Common Policy Examples

### Read-only access to a specific path
```hcl
path "secret/data/myapp/*" {
  capabilities = ["read", "list"]
}
```

### Full access to a team namespace
```hcl
path "secret/data/team-alpha/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/team-alpha/*" {
  capabilities = ["read", "list", "delete"]
}
```

### Admin policy (manage auth and policies)
```hcl
path "sys/auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

### Deny a specific secret
```hcl
path "secret/data/production/database" {
  capabilities = ["deny"]
}
```
