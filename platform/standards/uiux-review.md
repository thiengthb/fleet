# 14 — UI/UX review standard (the platform's definition of "good enough to ship")

> **This file is DATA: the criteria and thresholds.** The procedure that applies them is the skill
> `/ui-ux-review`. Build-time craft (how to write the component) stays in `/react-ui-craft` +
> `.claude/rules/frontend.md`; the page frame stays in `standards/ui-layout.md`; what the user had to
> repeat stays in `<project>/docs/ui-patterns.json`. **This file only answers: how do we check a rendered
> screen, against what numbers, and what counts as a defect.**

## 0. Why this exists

Until 2026-07-28 the platform had a complete build-time UI standard and **nothing that ever rendered a
page and looked at it**. Every UI claim was "the code follows the rules", never "the running screen is
good". The first run of the machine pass against shipped `sakubun` pages found a 3.74:1 contrast ratio on
the **primary button** — a design-token defect present on every screen in the app, invisible to every gate
we had, because no gate had eyes.

## 1. The two-layer split — the load-bearing decision

A model given a screenshot and told "review this UI" produces plausible, unfalsifiable, endlessly long
output. A script produces short, checkable, boring output. So the two are given **disjoint** jobs:

| | Machine pass (`scripts/ui-audit.mjs`) | Judgment pass (model + Claude-in-Chrome) |
|---|---|---|
| Decides | WCAG rules, contrast, target size, focus visibility + order, overflow, console errors, heading structure, CLS/LCP | hierarchy, rhythm, the five data states, microcopy, flow friction, polish |
| Output | `report.md` + `report.json` + screenshots | ≤12 ranked findings, each with evidence |
| Repeatable | yes, byte-for-byte | no |
| Runs | always, first | only after reading the machine report |

**axe-core resolves ~57% of real accessibility issues by volume** ([Deque, 13k pages / 300k
issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/)).
That is the free floor and the reason the machine pass is never skipped. The remaining ~43% is precisely
the judgment pass's territory — it is not a nice-to-have, and it is not a licence to freestyle.

**The rule that makes the split work: the judgment pass may not re-report anything in `report.md`.**
Re-finding the obvious is how a review becomes noise.

## 2. Thresholds — the numbers a finding is measured against

### Accessibility — WCAG 2.2 Level AA (the target, not 2.1)

Automated by the machine pass:

| Criterion | Threshold |
|---|---|
| 1.4.3 Contrast (Minimum) | **4.5:1** body text · **3:1** large text (≥18.66px bold / ≥24px) and UI boundaries |
| 1.4.11 Non-text Contrast | 3:1 for control boundaries, focus rings, meaningful graphics |
| 2.4.3 Focus Order | Tab order follows meaning; no control wedged between a form's fields |
| 2.4.7 Focus Visible | Every tab stop changes visibly. **Verified with real `Tab` presses** — see §5 |
| 2.4.11 Focus Not Obscured (Min) | *new in 2.2, AA* — focused control not hidden behind sticky header / banner / chat bubble |
| 2.5.8 Target Size (Minimum) | *new in 2.2, AA* — **24×24 CSS px**, or ≥24px clear spacing |
| 3.1.1 Language of Page | `<html lang>` present |

Manual (judgment pass), because no engine decides them:

| Criterion | What to check |
|---|---|
| 2.5.7 Dragging Movements | *new in 2.2, AA* — any drag has a single-pointer alternative |
| 3.2.6 Consistent Help | *new in 2.2, A* — help/contact sits in the same place on every page |
| 3.3.7 Redundant Entry | *new in 2.2, A* — the app never asks twice for what it already has |
| 3.3.8 Accessible Authentication (Min) | *new in 2.2, AA* — no cognitive test (puzzle, transcription) with no alternative; paste into password fields is allowed |
| 1.3.2 Meaningful Sequence | reading order matches visual order |

The six new-in-2.2 criteria are listed because 2.2 is the current recommendation and four of them are
things this platform's apps actually do (steppers, sticky headers, login flows).

### Performance — Core Web Vitals

`good` at the 75th percentile of real users: **LCP < 2.5s · INP < 200ms · CLS < 0.1**.

