---
title: Token optimization — Batch 2 (the real per-session savings)
kind: refactor # internal efficiency cleanup, grounded in our own measurements — no external/novel design ⇒ not a research-gated P3
status: active
created: 2026-06-20
updated: 2026-06-20
related:
  [
    CLAUDE.md,
    PR #18 (Batch 1 — merged: P1–P3 process tiering + thin-slice-first),
    .claude/memory/direct-over-subagent-for-known-context.md,
  ]
---

## Goal

Cut the FIXED per-session token cost (paid before any work, multiplied by the multi-session pattern). Practice-first:
never trade away the working result — only remove waste. Batch 1 already shipped the behavioral half (stakes-tiered
workflow + thin-slice-first). Batch 2 = the actual byte/context savings.

## Context (measured 2026-06-20)

Fixed per-session ≈ 25–30k tokens before any work. Biggest sinks, in order: **skill descriptions ~8–12k** (37 skills) ·
**3-tier auto-read ~6k** (INVENTORY + a 00-map every session) · **CLAUDE.md ~5.5k** · **Shopify MCP ~1–2k** (irrelevant
to this platform). Trimming CLAUDE.md prose alone is low-yield (~5% net) — the real levers are below. Direction =
lean-first (supervisor-approved 2026-06-20).

## Steps

- [ ] **#1 Shopify MCP** — disconnect the connector at claude.ai. *USER action* (cannot be done from the repo). ~1–2k/session, zero relevance.
- [ ] **#5 JIT context** — stop mandating the full 3-tier read on every session entry; read a project's `00-map.md` only
      when the task actually touches that project. Edit the context-loading rule in `CLAUDE.md` §Documentation. ~3–5k/session.
- [ ] **#6 Skill cull 37 → ~28** — review each skill; merge/retire niche ones (candidates: `auto-pilot-smoke-test`,
      `skill-proposer`, `nuc-scheduled-maintenance`) to cut the every-session description tax. ~3–5k/session.
      **Governance (.claude/skills) → propose-don't-execute: a human reviews + approves each removal.**
- [ ] **(optional) Structural CLAUDE.md cut** — if more byte-cut is wanted, move heavy sections (lifecycle table,
      autonomous-agent detail) to on-demand reference docs, leaving pointers. Only if #5/#6 prove insufficient.
- [ ] **#7 Make `prior-art-check.mjs` stakes-aware** — the hook currently forces ≥2 external URLs on EVERY
      `kind: feature|system-change` plan, regardless of stakes (it blocked this very plan). Align it with the new P-tier
      rule: only gate genuinely-novel P3 designs, not internally-grounded refactors/cleanups. Governance hook → propose,
      human commits. (Live evidence of the old mandatory-research rule still wired in.)

## Out of scope / notes

- **Auto-pilot stays FROZEN** (2026-06-20 supervisor decision) — used only as the thin-slice lesson, not touched here.
- Each skill removal in #6 is a governance change — show the diff, the human commits.
