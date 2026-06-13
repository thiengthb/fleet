---
name: mcp-builder
description: Build a high-quality MCP (Model Context Protocol) server so an LLM can use a service's tools — design discoverable tools with typed input/output schemas + annotations, implement in TypeScript (mcp-handler/SDK) or Python (FastMCP), test with MCP Inspector, and write evaluations. Use when adding an MCP server to an app. On this platform: a Next.js Route Handler at /api/mcp, behind a forward-auth-EXEMPT Traefik router.
---

# MCP Server Builder (platform-adapted)

> **Adapted from** `development/mcp-builder` (Anthropic-authored, in `davila7/claude-code-templates`; see its upstream
> `LICENSE.txt`). Rewritten **self-contained**: it points to the **live** MCP docs/SDK (not vendored local reference
> files that go stale) and is **anchored to this platform's living MCP pattern** (`todo`, `yakudoku`). No scripts vendored.

## Platform anchor — copy the living pattern first

`todo` and `yakudoku` already ship MCP servers. **Read `todo`'s `app/api/mcp/` + `lib/mcp/` before building a new one** —
it's the authoritative reference for THIS platform:

- **Transport/host:** a **Next.js Route Handler at `/api/mcp`** using `mcp-handler` + `@modelcontextprotocol/sdk`
  (streamable HTTP). Not a standalone process.
- **Auth:** a **self-issued OAuth shim** (the app mints/validates its own tokens for the MCP client). The endpoint is
  **EXEMPT from Authentik forward-auth** via its own Traefik router (e.g. `todo-mcp`, `yakudoku-mcp`) — **INVARIANT:
  never put forward-auth on an endpoint a machine client calls automatically.** Auth happens at the app layer instead.
- **Guide sync:** every MCP server must have an **MCP tab in the app's `/guide`** (skill `/user-guide`): endpoint + auth,
  how to connect, the tool table with examples. A new tool ⇒ update the tab in the same change.

## Process

### 1. Research & design
- MCP spec: start at `https://modelcontextprotocol.io/sitemap.xml`, fetch pages with a `.md` suffix
  (e.g. `.../specification/draft.md`). SDK READMEs (live): TypeScript
  `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md` · Python
  `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md`.
- **Tool design:** clear action-oriented names with a consistent prefix (`todo_add_task`, `todo_list_today`); concise
  descriptions; return focused, paginated data (context is precious); **actionable error messages** that tell the agent
  what to do next. Default to comprehensive API coverage; add workflow tools for common multi-step tasks.

### 2. Implement
- **TS (default here):** `mcp-handler` in the Route Handler; **Zod** input schemas; define an `outputSchema` +
  return `structuredContent` where possible.
- **Python worker:** **FastMCP**, **Pydantic** models, `@mcp.tool`.
- Each tool: typed input (constraints + examples in field descriptions), async I/O, errors with next-step guidance, and
  **annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` (be honest; agents trust these).
- Shared infra: authed API client, error helper, response formatting, pagination.

### 3. Test
- TS: `npm run build`, then **MCP Inspector** `npx @modelcontextprotocol/inspector`.
- Python: `python -m py_compile`, then Inspector.
- Verify the tool actually accomplishes a real task (the quality bar = can an LLM use it to get real work done).

### 4. Evaluate
Write ~10 eval questions that are **independent · read-only · complex (multi-tool) · realistic · verifiable (one stable
answer)**. Solve each yourself to confirm. This catches tools that "exist" but aren't actually usable.

## Checklist

- [ ] Read `todo`'s MCP server first; matched the Route-Handler-at-`/api/mcp` + OAuth-shim pattern.
- [ ] The MCP router is **forward-auth-exempt** in Traefik (machine clients can't do an Authentik login).
- [ ] Tools: prefixed names, Zod/Pydantic input + output schema, honest annotations, actionable errors, pagination.
- [ ] Tested with MCP Inspector; an LLM can complete a real task.
- [ ] `/guide` MCP tab added/updated in the same change (`/user-guide`).
- [ ] No secret in the tool output; keys from `.env`.
