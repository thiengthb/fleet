---
name: api-integration-specialist
description: Build robust clients for third-party APIs from a worker/bot or app — OAuth2 / API-key auth, retry with backoff, client-side rate limiting, webhook signature verification, pagination, and typed error handling. Use when a worker/bot/app calls an external service (Discord, Telegram, an LLM API, payment/email/SMS, any REST/GraphQL). Keys live in .env.
---

# API Integration Specialist (platform-adapted)

> **Adapted from** `development/api-integration-specialist` (`davila7/claude-code-templates`). Kept the client patterns;
> **replaced its Express webhook example with a Next.js Route Handler** (the platform has no Express — web apps use Route
> Handlers / server actions), normalized the skill name, and trimmed vendor-specific snippets. Mostly the **worker/bot**
> use case (headless services calling external APIs); also applies to a web app's outbound calls.

Keys/secrets **always** from `process.env` (`.env`, chmod 600 on the NUC) — never hardcoded (platform invariant).

## Auth

```ts
// API key
const client = new ServiceClient({ apiKey: process.env.SERVICE_API_KEY!, baseURL: process.env.SERVICE_BASE_URL! });

// OAuth2 authorization-code (e.g. the self-issued OAuth shim todo/yakudoku use for MCP)
const tokens = await oauth.exchangeCode(code); // store + refresh; never log the token
```

## A resilient request (retry + backoff + typed errors)

```ts
class ApiError extends Error {
  constructor(public status: number, public body: unknown) { super(`API ${status}`); }
  get rateLimited() { return this.status === 429; }
  get serverError() { return this.status >= 500; }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(30_000), // always set a timeout
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

async function withBackoff<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      const retriable = e instanceof ApiError && (e.serverError || e.rateLimited);
      if (!retriable || i === max - 1) throw e;       // never retry a 4xx client error
      await new Promise((r) => setTimeout(r, 2 ** i * 1000)); // 1s, 2s, 4s
    }
  }
}
```

## Client-side rate limiting

```ts
class RateLimiter {
  private hits: number[] = [];
  constructor(private max: number, private windowMs: number) {}
  async acquire() {
    const now = Date.now();
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.max) {
      await new Promise((r) => setTimeout(r, this.windowMs - (now - this.hits[0])));
      return this.acquire();
    }
    this.hits.push(now);
  }
}
```

## Webhook verification — Next.js Route Handler (NOT Express)

```ts
// app/api/webhooks/<service>/route.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: Request) {
  const raw = await req.text();                 // verify against the RAW body, before JSON.parse
  const sig = req.headers.get("x-signature") ?? "";
  const expected = createHmac("sha256", process.env.WEBHOOK_SECRET!).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return new Response("invalid signature", { status: 401 });
  const event = JSON.parse(raw);
  // ... handle event ...
  return new Response("ok");
}
```

> A machine-called webhook endpoint must **never** sit behind Authentik forward-auth (platform invariant) — exempt its
> Traefik router, like the MCP/OAuth endpoints in `todo`/`yakudoku`.

## Pagination (async generator)

```ts
async function* pages<T>(path: string, size = 100) {
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ limit: String(size), ...(cursor ? { cursor } : {}) });
    const res = await request<{ data: T[]; next?: string }>(`${path}?${q}`);
    yield res.data;
    cursor = res.next;
  } while (cursor);
}
```

## Checklist

- [ ] Keys from `.env`; never logged. HTTPS only. Timeout on every request.
- [ ] Retry only 5xx/429 with backoff; never retry a 4xx.
- [ ] Webhooks: verify signature on the raw body; the endpoint is forward-auth-exempt.
- [ ] Transform the external shape into a typed internal model (don't leak raw vendor fields through the app).
- [ ] Rate-limit client-side; log failures with context for debugging.
