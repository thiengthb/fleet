---
name: architecture
description: A decision framework for SYSTEM-level / architecture choices — frame requirements + constraints, weigh 2-3 options by trade-off, pick the simplest that works, and record the rationale in docs/decisions.md. Use when making a structural decision (data flow, service boundary, new dependency, topology). For feature-level option exploration use /brainstorming; this is the higher-altitude, "don't over-engineer" lens.
---

# Architecture Decision Framework (platform-adapted)

> "Requirements drive architecture. Trade-offs inform decisions. The rationale is recorded."

> **Adapted from** `development/architecture` (`davila7/claude-code-templates`). Its SKILL.md routed to external
> reference files; rewritten **self-contained**. **Crucial fix:** it must NOT invent an ADR/decision log — on this
> platform the rationale log is **`docs/decisions.md`** (`05-TAI-LIEU-CHUAN §5`, invariant). This skill is the
> *decision process*; `decisions.md` is the *record*.

## Core principle — simplicity is the ultimate sophistication

- **Start simple. Add complexity ONLY when proven necessary.** You can add a pattern later; removing one is much harder.
- For a continuously-growing homelab this is the main failure mode to guard against: reaching for microservices,
  queues, Postgres, k8s, event-sourcing when a modular monolith + SQLite + a cron would do. Match the solution to the
  *actual* requirement, not an imagined future one (YAGNI).

## The process

1. **Frame requirements + constraints** — what must this actually do (load, data, failure tolerance)? What are the
   platform constraints (single NUC, PULL-only deploy, shared `edge` network, Authentik for auth, Cloudflare TLS)?
2. **Generate 2-3 distinct options** (use `/brainstorming` for the divergent step) — including the boring/simple one.
3. **Trade-off each** — cost, operational burden, reversibility, team/agent familiarity. Name what each option *costs*,
   not just what it gives (apply `/honest-critique`).
4. **Pick the simplest option that meets the real requirement.** Prefer reversible decisions; defer the irreversible ones
   until you must.
5. **Record the rationale in `docs/decisions.md`** — Context · Decision · Why (+ options ruled out) · Related. That entry
   IS the ADR. Do not create a parallel ADR system.

## Relationship to other skills (avoid overlap)

| For | Use |
|-----|-----|
| Feature-level "what are my options" | `/brainstorming` (then this for the structural ones) |
| Database/ORM/schema choice | `/database-design` (+ `/prisma-expert`) |
| Recording the decided rationale | `docs/decisions.md` (via `/session-wrap`) |
| The platform's existing topology | `nuc-platform/01-KIEN-TRUC-VA-VAN-HANH.md` |

## Validation checklist

- [ ] Requirements + platform constraints stated explicitly.
- [ ] 2-3 options considered, including a simpler one.
- [ ] Each decision has a trade-off (what it costs), not just a pick.
- [ ] Chose the simplest that meets the *real* need — no speculative complexity.
- [ ] Rationale written to `docs/decisions.md` (not a separate ADR store).
- [ ] Decision respects platform invariants (PULL-only, Authentik, `.env` secrets, Cloudflare TLS).
