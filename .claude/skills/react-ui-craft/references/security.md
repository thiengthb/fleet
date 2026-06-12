# Frontend Security

Defensive hardening for a React/Next.js client. The frontend can't be the *only* line of defense — the backend must validate and authorize every request regardless of what the client does — but a sloppy frontend hands attackers XSS, leaked tokens, and exposed secrets. This is the pre-ship checklist.

## Table of contents
1. The one rule: never trust the client
2. XSS — the main React threat
3. Secrets & environment variables
4. Auth tokens — where to put them
5. The Next.js server boundary
6. CSRF
7. Content Security Policy & headers
8. Dependencies & supply chain
9. Pre-ship checklist

---

## 1. The one rule: never trust the client

Anything in the browser bundle is **public and tamperable**: source, env values prefixed for the client, network calls, local storage. Client-side validation and "hidden" UI are UX, not security. **Every authorization and validation check must also happen on the server.** Disabling a button does not protect an endpoint.

This is sharper for a **Vite SPA**: the entire app is shipped to the browser. There is no "server side" to hide anything in. Treat the backend API as the only trust boundary.

---

## 2. XSS — the main React threat

React escapes interpolated values by default, so `{userInput}` is safe. The holes are where you bypass that:

- **`dangerouslySetInnerHTML`** is the #1 React XSS vector. Only use it with HTML you control or HTML you've **sanitized** (e.g. `DOMPurify`) — never raw user/API content.
  ```tsx
  import DOMPurify from "dompurify";
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
  ```
  Better: render markdown/rich text through a library that outputs React nodes (not raw HTML) so there's no `innerHTML` at all.
- **`href`/`src` from user input** can be `javascript:` URLs. Validate the scheme — allow only `http(s):`/`mailto:` — before binding a user-provided URL to a link or image.
- **Spreading unknown props** onto a DOM element (`<div {...userControlled} />`) can inject event handlers. Whitelist what you spread.
- **`ref` + direct DOM manipulation** (`el.innerHTML = ...`) re-opens the same hole React closed. Don't.
- **Untrusted data in `<style>`/CSS** or in `eval`/`new Function` — don't build either from input.

If you allow rich user content (comments, profiles, a markdown editor), sanitize on output and ideally also store sanitized. Pair with a CSP (§7) as defense-in-depth.

---

## 3. Secrets & environment variables

- **Nothing secret goes in a client bundle.** Any var exposed to the browser is readable by anyone. In Next.js, only `NEXT_PUBLIC_*` vars reach the client — so an API key in `NEXT_PUBLIC_API_KEY` is *published*, not hidden. In Vite, **every** `VITE_*` var is shipped to the browser.
- **Server-only secrets** (DB URLs, third-party API keys, signing secrets) live in non-public env vars and are used **only in server code** (Next.js Server Components, Route Handlers, Server Actions; or your separate backend). A Vite SPA cannot hold a secret — proxy through your backend.
- **Public config vs secret:** the public API *base URL* is fine to expose; the *credentials* to call privileged operations are not.
- **`.env*` files are git-ignored**; never commit them. Rotate anything that lands in git history.

---

## 4. Auth tokens — where to put them

The storage choice is a real tradeoff; know it:

- **`localStorage`/`sessionStorage`** are readable by *any* JavaScript on the page — so a single XSS = full token theft. Convenient, but the standard advice is to **avoid storing access tokens there**, especially long-lived ones.
- **`httpOnly`, `Secure`, `SameSite` cookies** can't be read by JS, which neutralizes XSS token theft — but cookies are sent automatically, so they need **CSRF protection** (§6). This is generally the safer default for web apps with a backend you control.
- **In-memory** (a JS variable / React state) survives XSS no better than localStorage *for the current page*, but isn't persisted — combined with an httpOnly refresh-token cookie, holding the short-lived access token in memory is a common, solid pattern.

Practical default with your own backend: **refresh token in an httpOnly+Secure+SameSite cookie; short-lived access token in memory** (or also a cookie). Set `Secure` (HTTPS only) and `SameSite=Lax`/`Strict`. Keep access-token lifetimes short. Always provide a real logout that invalidates server-side.

Whatever you choose, **the backend validates the token on every request** — the client just transports it.

---

## 5. The Next.js server boundary

App Router blurs server and client, which creates specific footguns:

- **`"use client"` does not mean "secret".** A client component's code and any data passed to it ship to the browser. Don't pass a server secret as a prop to a client component.
- **Server Actions are public endpoints.** Anyone can invoke an exported action with arbitrary input. **Authenticate and authorize inside every action**, and **validate input** (Zod) — never assume it came from your form.
- **Route Handlers / API routes** likewise: check auth and validate input server-side every time.
- **Don't leak server data accidentally.** Returning a full DB row from a Server Component to the client may expose fields (password hashes, internal flags) you didn't mean to. Return only what the UI needs (a DTO).
- **`server-only` package:** import it in modules that must never end up in a client bundle; the build fails if they do — a cheap guardrail.
- **Error detail:** don't send stack traces or internal messages to the client in production; Next.js redacts server errors by default — keep it that way.

---

## 6. CSRF

If you authenticate with cookies, the browser attaches them automatically, so a malicious site can trigger authenticated requests (CSRF). Mitigations:
- **`SameSite=Lax` or `Strict`** on the auth cookie blocks most cross-site sends (Lax is a good default).
- **CSRF tokens** (double-submit cookie or synchronizer token) for state-changing requests, validated server-side.
- Token-in-`Authorization`-header schemes (not cookies) aren't CSRF-prone because the browser doesn't auto-attach them — but then you're back to §4's XSS storage tradeoff.

---

## 7. Content Security Policy & headers

A CSP is defense-in-depth that blunts XSS even if something slips through.
- Set a **CSP** that restricts `script-src` (avoid `unsafe-inline`/`unsafe-eval`; use nonces/hashes — Next.js supports nonce-based CSP via middleware). Start in report-only mode, then enforce.
- Other headers worth setting (via `next.config` headers, middleware, or your server/CDN): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` (clickjacking), `Permissions-Policy`.
- **HTTPS everywhere**; redirect HTTP→HTTPS; `Secure` cookies.

---

## 8. Dependencies & supply chain

The npm tree is a large attack surface.
- **`npm audit`** in CI; patch high/critical promptly. Enable Dependabot/Renovate.
- **Pin and review** — a lockfile committed; be wary of adding a dependency for a one-liner you can write. Each package is trust you extend.
- **Vet new packages:** maintenance, downloads, recent activity, install scripts. Typosquats are real — check the exact name.
- **Don't `npm install` random snippets** from issues/blogs without reading them.
- Keep framework and Motion/shadcn deps reasonably current — security fixes land in patches.

---

## 9. Pre-ship checklist

Run through this before calling a frontend done:

- [ ] No secret in any client-exposed env var (`NEXT_PUBLIC_*` / all `VITE_*`).
- [ ] No `dangerouslySetInnerHTML` with unsanitized content; user URLs scheme-checked.
- [ ] Auth tokens stored per §4; httpOnly+Secure+SameSite cookies where used; real server-side logout.
- [ ] Every Server Action / API route authenticates, authorizes, and validates input (Zod) server-side.
- [ ] Client components receive only non-sensitive, minimal data (DTOs, not raw rows).
- [ ] CSRF handled if cookie auth; security headers + CSP set.
- [ ] `npm audit` clean of high/critical; lockfile committed.
- [ ] Production builds don't leak stack traces / verbose errors to users.
- [ ] All input validated/sanitized on the server too — the client is never the only check.
