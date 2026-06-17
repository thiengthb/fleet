---
rule_domain: <kebab-case domain — naming · git-commit · ui-rules · …>
applies_when: "<one line — the concrete situation that should pull this file>"
load_priority: high # high (load on first matching cue) | normal | low
---

<!--
  SKILL.md = the procedure (auto-loaded when the skill triggers).
  references/<rule_domain>.md = LAW only — declarative "if/then" rules, on-demand.

  Authoring rules:
    1. NO prose explanations. Reasoning belongs in docs/decisions.md, not here.
    2. Format: bullet `IF <condition> → <action>` OR a tight table. Nothing else.
    3. ≤ ~80 lines per file. Split further if it grows.
    4. ONE fact = ONE file. No duplication across references/.
    5. Cross-link sparingly: `↳ see: references/<other>.md#<anchor>`.

  The parent SKILL.md cites this file at the procedure step that needs it
  (e.g. "Step 2 — name the thing → read references/naming.md").
-->

# <domain> rules

## Core

- **IF** <trigger condition> **→** <required action>.
- **IF** <…> **→** <…>.
- **NEVER** <forbidden action> — <one-clause reason if not obvious>.

## Tables (when a list of mappings is clearer than bullets)

| When | Then |
|---|---|
| <case> | <action> |
| <case> | <action> |

## Edge cases

- **IF** <unusual case> **→** <override>.

## See also

- `references/<sibling>.md` — <one phrase>
- `<absolute path>` — <one phrase>
