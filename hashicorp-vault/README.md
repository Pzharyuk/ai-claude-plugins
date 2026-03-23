# HashiCorp Vault Plugin

Full HashiCorp Vault management from Claude — covering KV secrets (v1 & v2), secret engines, auth methods, ACL policies, tokens, PKI certificates, and Transit encryption.

## Overview

This plugin adds a local MCP server that connects directly to the Vault HTTP API, giving Claude full control over your Vault instance for secrets management, security operations, and certificate lifecycle.

## Components

| Component | Purpose |
|-----------|---------|
| MCP Server (`hashicorp-vault`) | Wraps the Vault HTTP API for secrets, auth, policy, PKI, and transit tools |
| Skill: `secrets-management` | Guides for KV read/write/list/delete and engine management |
| Skill: `auth-policies` | Guides for auth methods, ACL policies, and token lifecycle |
| Skill: `pki-management` | Guides for PKI certificate issuance and Transit encryption |

## Available Tools (35)

### System / Health
- `vault_health` — check Vault server health
- `vault_seal_status` — get seal status
- `vault_leader` — get HA cluster leader

### KV v2 Secrets
- `vault_kv_read` — read a secret (with optional version)
- `vault_kv_write` — write a secret (with optional CAS)
- `vault_kv_delete` — soft-delete secret versions
- `vault_kv_undelete` — restore soft-deleted versions
- `vault_kv_list` — list secrets at a path
- `vault_kv_metadata_read` — read secret metadata
- `vault_kv_metadata_delete` — permanently delete all versions

### KV v1 Secrets
- `vault_kv1_read` — read a secret
- `vault_kv1_write` — write a secret
- `vault_kv1_delete` — delete a secret
- `vault_kv1_list` — list secrets at a path

### Secret Engines
- `vault_list_mounts` — list all mounted engines
- `vault_enable_engine` — enable a new engine
- `vault_disable_engine` — disable (unmount) an engine
- `vault_tune_engine` — tune engine configuration

### Auth Methods
- `vault_list_auth` — list enabled auth methods
- `vault_enable_auth` — enable a new auth method
- `vault_disable_auth` — disable an auth method

### Policies
- `vault_list_policies` — list all ACL policies
- `vault_read_policy` — read a policy
- `vault_write_policy` — create or update a policy
- `vault_delete_policy` — delete a policy

### Tokens
- `vault_create_token` — create a new token
- `vault_lookup_token` — look up token info
- `vault_lookup_self` — look up current token
- `vault_revoke_token` — revoke a token and children
- `vault_renew_token` — renew a token's lease

### PKI Certificates
- `vault_pki_issue_cert` — issue a certificate
- `vault_pki_list_certs` — list issued certificates
- `vault_pki_read_cert` — read a certificate
- `vault_pki_revoke_cert` — revoke a certificate

### Transit Encryption
- `vault_transit_encrypt` — encrypt data
- `vault_transit_decrypt` — decrypt data
- `vault_transit_list_keys` — list encryption keys
- `vault_transit_create_key` — create a new key

## Setup

### 1. Get Your Vault Address and Token

Your Vault address is the URL you use to access Vault (e.g. `https://vault.example.com:8200`).

Generate a token with appropriate permissions:
```bash
vault token create -policy=admin -ttl=24h
```

Or use the root token from `vault operator init` for initial setup.

### 2. Set Environment Variables

```bash
export VAULT_ADDR="https://vault.example.com:8200"
export VAULT_TOKEN="hvs.your-token-here"
export VAULT_VERIFY_SSL="false"  # Set to true for CA-signed certs
```

### 3. Install the Plugin

Install `hashicorp-vault.plugin` via the Cowork plugins interface.

## Usage Examples

- "List all secrets in the 'secret' engine"
- "Write a new secret at secret/myapp/config with key=value pairs"
- "Create an ACL policy that gives read access to secret/production/*"
- "Issue a TLS certificate for api.example.com from the pki engine"
- "Encrypt this data using the Transit engine"
- "Create a token with the 'myapp-read' policy and 1-hour TTL"
