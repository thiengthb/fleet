---
name: skill-authoring
description: How to author a new skill, adopt a community skill, or fold an idea into an existing one — on this platform, without bloating context or violating invariants. Use when creating/adding/adapting a skill in .claude/skills/, or vetting a community skill before installing it. Captures the adoption procedure + the conflict grep-guard.
---

# Skill Authoring & Adoption (platform meta-skill)

> Principles distilled from `development/skill-creation-guide` + `writing-skills` (`davila7/claude-code-templates`) +
> the adoption procedure this platform refined while vetting the community catalog (`nuc-platform/07-SKILL-CANDIDATES.md`).

## First decide: author / adopt / fold

- **Fold into an existing skill** if the idea is one habit/rule that belongs to a skill we already have (it's the
  default — avoids trigger-collisions and context bloat).
- **Author a new skill** only when it's a distinct job with its own clear trigger that no existing skill owns.
- **Adopt a community skill** when it carries real net-new depth — but always *adapt* it (below), never copy raw.

## Authoring principles

- **One job per skill.** If the description needs "and", it's probably two skills.
- **Lean `SKILL.md`; depth in `references/`** (progressive disclosure) — the description + body load into context every
  session, so keep them tight. ~28 skills already cost ~4k tokens; every addition is a context tax.
- **kebab-case name** = the directory name. **Narrow description** that states *when* to use it AND a boundary —
  "complements X / NOT for Y / defers Z to …" — so it doesn't fire at the wrong time or collide with a sibling skill.
- **Authoring is TDD: test the trigger.** Before finishing, read the new description against the existing skill list:
  would it fire when intended, and *not* hijack a neighbour's cases? If two skills overlap, give each an explicit
  ownership lane (e.g. `architecture` = system-level + log→decisions.md; `brainstorming` = feature-level options).
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
   `07-SKILL-CANDIDATES.md` entry. 10. Commit (Conventional Commits, English).

## The conflict grep-guard (standing no-invariant-violation check)

Run over any new/edited skill; a hit means an invariant violation leaked in — fix before committing:

```bash
grep -rniE "tailwind\.config|forwardRef|React\.FC|letsencrypt|certbot|\bVault\b|docker-compose build|wrangler|vercel deploy|self-hosted runner" .claude/skills/<new-skill>
```

Keep the prohibition wording out of the literal token form too (e.g. write "compose-level build", not the hyphenated
`docker-compose build`) so the guard stays clean on automated runs.

## Done when

- [ ] Distinct job, narrow description with a boundary, kebab name, lean body (depth in `references/`).
- [ ] (If adopted) scripts read or dropped; conflicts stripped; dangling refs removed; attribution added.
- [ ] Grep-guard clean; frontmatter valid; trigger doesn't collide with an existing skill.
- [ ] Ledger updated; committed in English Conventional Commits.
