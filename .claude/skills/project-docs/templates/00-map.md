<!--
  TEMPLATE docs/00-map.md — AI-primer. Standard: platform/05-documentation-standard.md §4.
  Fill in the project's REAL content; delete every <!-- guidance --> line and <...> placeholder before saving.
  Goal: ≤ ~1 page, after reading it you grasp the project without opening code. Prefer tables + trees + bullets.
-->

# <project name> — Map

> One line: <what this app is, for whom>. `kind`: <web-app|monorepo|worker|infra|meta>. Deploy: <domain or "headless (no Traefik)"> · NUC `/opt/apps/<name>`.

## 1. Essence

<2–4 lines: the problem it solves · its core value · what is NOT its goal.>

## 2. Stack

| Layer | Technology |
|-----|-----------|
| Framework | <...> |
| UI | <... or "headless"> |
| Data | <...> |
| AI / external | <...> |
| Deploy | <Docker → ghcr → Watchtower → Traefik … or worker/infra specifics> |

## 3. Module map / entry points

```
<ABBREVIATED directory tree — only the important parts, each line with "what it does">
```

## 4. Main flows

<1–3 most important flows, each numbered into a few steps. Note pitfalls / trust boundaries inline if any.>

## 5. Highlights

- <the clever / non-obvious bit worth knowing: computed DYNAMICALLY instead of stored column? trust boundary server recompute? multi-image topology? …>

## 6. Invariants

- <rules that must NOT be broken when editing this project — distilled from CLAUDE.md + platform; one invariant per line.>

## 7. Secrets / env

| Variable | Used for | Located in | Build-time? |
|------|---------|-------|-------------|
| `<NAME>` | <...> | <.env NUC / GitHub Secret / Variable> | <yes/no> |

> Record variable NAMES only, NOT values.

## 8. Further reading

- Technical details: `docs/02-technical.md` <or "(none — see code)">
- Why + pitfalls: `docs/decisions.md`
- Work in flight: `docs/plans/` (status: active) <omit this line if there are no active plans>
- Infra/deploy: `INVENTORY.md §<n>` · related skill: `/<...>`