Two honesty rules: the machine pass measures **LCP and CLS in a lab on localhost**, which is optimistic —
treat a lab LCP over 2.5s as serious, and a passing lab LCP as *not yet evidence*. **INP is not measured
and never faked** — it needs real interaction; if responsiveness is in question, that is a judgment-pass
observation ("the button takes a beat"), not a number.

### Responsive matrix — four passes, not a device farm

`360×740` (small phone — the platform floor is 360px) · `768×1024` (tablet portrait) · `1440×900`
(desktop) · `1440×900 dark`. The dark pass exists because CSS-var theming is mandatory here and contrast
regressions hide in the dark theme. Anything below 768px treats overflow and target-size as **High**.

### Interaction heuristics — the judgment rubric

Nielsen's 10 heuristics, narrowed to the six that actually catch defects in this platform's apps:

1. **Visibility of system status** — every action reacts in ~100ms; pending/optimistic state is shown.
2. **Match to the real world** — vocabulary names what the *user* controls, not the system's internals.
3. **User control** — destructive actions confirm; anything long-running can be left.
4. **Consistency** — the same concept looks and is named the same on every surface.
5. **Error prevention & recovery** — errors say what to do next, keep the user's input, and sit next to the thing that failed.
6. **Recognition over recall** — the screen shows what is needed; nothing has to be remembered from the previous screen.

**The five data states** every data view must actually reach: loading · empty · error · partial · ideal.
A screen that only renders the happy path is unfinished (detail: `/react-ui-craft` `references/ux.md`).

## 3. Severity — the only four labels

| Label | Meaning | Gate |
|---|---|---|
| **Blocker** | keyboard/screen-reader cannot complete the task · page errors · data loss risk | machine pass exits 1; do not ship |
| **High** | WCAG AA violation · broken at a supported width · console error · CLS > 0.1 | fix in this change |
| **Medium** | degrades the experience but the task completes | fix or log with an owner |
| **Nitpick** | taste, polish, micro-copy | optional, never blocks |

Adopted from the widely-used design-review taxonomy
([OneRedOak/claude-code-workflows](https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review))
because a shared vocabulary is worth more than a bespoke one.

## 4. The four rules that keep a review from rambling

These are the point of the standard. A review that breaks them is not a stricter review, it is a worse one.

1. **Evidence rule.** Every finding carries **route + viewport + a selector or a screenshot**. A finding
   you cannot point at is deleted, not softened.
2. **No re-finding.** The machine report is read first and is off-limits. The judgment pass earns its
   tokens only on what a script cannot see.
3. **Budget: ≤12 findings per screen** in the judgment pass. More than that means describing, not
   reviewing — rank and cut. Blockers are never cut.
4. **Project law outranks generic best practice.** A rule in `docs/ui-patterns.json`,
   `standards/ui-layout.md`, or the project's `CLAUDE.md` **wins** over anything in this file or in a
   blog post. If a generic rule and a locked project rule genuinely conflict, that is a finding *about
   the rule* — raise it, do not silently apply the generic one.

Rule 4 is why this standard is not "some UX advice": the review is bound to *this platform's* definition
of correct. A reviewer who cites Stripe at a project that locked the opposite pattern is wrong.

## 5. Two traps already paid for

- **Never call `el.focus()` from a page script to test focus visibility.** Chromium matches
  `:focus-visible` only when focus came from the keyboard, so every shadcn/Radix control looks
  ring-less and you get a false Blocker. Drive **real `Tab` presses**. (Cost: one wrong Blocker on
  `sakubun /guide`, caught before the skill shipped.) The real walk pays for itself — it produced the
  true tab order, which is how the `/login` "Quên mật khẩu?"-between-fields defect was found.
- **Do not report what axe already reports.** axe 4.12 has its own `target-size` rule under `wcag22aa`;
  a second home-grown probe firing beside it is duplicate noise. Supplemental probes report only what
  the engine let through.
- **Wait for the URL to leave `/login`, not for `networkidle`.** These apps sign in through a client
  handler and redirect after it resolves, so the network goes idle while the page is still `/login` —
  checking then reports a failed login that actually succeeded.
