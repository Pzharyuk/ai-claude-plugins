---
name: session-end
description: >
  Use this skill when wrapping up a conversation or when the user says "done",
  "wrapping up", "that's all", "end session", or similar. Writes a narrative session
  log entry to the Obsidian project note and does a final sync.
metadata:
  version: "0.1.0"
---

# Session End: obsidian-sync

Capture what happened in this session and sync final state to the Obsidian vault.

## When to trigger

- User says they're done, wrapping up, or ending the session
- A natural end point in the conversation where significant work was completed
- Before switching to a different project

## Workflow

### 1. Compose the session narrative
Write a concise paragraph (3-6 sentences) covering:
- **What was accomplished** — specific features, fixes, or changes made
- **Key decisions and reasoning** — why a particular approach was chosen, trade-offs considered
- **Files and areas touched** — which parts of the codebase were modified
- **Blockers encountered** — any issues that came up and how they were resolved (or not)
- **What to pick up next** — clear handoff for the next session

Keep it factual and useful for future context. Write as if briefing yourself tomorrow.

### 2. Append the session log
Call `obsidian_append_session_log` with:
- `project_name`: the project's display name (e.g. "AI Business Tools")
- `summary`: the narrative from step 1

### 3. Final sync
Call `obsidian_sync_project` with the project's root path to refresh all live data one last time.

### 4. Confirm
Let the user know the session has been logged and the project note is up to date.

## Example session log entry

> Implemented the Stripe webhook handler for invoice payment confirmation. Chose to use
> Stripe's built-in webhook signature verification rather than a custom HMAC check —
> simpler and maintained by Stripe. Modified `src/plugins/stripe/webhook.ts` and added
> the new route in `src/app/api/webhooks/stripe/route.ts`. Hit an issue with the raw
> body parsing in Next.js App Router — resolved by using `request.text()` instead of
> `request.json()`. Next session: wire up partial payment handling and add retry logic
> for failed webhook deliveries.

## Notes
- One log entry per session, even if multiple topics were covered.
- If no meaningful work was done (just questions/exploration), still log a brief note about what was discussed.
- The entry is prepended (most recent first) to the Session Log section.
