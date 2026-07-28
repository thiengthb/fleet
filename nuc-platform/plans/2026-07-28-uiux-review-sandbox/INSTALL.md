# Install: `/ui-ux-review` (sandbox → live)

Everything here is **governance** (`.claude/skills/`, `.claude/rules/`, `CLAUDE.md`), so it is proposed, not
installed — per the standing rule that a human commits changes to the agent's own guardrails.

Already live (not governance, edited directly, verified):

- `nuc-platform/14-uiux-review-standard.md` — the criteria/thresholds
- `nuc-platform/07-SKILL-CANDIDATES.md` — the verdict row (what was borrowed / rejected and why)
- `sakubun/scripts/ui-audit.mjs` + `package.json` (`npm run ui:audit`) + `.gitignore` (`.ui-audit/`)
- `sakubun` devDependency `axe-core@^4.12.1` — **new dependency, flagged**: it was already in the tree but only
  transitively via `eslint-plugin-jsx-a11y`, so an eslint upgrade would have silently broken the audit. Deque's
  official engine, dev-only, never shipped to the client bundle.

## 1. Install the skill

```bash
cd /home/thien/projects/miniserver-platform
cp -r nuc-platform/plans/2026-07-28-uiux-review-sandbox/.claude/skills/ui-ux-review .claude/skills/
```

## 2. Patch `.claude/rules/frontend.md`

It already routes every `.tsx` touch to the build-time law; add the review half. Append to the
**"Also relevant here"** list:

```markdown
- Reviewing a RUNNING screen (not writing it) → skill `/ui-ux-review` + `nuc-platform/14-uiux-review-standard.md`.
  Machine pass first (`npm run ui:audit` — axe/WCAG 2.2 AA, real-Tab focus walk, target size, overflow, CLS/LCP at
  360/768/1440 + dark), then a bounded judgment pass. Rules: evidence or it's deleted · never re-find what the
  machine report already found · ≤12 findings per screen · project law beats generic best practice.
```

## 3. Patch `CLAUDE.md` (one line, in the Frontend section)

After the `/react-ui-craft` paragraph:

```markdown
**Reviewing a rendered UI is a separate job from building one** → `/ui-ux-review` (std
`nuc-platform/14-uiux-review-standard.md`): deterministic pass (axe/WCAG 2.2 AA + focus order + responsive matrix)
before any judgment pass, and project law (`docs/ui-patterns.json` → project `CLAUDE.md` → `12-ui-layout-standard`)
outranks generic taste.
```

## 4. Known gap worth a separate decision

`.claude/skills/react-ui-craft/SKILL.md` tells the agent to "read `frontend-design` first" for open-ended visual
work — **that skill is not installed on this platform**, so the instruction currently points at nothing. Either
adopt [anthropics/skills `frontend-design`](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
(its value here is the commit-to-4-tokens-before-coding step: palette / type / layout / signature element) or drop
the two references. Not fixed here because it is a separate scope.
