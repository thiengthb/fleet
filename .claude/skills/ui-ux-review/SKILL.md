---
name: ui-ux-review
description: Review a RUNNING UI in the browser against the platform's UI/UX standard — a deterministic machine pass (axe/WCAG 2.2 AA, contrast, focus order, target size, responsive matrix, CLS/LCP) followed by a bounded judgment pass in Claude-in-Chrome. Use before shipping a new screen or flow, when the user asks "review the UI / is this good / check UX / kiểm tra giao diện", or after a redesign. NOT for writing UI code (that is /react-ui-craft) and NOT for functional E2E (that is /playwright-e2e-builder).
---

# Skill: review a running UI (ui-ux-review)

Criteria + thresholds live in **`platform/standards/uiux-review.md`** — read it once per review,
it is short. This file is the procedure. The point of both is that a UI review is **evidence, not
opinion**: `/react-ui-craft` checks the code, this checks the *rendered screen*.

**Do not skip Phase 1 and go straight to looking at screenshots.** That is the failure mode this skill
exists to prevent: a model given a screenshot re-finds the obvious, misses the measurable, and writes
three pages about spacing.

---

## Phase 0 — Scope contract (one short block, always written out)

State, before opening anything:

- **Routes under review** — an explicit list. "The whole app" is not a scope; ask for routes or derive
  them from the diff (`git diff --name-only` → the `app/**/page.tsx` touched).
- **Each screen's one job**, one sentence each. A review with no stated job cannot rank findings.
- **Which base URL**, and whether it is prod. `sakubun`: `:3789` is the **prod container**, `:3799` is
  the e2e server, `:3798` is the MCP lab. The machine pass is read-only so prod is safe; anything that
  submits a form is not — use the e2e harness.
- **P-tier** (§6 of the standard): P1 → stop here, no review. P2 → Phase 1 only. P3 → all phases.

## Phase 1 — Machine pass (always first, never skipped)

```bash
node scripts/ui-audit.mjs --base http://localhost:3789 --routes /,/login,/guide --out .ui-audit
```

Read `.ui-audit/report.md` in full. It is the **agenda**: Blocker/High/Medium counts, the per-route
pass table, and the desktop **tab order** (data for Phase 3, not a finding). Exit code 1 = a Blocker
exists.

**Public routes are not the app.** Most screens sit behind auth, and a fresh account renders every one
of them in its **empty state** — the least-reviewed state there is. Audit them with `--login`:

```bash
UI_AUDIT_ALLOW_WRITE_BASE=http://localhost:3799 \
UI_AUDIT_EMAIL=... UI_AUDIT_PASSWORD=... \
  node scripts/ui-audit.mjs --base http://localhost:3799 --login --routes /items,/settings,/account
```

Logging in **writes a session row**, so it is gated: the script refuses unless the base URL is declared
twice — once in `--base`, once in `UI_AUDIT_ALLOW_WRITE_BASE`. You cannot fat-finger it into prod, and
no port is hardcoded, so the guard travels to any project. Credentials come from the env, never argv.
Point it at a throwaway server (`sakubun`: `:3799`, seeded by `e2e/global-setup.ts` + an HTTP sign-up).

If the project has no `scripts/ui-audit.mjs`, copy it from `projects/sakubun/scripts/ui-audit.mjs` — it is
project-agnostic apart from `DEFAULT_ROUTES`. It needs `@playwright/test` + `axe-core`.

**Read the report by distinct check, not by count.** 122 findings across 10 routes collapsed to **7
real defects**, three of them one systemic token bug repeated on every page. Reporting 122 is noise;
reporting 7 with "on all 10 routes" is the finding.

**A finding in this report is closed to Phase 3.** Do not re-describe it, do not "confirm" it visually.

## Phase 2 — Law pass (project rules beat generic taste)

Reconcile the report against **this project's** law, in this order — the first that speaks, wins:

1. `<project>/docs/ui-patterns.json` — what the user already had to repeat. Highest authority.
2. `<project>/CLAUDE.md` invariants — e.g. `sakubun` #8 page frame, #11 type scale, #12 truncation, #6 no emoji.
3. `platform/standards/ui-layout.md` — PageShell, breadcrumbs-replace-titles, sidebar footer.
4. `.claude/rules/frontend.md` — shadcn only · CSS-var theming · sonner · lucide only · no emoji as icon.
5. `platform/standards/uiux-review.md` — the generic floor. Lowest authority.

Two outcomes to write down explicitly:

- **A machine finding that a project rule sanctions** — e.g. "page has no `<h1>`" on a platform where
  breadcrumbs deliberately replace page titles. Do not silently drop it: state the rule, then say
  whether the rule has a **gap** (here: if the breadcrumb replaces the title, something still has to be
  the accessible page heading). A sanctioned defect is a finding *about the standard*.
