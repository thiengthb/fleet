---
name: design-for-generality
description: "Build features parameterized by settings + adaptive from the user's data, never hardcoded to their current case (e.g. N3); keep logic multi-user-ready"
metadata:
  type: feedback
---

When building a feature the user wants it GENERALIZED, not fitted to his current situation. Stated for
sakubun's learning engine (2026-07-11): "không thể có một mẫu số chung là N3 — phải dựa vào setting và
dựa vào kiến thức trong câu trả lời mà đưa ra hướng đi phù hợp… kể cả sau này tôi thiết kế cho nhiều
người học nữa."

**Why:** he plans to grow the app (more levels, eventually multiple learners), so a hardcoded constant or
a single-user assumption becomes debt fast. He reasons at the level of the mechanism, not his own case —
so a design that only works "for N3 right now" reads as wrong to him even if it'd pass today.

**How to apply:** derive behavior from `settings` (target level, knobs) — no level/threshold constant baked
into code. Make it adaptive from the user's actual data (what they demonstrate in answers), not a fixed
path. Keep the LOGIC multi-user-ready (parameterize so a future per-user settings source drops in) WITHOUT
building auth/multi-user infra now (respect the local-only invariant — that's a separate, deliberate step).
Applies to any feature, not just sakubun. Related: [[extend-dont-rebuild]], [[practice-first-lean-ceremony]].
