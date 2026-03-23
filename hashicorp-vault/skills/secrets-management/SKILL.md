---
name: secrets-management
description: >
  Use this skill when the user asks to "manage secrets", "read a secret",
  "write a secret", "list secrets", "delete a secret", "create a KV engine",
  "enable secrets engine", or any task involving HashiCorp Vault secret storage.
metadata:
  version: "0.1.0"
---

# Vault Secrets Management

Use the `hashicorp-vault` MCP server tools to manage secrets for the user's Vault instance.

## Workflow

### Listing secrets

1. If the user hasn't specified a mount, call `vault_list_mounts` to show available secrets engines.
2. Call `vault_kv_list` (for KV v2) or `vault_kv1_list` (for KV v1) with the mount and optional path.
3. Present the list of keys clearly.

### Reading a secret

1. Determine whether the engine is KV v1 or v2 (check mounts if unsure).
2. For KV v2: call `vault_kv_read` with mount, path, and optional version.
3. For KV v1: call `vault_kv1_read` with mount and path.
4. Present the key-value pairs. **Never log or echo secrets unnecessarily.**

### Writing a secret

1. Confirm the mount, path, and key-value data.
2. For KV v2: call `vault_kv_write`. Use `cas` for check-and-set if updating existing secrets.
3. For KV v1: call `vault_kv1_write`.
4. Confirm success and show the created/updated version.

### Deleting a secret

1. Always show the secret path and ask for explicit confirmation.
2. For KV v2 soft delete: call `vault_kv_delete` (data can be recovered with `vault_kv_undelete`).
3. For permanent delete: call `vault_kv_metadata_delete` (destroys all versions).
4. For KV v1: call `vault_kv1_delete` (permanent).

### Managing secrets engines

1. `vault_list_mounts` — see all mounted engines.
2. `vault_enable_engine` — mount a new engine (specify type and options like `{ version: "2" }` for KV v2).
3. `vault_disable_engine` — unmount an engine (**destroys all data**; always confirm first).
4. `vault_tune_engine` — adjust TTLs and description.

## Best Practices

- Default to KV v2 for new engines (supports versioning, soft delete, metadata).
- Use `cas` (check-and-set) when updating critical secrets to prevent overwrites.
- Never display secret values unless the user explicitly asks to read them.
- When creating a new KV engine, use: `vault_enable_engine` with `type: "kv"` and `options: { version: "2" }`.

## Reference

See `references/kv-engines.md` for detailed KV v1 vs v2 differences.
