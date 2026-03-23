# PKI Engine Setup Guide

## Initial Setup

### 1. Enable the PKI engine
```
vault_enable_engine(path="pki", type="pki")
vault_tune_engine(path="pki", max_lease_ttl="87600h")  # 10 years
```

### 2. Generate a root CA (or intermediate)
This step requires the Vault CLI:
```bash
vault write pki/root/generate/internal \
  common_name="My Root CA" \
  ttl="87600h"
```

### 3. Configure URLs
```bash
vault write pki/config/urls \
  issuing_certificates="https://vault.example.com:8200/v1/pki/ca" \
  crl_distribution_points="https://vault.example.com:8200/v1/pki/crl"
```

### 4. Create a role
```bash
vault write pki/roles/my-role \
  allowed_domains="example.com" \
  allow_subdomains=true \
  max_ttl="720h"
```

### 5. Issue certificates
Now you can use `vault_pki_issue_cert(mount="pki", role="my-role", common_name="app.example.com")`.

## Certificate Formats

| Format | Description |
|--------|-------------|
| `pem` | PEM-encoded (default) |
| `der` | DER-encoded binary |
| `pem_bundle` | PEM with full chain |

## Recommended Architecture

```
Root CA (offline, long TTL)
  └── Intermediate CA (Vault-managed, medium TTL)
        └── Leaf certificates (short TTL, auto-renewed)
```
