# DNS Record Type Reference

## A
- **Content**: IPv4 address (e.g. `192.0.2.1`)
- **Proxiable**: Yes
- **Use**: Point hostname to an IPv4 server

## AAAA
- **Content**: IPv6 address (e.g. `2001:db8::1`)
- **Proxiable**: Yes
- **Use**: Point hostname to an IPv6 server

## CNAME
- **Content**: Target hostname (e.g. `target.example.com`)
- **Proxiable**: Yes (except at zone apex)
- **Use**: Alias one hostname to another

## MX
- **Content**: Mail server hostname (e.g. `mail.example.com`)
- **Priority**: Required (lower = higher priority, e.g. 10)
- **Proxiable**: No
- **Use**: Route email for the domain

## TXT
- **Content**: Arbitrary text string (e.g. `"v=spf1 include:example.com ~all"`)
- **Proxiable**: No
- **Use**: SPF, DKIM, DMARC, domain verification

## NS
- **Content**: Nameserver hostname (e.g. `ns1.example.com`)
- **Proxiable**: No
- **Use**: Delegate a subdomain to another DNS provider

## SRV
- **Content**: `priority weight port target` (e.g. `10 20 5060 sip.example.com`)
- **Proxiable**: No
- **Use**: Service discovery (SIP, XMPP, etc.)

## CAA
- **Content**: `flags tag value` (e.g. `0 issue "letsencrypt.org"`)
- **Proxiable**: No
- **Use**: Restrict which CAs can issue certificates for the domain

## PTR
- **Content**: Hostname (for reverse DNS)
- **Use**: Reverse DNS lookups

## Common Patterns

### Web hosting (A + proxied)
```
type: A
name: example.com  (or www.example.com)
content: 192.0.2.1
proxied: true
ttl: 1
```

### Subdomain alias (CNAME + proxied)
```
type: CNAME
name: app.example.com
content: myapp.vercel.app
proxied: true
```

### Google Workspace MX records
```
type: MX, name: example.com, content: aspmx.l.google.com, priority: 1
type: MX, name: example.com, content: alt1.aspmx.l.google.com, priority: 5
type: MX, name: example.com, content: alt2.aspmx.l.google.com, priority: 5
```

### SPF record
```
type: TXT
name: example.com
content: "v=spf1 include:_spf.google.com ~all"
```