- **A generic best practice that contradicts a locked pattern** — the locked pattern wins, and citing
  the generic one anyway is a review defect. Raise the conflict separately if it is real.

If the user corrects a UI preference at any point during the review: **STOP and run `/ui-pattern-lock`
first**, then resume. That rule outranks finishing this review.

## Phase 3 — Judgment pass (Claude-in-Chrome, bounded)

Only now open the browser, and only for what a script cannot see. Load the Chrome tools in **one**
`ToolSearch` call, then `tabs_context_mcp` before creating a tab:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__read_console_messages
```

Per screen, walk `references/judgment-rubric.md` — six questions, in order, each with a stop condition.
Use `resize_window` for the 360 / 768 / 1440 widths rather than trusting the static screenshots.

**Never trigger a dialog** (`alert`/`confirm`) — it freezes the extension. Do not click destructive
controls. On prod, do not submit forms.

### If the Chrome extension is not connected

`tabs_context_mcp` returns "Browser extension is not connected". **Do not retry it more than once.**
Diagnose instead of looping — three distinct calls, then stop:

1. `list_connected_browsers` → `[]` means no extension instance is reaching the relay at all.
2. `switch_browser` → "No other browsers available" confirms it; this call broadcasts to *every* open
   Chrome, so a failure here rules out an account/profile mismatch rather than a missing connection.
3. Then check the machine, because "I reopened Chrome" usually is not true:
   `ps -eo pid,lstart,etime,cmd | grep "/opt/google/chrome/chrome "`. On Linux, closing every window
   leaves the process alive, so reopening attaches to the old one and a newly installed or updated
   extension never initializes. An `etime` of hours means it was never restarted. The fix that keeps
   the user's tabs is `chrome://restart` typed in the address bar — never kill their browser yourself.
   Extension presence is checkable too: it lives at
   `~/.config/google-chrome/<profile>/Extensions/fcoeoabgfenejglbffodgkkbkcdhcgfn`, and
   `extensions.settings.<id>` in that profile's `Preferences` carries its version and disable reasons.
   Installed, enabled and up-to-date still does not mean *connected*.


Fall back to the machine pass's full-page screenshots (`.ui-audit/shots/*.png`) — read them directly;
they cover all four passes. Then say plainly, in the report, what the fallback cost you:

- no hover / focus / active states, no open menus or dialogs
- no live resizing (you get the four captured widths, nothing between)
- no console reading beyond what the machine pass already logged
- **no interaction**, so the loading / error / partial states stay unobserved

That last one matters most: without the browser you cannot reach three of the five data states, so mark
them *not observed* (Phase 3 question 3) rather than passing them. A screenshot review is a real review
with a stated ceiling — not a substitute you quietly pretend is the same thing.

## Phase 4 — Report

```markdown
## UI/UX review — <routes> @ <base>
<one sentence: does this ship or not, and why>

### Blocker (n)
- `<route>` · `<viewport>` · <what is broken> — evidence: <selector | screenshot>
  - fix: <one line>
...
### High / Medium / Nitpick
### Sanctioned by project law (not defects)
### Conflicts worth a decision
```

Open with what genuinely works (one line, not flattery). Then the four severity groups. **Every finding
carries route + viewport + selector-or-screenshot, and a one-line fix.**

---

## The four hard rules (from the standard §4 — these are the skill's spine)

1. **Evidence rule** — no route+viewport+pointer, no finding. Delete it, don't soften it.
2. **No re-finding** — anything in `report.md` is closed.
3. **≤12 findings** in the judgment pass per screen. Over budget means describing, not reviewing: rank
   and cut. Blockers are never cut.
4. **Project law outranks generic best practice** (Phase 2 order).

Plus two that come from how this user works:

5. **Name defects, do not redesign.** A review says "this control is 8×8px", never "move the stepper to
   the sidebar". Restructuring a familiar screen reads as loss, not progress — a rearrangement proposal
   is a separate conversation with its own gate.
6. **Recommend, don't rewrite.** One-line fix per finding. Applying fixes is a follow-up the user
   approves; `/react-ui-craft` + `/coding-convention` own the edit itself.

## Wiring it into a project (once)

- Copy `scripts/ui-audit.mjs`; add `"ui:audit": "node scripts/ui-audit.mjs"` to `package.json`.
- Set `DEFAULT_ROUTES` to the project's real public routes.
- Add `.ui-audit/` to `.gitignore` (screenshots + report are build output, not source).
- Gate: the script exits 1 on a Blocker, so it can join the pre-commit chain after `npm test`.

## What this skill is NOT

Writing/refactoring UI code → `/react-ui-craft`. Naming, commits, Prettier → `/coding-convention`.
React perf (waterfalls, bundle, re-renders) → `/react-best-practices`. Functional user-journey tests →
`/playwright-e2e-builder`. Locking a repeated preference → `/ui-pattern-lock`. Page frame →
`platform/standards/ui-layout.md`.
