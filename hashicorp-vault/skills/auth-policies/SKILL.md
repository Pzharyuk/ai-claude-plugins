---
name: auth-policies
description: >
  Use this skill when the user asks to "manage auth methods", "create a policy",
  "manage tokens", "enable LDAP", "set up approle", "create an ACL policy",
  "revoke a token", "list policies", or any task involving Vault authentication
  and authorization.
metadata:
  version: "0.1.0"
---

# Vault Auth & Policies Management

Use the `hashicorp-vault` MCP server tools to manage authentication methods, ACL policies, and tokens.

## Auth Methods

### Listing auth methods
Call `vault_list_auth` to see all enabled auth methods with their types and paths.

### Enabling an auth method
1. Choose the type: `userpass`, `approle`, `ldap`, `oidc`, `kubernetes`, `jwt`, `cert`, `github`, etc.
2. Call `vault_enable_auth` with a path and type.
3. After enabling, the auth method needs configuration (done via the Vault CLI or API directly for method-specific settings).

### Disabling an auth method
1. **Warning:** Disabling revokes all tokens issued by that method.
2. Always confirm with the user before proceeding.
3. Call `vault_disable_auth`.

## ACL Policies

### Listing policies
Call `vault_list_policies` to see all ACL policy names.

### Reading a policy
Call `vault_read_policy` with the policy name to view the HCL rules.

### Creating/updating a policy
1. Write the policy in HCL format. Example:
```hcl
path "secret/data/myapp/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/myapp/*" {
  capabilities = ["list", "read"]
}
```
2. Call `vault_write_policy` with the name and policy document.

### Deleting a policy
1. Confirm with the user — tokens using this policy will lose those permissions.
2. Call `vault_delete_policy`.

## Tokens

### Creating a token
Call `vault_create_token` with policies, TTL, and other options. Common patterns:
- Service token: `policies: ["myapp-read"], ttl: "24h", renewable: true`
- One-time use: `num_uses: 1, ttl: "5m"`
- Orphan token: `no_parent: true` (won't be revoked when parent is)

### Looking up tokens
- `vault_lookup_self` — info about the current token
- `vault_lookup_token` — info about a specific token

### Renewing a token
Call `vault_renew_token` before the TTL expires. Only works if the token is renewable.

### Revoking a token
Call `vault_revoke_token` — this also revokes all child tokens.

## Best Practices

- Use the principle of least privilege for policies.
- Prefer short TTLs with renewal over long-lived tokens.
- Use `approle` for machine-to-machine auth, `oidc` for humans.
- Never share root tokens; create scoped tokens instead.

## Reference

See `references/policy-syntax.md` for HCL policy syntax details.
