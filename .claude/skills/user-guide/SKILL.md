---
name: user-guide
description: Build & maintain the in-app user guide for any MiniServer app with a UI — a /guide page walking through screens + actions; if the app integrates Discord and/or an MCP server, a dedicated tab documenting setup, the full command/tool list, examples, and troubleshooting. Use when building a guide page, adding a Discord/MCP integration, or when the user asks about the guide / help page.
---

# Skill: In-app user guide (user-guide)

Every MiniServer app with a UI must teach the user how to use it **inside the app** — not only in
`docs/`. This skill defines what that guide page must contain and keeps it in sync with the features.
Living reference: `todo/app/guide/page.tsx` (route `/guide`, tabs "Using the app" + "Use with AI/MCP").

Standards this builds on: `/react-ui-craft` (frontend engineering) + `/coding-convention` (stack, UI rules)
+ `nuc-platform/05-TAI-LIEU-CHUAN.md` (the guide mirrors `docs/03-user-guide.md`).

## Rule (mandatory for every app with a UI)

1. **A guide page exists** at route `/guide` (and is reachable from the app shell / menu).
2. **It is task-oriented**: walk through each screen and the key actions, with tips — not a feature dump.
3. **One dedicated tab per machine-facing integration** the app exposes (see below). Use shadcn `Tabs`.
4. **It stays in sync**: when you add/remove a command, MCP tool, notification type, or screen, update
   the matching guide tab in the SAME change (the pre-commit doc reminder applies here too).
5. **Language**: the guide is user-facing → write its copy in the **app's product language** (e.g.
   Vietnamese for `todo`). This is the one place exempt from the English-for-dev-artifacts rule; code,
   comments, and `docs/*.md` around it stay English.

## Required tabs

### Base tab — "Using the app"
Walk through every screen/route the user touches: what it's for, the controls on it, and 1–2 tips. Mirror
the structure of `docs/03-user-guide.md` (don't duplicate prose — the in-app version can be tighter).

### Discord tab — required IF the app sends/receives Discord (bot or webhook)
Document, concretely:
- **Setup**: how to connect (invite the bot / set the webhook), which env/secret is involved (name only),
  and where (the app's settings screen or `.env` on NUC).
- **Commands** (if a bot): a table — `command` · what it does · example · who can run it (allowlist?).
- **Notifications** (if webhook): each notification type, when it fires, how to toggle it, quiet hours.
- **Troubleshooting**: "nothing arrives" checklist (webhook URL, secret, quiet hours, allowlist).
> Behavioral apps (e.g. `todo` §13): keep the tone supportive — describe notifications as help, not nagging.

### MCP tab — required IF the app exposes an MCP server (route `…/api/mcp`)
Document, concretely:
- **Endpoint + auth**: the MCP URL and how to authenticate (bearer `*_AUTH_TOKEN` and/or OAuth shim).
  Never print secret values — only names and where to get them.
- **How to connect**: steps for Claude Desktop / claude.ai / Claude Code (the config entry to add).
- **Tools**: a table — `tool` · what it does · a short example call. Group by area if many.
- **Workflow / prompt guidance**: how the AI is expected to behave (read context → present → wait for
  approval → write), and any capacity/safety limits it must respect.
- **Safety**: which endpoints are exempt from forward-auth and why (machine clients), per
  `authentik/docs/auth-apps.md` + the app's `docs/00-map.md`.
> Living MCP example: `todo` (`app/api/[transport]`, OAuth shim) — mirror its guide tab.

## Procedure

1. Detect integrations: does the app have a Discord bot/webhook? an MCP route (`app/api/[transport]` /
   `…/api/mcp`)? Check `docs/00-map.md` §3/§7 + code. Each present integration ⇒ its tab is required.
2. If `/guide` doesn't exist, scaffold it following `todo/app/guide/page.tsx` (shadcn `Tabs`, motion via
   `/react-ui-craft`, app-shell width per the app's UI conventions). Server Component for static copy.
3. Fill the base tab from `docs/03-user-guide.md`; fill integration tabs from the real command/tool list
   (read the bot's command registry / `lib/mcp/server.ts` — don't invent commands).
4. Cross-check the tool/command tables against the code so nothing is stale or missing.
5. Report what was added/updated. Don't commit/push unless asked (pushing an app repo triggers CI).

## Acceptance

- [ ] `/guide` exists, reachable from the menu, walks through every screen.
- [ ] Every machine-facing integration the app exposes has its own tab (Discord and/or MCP).
- [ ] Command/tool tables match the code (no invented or missing entries).
- [ ] Copy is in the app's product language; surrounding code/docs are English.
