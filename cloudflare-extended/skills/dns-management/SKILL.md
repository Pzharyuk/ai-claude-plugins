---
name: dns-management
description: >
  Use this skill when the user asks to "manage DNS", "add a DNS record",
  "update DNS", "delete a DNS record", "create an A record", "set up a CNAME",
  "configure MX records", "list DNS records", "check DNS settings", or any
  task involving Cloudflare DNS zones or records.
metadata:
  version: "0.1.0"
---

# Cloudflare DNS Management

Use the `cloudflare-extended` MCP server tools to manage DNS records for the user's Cloudflare zones.

## Workflow

### Listing records

1. If the user hasn't specified a zone, call `cf_list_zones` to show available domains and ask which one to work with.
2. Call `cf_list_dns_records` with the resolved `zone_id`. Use optional `type` or `name` filters to narrow results.
3. Present records clearly: type, name, content, TTL, and whether proxied.

### Creating a record

1. Confirm: record type, name (fully qualified or relative), content, TTL (default: 1 = auto), and whether to proxy.
2. For MX records, also confirm priority.
3. Call `cf_create_dns_record`. Confirm success and show the new record ID.

### Updating a record

1. If no record ID is known, list records first to find the right one.
2. Ask the user which fields to change.
3. Call `cf_update_dns_record` with only the changed fields.

### Deleting a record

1. Always show the record to be deleted and ask for explicit confirmation before proceeding.
2. Call `cf_delete_dns_record`.
3. Confirm deletion.

## Record Type Reference

See `references/dns-record-types.md` for content format requirements per record type.

## Best Practices

- Proxied records (orange cloud) route traffic through Cloudflare — appropriate for web traffic (A, AAAA, CNAME to web servers).
- Non-proxied records (grey cloud) expose the origin IP — use for mail servers, FTP, SSH, or services that can't be proxied.
- TTL of 1 (auto) is fine for most records. Use longer TTLs only for rarely-changed records.
- Always confirm before deleting — DNS deletions can cause immediate outages.
