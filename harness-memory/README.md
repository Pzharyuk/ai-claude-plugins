# harness-memory (Claude Code plugin)

Connect Claude Code (and Grok) to a running [harness-memory](https://github.com/Pzharyuk/harness-memory) `memoryd` store.

This plugin is a thin HTTP MCP client — **no local Node server**. Requests go to `${MEMORY_URL}/mcp` with a Bearer token. `memoryd` must already be running.

Vendored librarian skill copied from `harness-memory` at commit `9f9f1b7`.

## Install

```
/plugin marketplace add Pzharyuk/ai-claude-plugins
/plugin install harness-memory@ai-claude-plugins
```

Grok:

```
grok plugin marketplace add Pzharyuk/ai-claude-plugins
grok plugin install harness-memory --trust
```

When installing you'll be prompted for:

| Variable | Required | Default | What |
|---|---|---|---|
| `MEMORY_URL` | no | `http://127.0.0.1:8741` | Base URL of `memoryd`. No trailing slash. |
| `MEMORY_TOKEN` | yes (secret) | — | Per-harness token from `memory token create --harness claude` (or `grok`). |

## Prerequisites

`memoryd` must be up before this plugin can talk to it.

```
brew tap Pzharyuk/tools
brew install harness-memory
brew services start postgresql@16
createdb memory
brew services start harness-memory
memory init
memory token create --harness claude
```

`memory init` prints the **admin** token once. Export it as `MEMORY_TOKEN`, then mint a per-harness token. Give Claude and Grok their own tokens — not the admin token.

If `memoryd` is remote (compose/helm), set `MEMORY_URL` to that base URL.

## Transport

Claude Code's native HTTP MCP transport. No `server/` directory.

```
POST ${MEMORY_URL}/mcp
Authorization: Bearer ${MEMORY_TOKEN}
```

If a harness cannot speak HTTP MCP, use `memory mcp` as a stdio proxy.

## Configure

Run the `configure` skill, or:

1. `memory status` — if down: `brew services start harness-memory` or set `MEMORY_URL`.
2. `memory token create --harness claude` (or `grok`).
3. Persist `MEMORY_URL` / `MEMORY_TOKEN` (plugin setup env or `~/.mcp.json`).
4. `/reload-plugins`.

## MCP tools (9)

These live on `memoryd`, not in this repo:

- `recall` — session brief
- `save` — auto-write a memory
- `search` — FTS
- `ingest_source` — immutable raw source
- `read_page` / `write_page` — wiki I/O
- `lint` — read-only diagnostics
- `inbox_list` / `inbox_propose` — proposals

No `inbox_accept` on MCP. Tell the user to run `memory inbox` / `memory accept` / `memory reject` with the admin token.

## Skills

- `configure` — check `memoryd`, mint a token, persist env
- `harness-memory` — librarian: recall, save, ingest, file-back, never accept inbox

## Troubleshooting

- **401 Unauthorized** — wrong or revoked token, or `MEMORY_URL` points at the wrong host.
- **Connection refused** — `memoryd` is down. `memory status`, then `brew services start harness-memory`.
- **Do not write secrets** into memory bodies.

See the [harness-memory README](https://github.com/Pzharyuk/harness-memory) for brew/compose/helm and first-run details.
