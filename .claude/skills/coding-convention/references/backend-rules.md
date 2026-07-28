---
rule_domain: backend-rules
applies_when: "writing or reviewing server-only code — server action, route handler, Prisma access, health endpoint, machine endpoint (MCP/OAuth/webhook)"
load_priority: high
---

# Backend rules — Next.js (Route Handlers + Server Actions, NO separate Express)

> Living reference: `todo/app/`. **NEVER** stand up a separate Express; all backend lives in Next.js.

## Where each kind of server code goes

| Kind | Location | Example |
|---|---|---|
| Mutation called from UI | **Server Action** | `app/actions.ts` |
| Browser-side query (rare) | Server Action or Route Handler | — |
| HTTP / machine endpoint | **Route Handler** | `app/api/<x>/route.ts` |
| Health probe | Route Handler, **always open** | `app/api/health/route.ts` |
| MCP / OAuth / webhook (machine clients) | Route Handler in a separate router | `todo/app/api/[transport]`, `app/api/oauth/*` |

## Hard rules

- **NEVER** put auth on `app/api/health/route.ts` — it's used by Docker HEALTHCHECK + CI.
- **IF** an endpoint is called automatically by a MACHINE client (MCP / OAuth / webhook) **→** it MUST NOT sit behind forward-auth. Split into a separate router; auth at the app layer (bearer / OAuth — see `auth-apps.md`).
- **NEVER** hand-code login / password hashing / JWT / session minting (platform invariant #8). Use Authentik forward-auth + read `X-authentik-*` headers.
- **NEVER** hardcode a DB / file path. Read from env (`DATABASE_URL`, …). Data persists via a named volume.
- Configure via `process.env.X || '<fallback>'`.

## Prisma

- **IF** the app uses Prisma **→** export a single shared `prisma` instance from `lib/db.ts` (avoids creating many clients on hot-reload).
- Schema lives in `prisma/schema.prisma`.
- For ORM depth (migrations, N+1, transactions) → skill `/prisma-expert`.
- For schema/relationship/index design → skill `/database-design`.

## Auth (per platform)

Order of preference:
1. **Forward-auth via Authentik** at Traefik (the gate).
2. **In-app authorisation** by reading `X-authentik-*` headers (`headers()` in Next).
3. **API token / OAuth** for machine endpoints (NOT forward-auth).

## See also

- `CLAUDE.md` invariant #8 + skill `/app-protect` — protection workflow
- `authentik/docs/auth-apps.md` — registry + traps
- `references/typescript-style.md` — `node:` prefix, ESM, async/await on the server