- **`focus-obscured` needs a settle delay, and it lies twice without one.** Measured on `sakubun
  /settings` at 360px: **14** hits with no delay, **2** at 150ms, still 2 at 400ms — 12 of the 14 were
  the *previous* tab stop's tooltip caught mid-exit-animation, not an obstruction. The script now
  re-probes after 220ms and only records a hit that survives. Of the 2 survivors, both turned out to be
  `nextjs-portal`, the **dev-server overlay**, which does not exist in a production build — so the real
  count was **zero**. Two lessons: an `elementFromPoint` check on an animated UI must settle before it
  is believed, and a dev server injects furniture the audit must ignore (prefer auditing a production
  build; the script filters `nextjs-portal` explicitly).
- **A count that collapses under scrutiny is the normal case, not the exception.** 122 authed findings
  reduced to 7 distinct defects; 14 focus obstructions reduced to 0. Always report distinct causes with
  their route span, never the raw finding count — the raw number reads as severity and is mostly
  repetition.

## 6. When it runs (P-tier mapping — matched to `CLAUDE.md` §Thinking)

| Change | Review |
|---|---|
| **P1** — copy tweak, one-line fix | nothing |
| **P2** — a component, a small feature | **machine pass** on the affected routes; fix Blocker + High |
| **P3** — a new screen, a redesign, a new flow | **full review**: machine + law + judgment |
| Before a UI commit | machine pass + `/ui-pattern-lock check` |

## 7. Rollout status — the skill is installed, the routing is NOT

`/ui-ux-review` lives at `.claude/skills/ui-ux-review/` (installed 2026-07-28). Two pointers are still
missing, and until they land the skill fires **only when asked for by name** — which is most of the value
gone, since the whole point is that touching a UI file routes you here.

Both are governance, so a human applies and commits them.

**① Append to the "Also relevant here" list in `.claude/rules/frontend.md`:**

```markdown
- Reviewing a RUNNING screen (not writing it) → skill `/ui-ux-review` + `platform/standards/uiux-review.md`.
  Machine pass first (`npm run ui:audit` — axe/WCAG 2.2 AA, real-Tab focus walk, target size, overflow, CLS/LCP at
  360/768/1440 + dark), then a bounded judgment pass. Rules: evidence or it's deleted · never re-find what the
  machine report already found · ≤12 findings per screen · project law beats generic best practice.
```

**② Add after the `/react-ui-craft` paragraph in `CLAUDE.md`:**

```markdown
**Reviewing a rendered UI is a separate job from building one** → `/ui-ux-review` (std
`platform/standards/uiux-review.md`): deterministic pass (axe/WCAG 2.2 AA + focus order + responsive matrix)
before any judgment pass, and project law (`docs/ui-patterns.json` → project `CLAUDE.md` → `standards/ui-layout`)
outranks generic taste.
```

**③ Open decision — a dangling skill reference.** `.claude/skills/react-ui-craft/SKILL.md` tells the agent to
"read `frontend-design` first" for open-ended visual work, but that skill **is not installed here**, so the
instruction points at nothing. Either adopt
[anthropics/skills `frontend-design`](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
— its value here is the commit-to-four-tokens-before-coding step (palette / type / layout / signature element)
— or delete the two references. Not decided.

**Also open (from the first real run, on `sakubun`):** `Switch` (20px) and `Checkbox` (16px) are shadcn
primitives under the 24px target floor, and growing them changes every form in the app; and no page has an
`<h1>`, which follows from `standards/ui-layout` replacing page titles with breadcrumbs — if the breadcrumb
*is* the heading, something still has to say so to a screen reader. Both are design calls, not defects.

## 8. Sources

- [Deque — automated testing identifies 57% of accessibility issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/)
- [W3C — What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) · [TetraLogical summary](https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2/)
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals) (LCP 2.5s · INP 200ms · CLS 0.1 at p75)
- [NN/g — 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [OneRedOak — design-review agent](https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review) (phase list + triage taxonomy)
- [anthropics/skills — webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) (drive-a-local-app pattern) · [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) (self-critique loop)
- [Playwright — aria snapshots](https://playwright.dev/docs/aria-snapshots) · [axe-core](https://github.com/dequelabs/axe-core)
