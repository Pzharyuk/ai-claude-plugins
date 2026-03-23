---
name: pki-management
description: >
  Use this skill when the user asks to "issue a certificate", "manage PKI",
  "create a TLS cert", "revoke a certificate", "list certificates",
  "set up internal CA", or any task involving Vault PKI secrets engine.
metadata:
  version: "0.1.0"
---

# Vault PKI Certificate Management

Use the `hashicorp-vault` MCP server tools to manage X.509 certificates via the PKI secrets engine.

## Workflow

### Issuing a certificate

1. Confirm the PKI mount path (default: `pki`), role name, and common name.
2. Ask about SANs (Subject Alternative Names), IP SANs, and TTL if not specified.
3. Call `vault_pki_issue_cert` with the parameters.
4. Present the issued certificate, private key, and CA chain. **Warn the user to store the private key securely.**

### Listing certificates

Call `vault_pki_list_certs` to list all serial numbers of issued certificates.

### Reading a certificate

Call `vault_pki_read_cert` with the serial number to view the certificate details.

### Revoking a certificate

1. Always confirm the serial number and reason with the user.
2. Call `vault_pki_revoke_cert`.
3. Confirm the certificate has been added to the CRL.

## Transit Encryption

The Transit engine provides encryption-as-a-service:

### Encrypting data
1. Data must be base64-encoded first.
2. Call `vault_transit_encrypt` with the key name and base64 plaintext.
3. Returns `vault:v1:...` ciphertext.

### Decrypting data
1. Call `vault_transit_decrypt` with the key name and ciphertext.
2. Returns base64-encoded plaintext (decode to get original).

### Managing keys
- `vault_transit_list_keys` — list all encryption keys
- `vault_transit_create_key` — create a new key (choose type: aes256-gcm96, ed25519, rsa-2048, etc.)

## Best Practices

- Use intermediate CAs, not root CAs, for issuing certificates.
- Set appropriate TTLs (short-lived certs are more secure).
- Monitor the CRL for revoked certificates.
- For Transit: rotate keys periodically with `vault write transit/keys/{name}/rotate`.

## Reference

See `references/pki-setup.md` for PKI engine setup guide.
