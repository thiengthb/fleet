---
title: Token optimization — Batch 2 (the real per-session savings)
kind: refactor # internal efficiency cleanup, grounded in our own measurements — no external/novel design ⇒ not a research-gated P3
status: done
created: 2026-06-20
updated: 2026-06-20
related:
  [
    CLAUDE.md,
    PR #18 (Batch 1 — merged: P1–P3 process tiering + thin-slice-first),
    .claude/memory/direct-over-subagent-for-known-context.md,
  ]
---

> **CLOSED 2026-07-28 — two of three delivered, the third is not the agent's to do.**
>
> - **#5 JIT context** — done. `CLAUDE.md` now states the just-in-time loading path explicitly ("read on need, NOT
>   reflexively"); the mandated 3-tier read on every session entry is gone.
> - **Structural `CLAUDE.md` cut** (listed as optional) — done, and further than proposed: 254 → **200 lines**, with the
>   frontend law moved to a **path-scoped** `.claude/rules/frontend.md` (loads in full only when a UI file is touched)
>   and the NUC invariants + routing/research tables moved to their reference docs.
> - **#1 Shopify MCP** — **still open, and it is a USER action**: disconnect the connector at claude.ai. It cannot be
>   done from this repo, so holding a plan open for it only makes the plan clock lie. Surfaced to the user instead.
>
> Measured after: always-loaded context is now ~10.7K tokens/session — of which the **skill catalog is ~4.2K**, the
> largest single item and one this plan never counted. That is the next lever, not more `CLAUDE.md` trimming.


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
- [~] **#6 Skill cull — revised after measurement + the self-mod guard.**
  - **#6a (trim descriptions) DROPPED** — low ROI (~45 tok/skill/session vs the careful per-edit cost + trigger-break risk).
  - **#6b (merge 2 niche skills) — handed to the human to run.** `auto-pilot-smoke-test` → `auto-pilot/references/smoke-test.md`;
    `host-maintenance` → `host-audit/references/scheduled-maintenance.md` (de-registers the top-level skill =
    drops its ~120-tok description, content preserved as a reference). The auto-mode **self-modification guard correctly
    BLOCKED the agent** from editing `.claude/skills/**` even under verbal approval — per the contract, skill changes are a
    human move. Commands handed off 2026-06-20.
  - **`skill-proposer` KEPT** — load-bearing governance (CLAUDE.md §Autonomous "Proposer for SKILLS" + `09-autonomy-contract`
    §skill-induction = the sanctioned T2 propose-a-change for skills). Removing it to save ~120 tok would mean unpicking the
    contract — a bad trade. Not merged.
- [ ] **(optional) Structural CLAUDE.md cut** — if more byte-cut is wanted, move heavy sections (lifecycle table,
      autonomous-agent detail) to on-demand reference docs, leaving pointers. Only if #5/#6 prove insufficient.
- [x] **#7 `prior-art-check.mjs` is already P-tier-compatible — NO rewrite needed** (resolved by reading the hook
      2026-06-20). It is ADVISORY (exit 2, non-blocking — the plan write succeeds; it only nudges) and fires ONLY for
      `kind: feature|system-change` + `status: active`, exempting `fix/refactor/chore`. That maps cleanly onto the
      P-tiers: a P3 design → `kind: feature|system-change` → nudged to cite prior art (correct); P1/P2 internal work →
      `kind: refactor|chore` → silent (correct). The only real gap was documentation — **pick `kind:` by P-tier** — which
      §Thinking & process now implies. My earlier "the hook blocked the plan" was wrong: it nudged.

## Out of scope / notes

- **Auto-pilot stays FROZEN** (2026-06-20 supervisor decision) — used only as the thin-slice lesson, not touched here.
- Each skill removal in #6 is a governance change — show the diff, the human commits.
