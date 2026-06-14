---
name: brainstorming
description: Explore the solution space before committing to a build — frame the real problem, generate 2-3 genuinely distinct approaches with tradeoffs, recommend one with reasoning, validate incrementally. Use at the start of a non-trivial feature/design/refactor, or when the user says "let's brainstorm", "what are my options", "how should I approach X". Diverge here; converge into /project-plan.
---

# Skill: Brainstorming (diverge before you converge)

The thinking step *before* planning. Its job is to widen the option space and pick a direction deliberately — not to
jump to the first idea (usually the user's stated solution) and start coding. Output feeds `/project-plan`: brainstorming
**explores**, project-plan **commits the roadmap**.

## Process

1. **Frame the real problem in one sentence — and confirm it.** Users often state a *solution* ("add a Redis cache")
   when the real goal is different ("the dashboard feels slow"). Restate the underlying goal and check you've got it
   right before generating options. The wrong problem framing wastes the whole session.
2. **Generate 2-3 genuinely distinct approaches** — not three flavors of one idea. For each, give: the core idea (1-2
   lines), its main tradeoff, and what it's good/bad for. Include the cheap/boring option (often the right one).
3. **Lead with a recommendation + reasoning, and FLAG it.** Don't dump options and make the user choose blind. Mark the
   one you'd pick with **`(khuyến nghị)`** (in chat AND in any options table) + one plain-language sentence on *why* —
   then apply `/honest-critique`: name the downside of your own pick, separate fact from preference. The user must see
   your pick at a glance, not infer it from prose.
4. **Resolve unknowns one at a time, highest-leverage first.** When you need a decision, ask the *one* question that
   most changes the answer — don't bury the user under a wall of questions. (Batch genuinely independent choices via
   AskUserQuestion; sequence dependent ones.)
5. **Be YAGNI-ruthless.** Cut speculative scope. Push for the smallest thing that delivers the value; extension can come
   later. "We might need…" is not a reason to build it now.
6. **Validate incrementally.** Confirm the direction in chunks as it firms up — don't design the entire thing in one
   monologue and ask for approval only at the end.

## Hand-off

When the direction is settled and the work is substantial / multi-session → **`/project-plan`** to persist the roadmap
in `docs/plans/`. If it's a small same-session change, skip the file and just do it (plan mode is enough).

## Anti-patterns

- Skipping straight to code on the first idea.
- Presenting 6-7 options → decision paralysis. Two or three real choices beat a menu.
- Presenting a recommendation as if it were neutral — own the pick and its cost.
- Presenting options without the `(khuyến nghị)` flag, forcing the user to reverse-engineer your pick from the prose.
- Explaining the options in dense jargon — lead in plain everyday language (what it means / what happens next), jargon as an aside.
- Treating the user's first framing as fixed when it's actually a solution in disguise.
