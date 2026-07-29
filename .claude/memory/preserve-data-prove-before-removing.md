---
name: preserve-data-prove-before-removing
description: "Data preservation outranks tidiness: never delete on a tool's word, stage-wait-verify instead, and hand him the raw per-file numbers so he can overrule the agent"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b3e55123-14d7-4f5b-8542-6a81cf4c4eb2
  modified: 2026-07-29T21:50:08.768Z
---

**Stated by the user, 2026-07-30:** *"cần phải có một cơ chế mạnh mẽ và phải đảm bảo khách quan để những file
đưa vào diện bị xóa không bị oan uổng, bảo toàn được dữ liệu là trên hết"* — and the reason he gave: *"lỡ tool
hoặc bạn đánh giá sai rồi delete hay update lỗi sẽ làm hỏng hết thành quả chúng ta đã gây dựng."*

**Presumption of innocence. The burden of proof is on removal, never on keeping.** Nothing goes because nobody
can show it is used. It goes only when someone can show **what replaced it**, and then only after time has
failed to contradict that. "The counter says 0" is not a reason — the counter has been wrong.

**How to apply, every time removal or a destructive update is on the table:**

1. **Stage, never delete.** Move to `platform/attic/<YYYY-MM>/` with a written reason + an evidence snapshot,
   wait ≥30 days AND ≥4 sessions, re-verify, then **he** deletes. `attic.mjs` enforces this and deliberately
   has no delete subcommand. Walk the restore path backwards before trusting it.
2. **Two numbers, never one.** Recorded use AND inbound links. A single number produced two wrong deletion
   proposals on 2026-07-29 (a log tier read 93 times; 30 plans cited by 63 files).
3. **Some things may not be judged by these numbers at all** — memory (the harness injects it, invisible to
   mining), day logs (read as a tier), runbooks (earn their keep on the day they are needed). Name the
   measurement that is blind, don't just exempt the file.
4. **Batch of ≤5, never by pattern.** No glob `rm`, no "everything older than X". Each item named individually.

**Two supervision sources, and the tools are only the third.** He asked for the raw per-file metrics in a file
he can open — *"2 nguồn giám sát ... là bạn và tôi để đảm bảo tính khách quan"*. So: the tools **measure**, the
agent **interprets**, he **overrules**. Never hand him a conclusion without the numbers behind it
(`platform-report.mjs` exists for exactly this). A verdict he cannot audit is a verdict he cannot supervise —
same principle as [[legible-proposals-plain-language]], applied to data instead of prose.

**He also gates progress on verification completeness** (2026-07-30): *"cover test hết không chừa đến khi nào
hoàn thiện rồi tôi mới vô project"*. A tool without a test is not "probably fine", it is unverified — and he
will stop forward work until the gap is closed. Do not offer to move on with coverage outstanding; offer the
coverage.

**Why this is not in tension with [[practice-first-lean-ceremony]]:** he does delete his own work readily, and
over-engineering is still the enemy. The difference is the evidence bar and the reversibility, not the appetite.
Fast to build, slow to destroy. Relates to [[verify-end-state-not-upload]] and [[report-state-from-the-tool]] —
read the number from the tool at report time, and never let a tool's confidence stand in for proof.
