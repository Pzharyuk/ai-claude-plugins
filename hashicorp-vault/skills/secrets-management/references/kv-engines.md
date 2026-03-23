# KV Secrets Engines Reference

## KV v2 (recommended)

- Supports versioning (configurable max versions)
- Soft delete with undelete capability
- Metadata storage (custom metadata, created/updated timestamps)
- Check-and-Set (CAS) for optimistic concurrency control
- API paths: `{mount}/data/{path}`, `{mount}/metadata/{path}`, `{mount}/delete/{path}`, `{mount}/undelete/{path}`

### Enable KV v2
```
vault_enable_engine(path="secret", type="kv", options={ version: "2" })
```

## KV v1

- Simple key-value storage, no versioning
- Deletes are permanent
- Slightly simpler API
- API paths: `{mount}/{path}`

### Enable KV v1
```
vault_enable_engine(path="kv", type="kv", options={ version: "1" })
```

## Other Secrets Engines

| Type | Purpose |
|------|---------|
| `pki` | X.509 certificate management |
| `transit` | Encryption as a service |
| `database` | Dynamic database credentials |
| `aws` | Dynamic AWS IAM credentials |
| `ssh` | SSH certificate signing |
| `totp` | Time-based one-time passwords |
| `cubbyhole` | Per-token private storage |
