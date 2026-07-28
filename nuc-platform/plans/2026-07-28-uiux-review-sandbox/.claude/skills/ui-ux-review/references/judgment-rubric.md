# The judgment rubric — six questions, in order

Read this only in Phase 3, after the machine report. Each question has a **stop condition**: once it is
answered, move on. The rubric exists so the review is bounded and repeatable — not so every question
produces a finding. **"No finding" is the expected answer most of the time.** Say so in one word and
move on; manufacturing a finding to look thorough is the failure this rubric prevents.

Budget for the whole rubric, per screen: **≤12 findings**, ranked. Nothing here may repeat the machine
report.

---

## 1. Hierarchy — can a stranger name the primary action in 3 seconds?

Open the screen at 1440. Without reading carefully, ask: what is this screen for, and what is the one
thing I am supposed to do? Then check that the visual weight actually matches that answer.

- Is there exactly **one** primary (filled) button in the main content area? Two primaries = no primary.
- Does the largest/heaviest element carry the most important information, or just the most decoration?
- Is anything competing with the primary action (a colored badge, a card border, an illustration)?

**Stop when** you have named the intended primary action and said whether the design agrees.

## 2. Rhythm — is the spacing from a system or improvised?

- Do gaps come from the scale (4/8-based Tailwind steps) or are there arbitrary values?
- Do sibling cards/rows share the same padding and the same internal gaps? Scan for the one that differs.
- Is the vertical rhythm between sections consistent, or does one section float?
- Alignment: do labels, values and controls share left edges down the column?

Cross-check against `12-ui-layout-standard.md` (PageShell owns vertical rhythm) and the project's type
scale before calling any of this a defect — the frame may already dictate it.

**Stop when** you have either found a concrete inconsistency (with a selector) or confirmed the screen
draws from one vocabulary.

## 3. The five data states — are they reachable, and are they designed?

For each data view on the screen: **loading · empty · error · partial · ideal**.

- **Loading** — skeleton matching the real shape, or a bare spinner / a blank flash?
- **Empty** — does it say what would be here and offer the action that creates the first item, or is it
  a void? Does it distinguish "nothing yet" from "no matches for this filter"?
- **Error** — does it say what to do next and keep the user's input, or is it an apology / a raw message?
- **Partial** — is "more is loading" visible, and does it not shift the layout when it arrives?
- **Ideal** — does it still hold with long content (a 60-character name, 200 rows)?

You often cannot reach these states on prod without mutating data. Then **say which states you could not
observe** rather than assuming they exist — an unobserved state is an open question, not a pass. Reading
the component source to confirm a branch exists is acceptable evidence; claiming you saw it is not.

**Stop when** each of the five is marked observed / not-reachable / missing.

## 4. Microcopy — do the words do work?

- Buttons are **verbs that name the outcome** ("Lưu thay đổi", not "OK"/"Submit"), and the verb stays
  the same through the flow.
- Errors give **direction**, sit next to the thing that failed, and never show a raw stack or API body.
- The same concept has the **same name everywhere** — the biggest quiet cause of "this feels amateur".
- Labels name what the **user** controls, not the system's internals.
- Language rule: end-user copy is the product's language (vi for these apps); the `/guide` page is the
  documented exception. Dev artifacts stay English.

**Stop when** you have either quoted a specific string worth changing or confirmed the vocabulary is
consistent.

## 5. Flow friction — how many steps to the screen's one job?

- Count the actions from arrival to completing the job. Is any of them avoidable?
- Does anything ask for information the app already has (WCAG 2.2 SC 3.3.7 Redundant Entry)?
- Is anything required that could be defaulted or deferred?
- Is a destructive action confirmed — and is a non-destructive one *needlessly* confirmed?
- Is help/contact in the same place as on the other screens (SC 3.2.6 Consistent Help)?
- Any drag-only interaction with no single-pointer alternative (SC 2.5.7)?

**Stop when** you have the step count and named the one step most worth removing (or "none").

## 6. Polish — does anything read as template default?

The question that separates "works" from "designed". Look for the tells:

- A shadcn component used raw where the app has an established variant for it.
- A default border/shadow/radius that matches nothing else on the page.
- Placeholder or lorem-flavoured text, a truncation that never truncates, a tooltip that restates the label.
- Icon usage: **lucide only**, never emoji as an icon-marker, never a hand-rolled `<svg>` icon (exception:
  SVG that renders *data* — a gauge, a sparkline).
- Dark theme: does anything look like it was only designed in light?
- Motion: does it respect reduced-motion, and does any animation rescue a weak layout rather than
  enhance a finished one?

**Stop when** you can point at a specific element or say the screen is consistent.

---

## Writing the findings

Order by severity, then by how cheap the fix is. Each line:

```
- `<route>` · `<viewport>` · <what is wrong, stated as a defect not a preference>
  - evidence: <selector | screenshot path | quoted string>
  - fix: <one line — what to change, not a diff>
```

Two things that are **not** findings and must be labelled as such:

- **A taste preference** you cannot tie to a rule or a measurable outcome — say "preference" out loud.
- **A restructuring idea.** Name the defect; a rearrangement of a familiar screen is a separate
  proposal with its own approval, not a review outcome.
