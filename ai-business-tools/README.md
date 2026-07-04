# ai-business-tools (Claude Code plugin)

Connect Claude Code to your [ai-business-tools](https://github.com/Pzharyuk/ai-business-tools) workspace.

The workspace ships with an MCP server at `/api/mcp` that exposes every plugin
tool (invoicing, clients, projects, expenses, estimates, bank transactions,
Gmail, Stripe, tax reporting, plugin management, and more). This plugin wires
Claude Code to that server over HTTP using a Bearer-token API key.

## Install

```
/plugin marketplace add Pzharyuk/ai-claude-plugins
/plugin install ai-business-tools@ai-claude-plugins
```

When installing you'll be prompted for two env vars:

| Variable | What |
|---|---|
| `AIBT_URL` | Base URL of your deployment, e.g. `https://agent.onit.systems`. No trailing slash. |
| `AIBT_API_KEY` | API key from the workspace. Generate one at `<AIBT_URL>/admin#api`. |

Full API reference (REST + MCP, with examples) is public at **`<AIBT_URL>/docs`**.

## Generating an API key

1. Open your workspace and go to **Settings → API** (or `<AIBT_URL>/admin#api`).
2. Click **Create Key**, pick a role:
   - **read** — list/get only (clients, invoices, transactions, balances)
   - **write** — read + create/update (most day-to-day work)
   - **admin** — write + delete + plugin management
3. Copy the key once shown — it can't be recovered.

Higher-role keys can call every tool a lower role can, plus more. Only generate
an `admin` key when you actually need to delete records or enable/disable
plugins from Claude.

## Transport

This plugin uses Claude Code's native HTTP MCP transport — no local server
process. Requests go directly from Claude Code to `${AIBT_URL}/api/mcp` with
the API key in the `Authorization` header.

## Revoking a key

Visit the **API** tab and click **Revoke** next to the key. The key is
soft-deleted via `revokedAt` and rejected on the next call.

## Troubleshooting

- **401 Unauthorized** — key was revoked or you're pointing at the wrong
  `AIBT_URL`. Check `/admin#api` shows the key as not revoked.
- **Tool missing** — the tool's plugin is disabled for your workspace. Enable
  it under **Settings → Plugins**, or call `enable_plugin` if your key has the
  `admin` role.
- **Tools differ between sessions** — the tool list is filtered by your key's
  role on each `tools/list` call. Switching to a higher-role key surfaces more
  tools.
