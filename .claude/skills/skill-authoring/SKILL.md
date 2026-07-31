---
name: skill-authoring
description: How to author a new skill, adopt a community skill, or fold an idea into an existing one — on this platform, without bloating context or violating invariants. Use when creating/adding/adapting a skill in .claude/skills/, or vetting a community skill before installing it. Captures the adoption procedure + the conflict grep-guard.
---

# Skill Authoring & Adoption (platform meta-skill)

> Principles distilled from `development/skill-creation-guide` + `writing-skills` (`davila7/claude-code-templates`) +
> the adoption procedure this platform refined while vetting the community catalog (`platform/registries/skill-candidates.md`).

## First decide: author / adopt / fold

- **Fold into an existing skill** if the idea is one habit/rule that belongs to a skill we already have (it's the
  default — avoids trigger-collisions and context bloat).
- **Author a new skill** only when it's a distinct job with its own clear trigger that no existing skill owns.
- **Adopt a community skill** when it carries real net-new depth — but always *adapt* it (below), never copy raw.

## Authoring principles

- **One job per skill.** If the description needs "and", it's probably two skills.
- **Lean `SKILL.md`; depth in `references/`** (progressive disclosure) — the description + body load into context every
  session, so keep them tight. **Measured 2026-07-31: 38 skills, of which 5 are `disable-model-invocation: true` and
  cost nothing, leaving 33 in the discovery tier at ~3,450 tokens of name+description.** Every addition is a context
  tax; a manual, side-effecting skill should pay none (set the field instead of arguing for the skill's removal).
- **SKILL.md = procedure; `references/<domain>.md` = LAW.** A skill body holds the *workflow* (numbered steps + the
  `done-when` checklist); declarative rules ("if X then Y", naming tables, mandatory stack lists) go into
  `references/<domain>.md` and are read on-demand from a procedure step. Format inside a reference file is bullets
  `IF <cond> → <action>` or a tight table — **no prose**. Template: `templates/reference-rule.md`.
- **The ≥ 3 LAW rule (mandatory).** If a skill's body holds **3 or more sections that are pure declarative rules**
  (naming tables, bans, "must use X" lists, if/then policies), those sections MUST be split into `references/<domain>.md`
  files. The procedure stays in `SKILL.md` and links down at the step that uses each rule. Living examples:
  `react-ui-craft/references/{architecture,components,motion,ux,security}.md`,
  `coding-convention/references/{naming,git-commit,typescript-style,ui-rules,react-rules,backend-rules}.md`.
- **kebab-case name** = the directory name. **Narrow description** that states *when* to use it AND a boundary —
  "complements X / NOT for Y / defers Z to …" — so it doesn't fire at the wrong time or collide with a sibling skill.
- **Authoring is TDD: test the trigger.** Before finishing, read the new description against the existing skill list:
  would it fire when intended, and *not* hijack a neighbour's cases? If two skills overlap, give each an explicit
  ownership lane (e.g. `architecture` = system-level + log→decisions.md; `brainstorming` = feature-level options).
- **Fit cleanly into ONE category — the measured bar you must not fall below.** Anthropic runs *hundreds* of skills
  and the discipline that makes that work is that each one *"fit cleanly into one"* category, because ones
  *"straddling several confuse the agent"*
  ([lessons/skills](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)). fleet currently
  meets it, and here is the state to preserve, measured 2026-07-31 rather than assumed: **0 straddlers · 38/38
  descriptions carry an explicit trigger clause · highest description overlap 0.222 Jaccard**
  (`playwright-e2e-builder` ↔ `vitest-server-actions`), and every pair above 0.10 is either **intra-domain family
  resemblance** — siblings sharing their domain's vocabulary, which the nine-category discipline *produces* — or has
  a `disable-model-invocation` side that the model cannot mis-select at all.
  **Deliberately NOT a gate**, and the reason is evidence, not laziness: the throwaway checker written to measure
  this reported 4 of 38 descriptions as having no trigger clause, and reading those four showed **all four had
  one** ("Use after…", "Use specifically when…", "Use before…", "Fires the moment…") — the regex was narrow. A
  checker that reports present things as missing is the defect class this platform has already recorded three
  times, and a false finding across 38 skills would cost more than the property is at risk of losing.
- **Match platform conventions:** English; reference the living app (`todo`/`yakudoku`); respect every CLAUDE.md invariant.

## Adopting a community skill — the procedure (no-breakage gate)

1. Fetch `SKILL.md` + the dir listing via **raw.githubusercontent.com** (the GitHub API rate-limits unauthenticated; or use `gh`).
2. **If it ships scripts** (`.sh`/`.py`/`.js`): read EVERY line. Reject `curl|bash`, destructive commands, exfiltration,
   obfuscation. If a script isn't essential → **drop it, keep only the guidance.** (Don't vet what you won't ship.)
3. **Strip platform conflicts** — anything contradicting an invariant (see the grep-guard tells below). Common offenders:
   serverless/cloud assumptions, Express, a non-Prisma ORM, `tailwind.config.js`, `forwardRef`, build-on-host, Vault,
   self-coded auth/JWT, custom Docker networks/secrets.
4. **Remove dangling references** (`superpowers:*`, `./reference/*.md` files you won't vendor). Rewrite self-contained or
   point to a **live** URL rather than vendoring a file that goes stale.
5. **Re-scope the description** narrowly (boundary line) + normalize the name to kebab-case.
6. **Add an attribution line** ("Adapted from `<category>/<skill>` (`davila7/claude-code-templates`)").
7. **Run the conflict grep-guard** (below) — it must be clean. 8. Verify frontmatter. 9. Update the ledger
   `registries/skill-candidates.md` entry. 10. Commit (Conventional Commits, English).

## The conflict grep-guard (standing no-invariant-violation check)

Run over any new/edited skill; a hit means an invariant violation leaked in — fix before committing:

```bash
grep -rniE "tailwind\.config|forwardRef|React\.FC|letsencrypt|certbot|\bVault\b|docker-compose build|wrangler|vercel deploy|self-hosted runner" .claude/skills/<new-skill>
```

Keep the prohibition wording out of the literal token form too (e.g. write "compose-level build", not the hyphenated
`docker-compose build`) so the guard stays clean on automated runs.

## Done when

- [ ] Distinct job, narrow description with a boundary, kebab name, lean body (depth in `references/`).
- [ ] **≥ 3 LAW-shaped sections in the body ⇒ split into `references/<domain>.md`** (use `templates/reference-rule.md`); SKILL.md cites each reference at the procedure step that needs it.
- [ ] (If adopted) scripts read or dropped; conflicts stripped; dangling refs removed; attribution added.
- [ ] Grep-guard clean; frontmatter valid; trigger doesn't collide with an existing skill.
- [ ] Ledger updated; committed in English Conventional Commits.
