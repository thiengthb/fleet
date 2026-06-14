<!-- Copy a block below into log/YYYY-MM-DD.md. One file/day; multiple entries = multiple blocks. Schema: see README.md. -->

## <session/batch title> — YYYY-MM-DD

```yaml
id: YYYY-MM-DD-01
type: episodic # episodic | reflection (milestone anchor)
created: YYYY-MM-DDTHH:MM:SS+07:00
last_accessed: YYYY-MM-DD
importance: 5 # 1–10, Park poignancy at write
milestone_id: null # episodic → point UP to a reflection entry's id; reflection → its own milestone id
related_ids: [] # [{id: <id>, why: "<reason>"}]
embedding: null
```

**What happened** — 2–5 bullets, raw record (the recall content; what, not the polished why).

**Decisions made** — pointer(s) to the `decisions.md` / ledger entry each spawned (distilled upward; don't duplicate here).

**Open threads** — what's unfinished / parked / awaiting a human (so the next session resumes without re-deriving).

<!--
  For a MILESTONE: set type: reflection, give it a milestone_id, and list its child episodic entries in related_ids with
  a why each. Cross-reference the relevant plans/ file. This is the FK anchor recall walks around (Park reflection tree).
-->
