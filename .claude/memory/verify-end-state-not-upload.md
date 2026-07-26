---
name: verify-end-state-not-upload
description: Verify the USER-FACING end state (does it render/work?), never claim done from an intermediate step (upload/build succeeded)
metadata:
  node_type: memory
  type: feedback
---

During the Claude Design `.design-sync` work I repeatedly said the cards were "live / đã lên" after only confirming
the *upload + structure* succeeded — the user then saw an empty pane ("tại sao tôi chưa thấy gì hết"). The intermediate
step (files uploaded) was green, but the end state the user actually cares about (cards visibly rendering) was never
checked. I had even flagged the gap myself, then claimed success anyway.

**Why:** "Upload succeeded" / "build passed" / "tool returned ok" is NOT "it works for the user." Claiming done from a
proxy signal erodes trust and hides the real failure. The user values honest status over optimistic reporting — when a
result is unverified, SAY it's unverified rather than rounding up to "done."

**How to apply:** Before claiming anything works, verify the actual user-facing end state, not the last green
intermediate step. If I genuinely can't verify (e.g. it needs the user to look at a UI I can't see), state plainly
"uploaded/registered but NOT yet confirmed rendering — please check" instead of "it's live." Reinforces
`/verification-before-completion` + `/honest-critique`. See [[user-profile]], [[research-before-design]].

**Extension (2026-07-09, explicit user ask):** when the end state genuinely can't be driven directly, don't stop at
"unverified" — BUILD a proxy test for it ("nếu không test được hãy tạo ra cách test cho phù hợp để sau này không gặp
phải lỗi vặt"). Concrete case: sakubun's display contract depends on Claude Desktop's *model behavior* (unreachable
from here); server-side checks passed twice while the real client still misbehaved → built a model-in-the-loop eval
(subagents role-play the client, graded on pass criteria: `sakubun/eval/display-contract-eval.md`), which immediately
caught a further bug. The user prefers investing in a repeatable test harness over shipping "hope it works now".

**Extension (2026-07-23): a GREEN test I wrote is itself an intermediate proxy — it only proves what it checks, which may not be the rule.** Asked to audit invariant #9 (JA content = furigana + audio + karaoke), I checked "does it render `SpokenLine`?" and wrote a gate on that — green — and reported done; the user replied "bạn thật sự chắc chắn làm tròn trách nhiệm của mình không" because the community feed still showed NO furigana on screen. `SpokenLine` with no `ruby=` prop silently degrades, and the root cause was a layer below the render: `lib/feed.ts`/`lib/item-stats.ts` never SELECTed the ruby column, so the data never arrived. **How to apply:** (1) verify the rule's FULL intent, not a proxy for it (furigana actually visible + the query carries the data), and trace the whole path render→component→query, not just the render site; (2) before trusting a gate, PROVE it red — revert the fix (or a probe) and watch it name the real file; a gate that has never failed is not known to work; (3) key a check on the *contradiction* itself, not a stand-in like a field name, or it silently watches only some files. Green ≠ correct when the check is a proxy. Reinforces [[enforce-rules-with-gates]].

**Extension (2026-07-23, containerized apps): "committed" is an intermediate step — the end state is the REBUILT
running container.** After finishing sakubun's conversation mode I reported it "done" twice (gates green, commit
`4e1c9cc`) without rebuilding the local Docker image; the user had to ask "bạn rebuild giúp tôi chưa" — and the app he
was actually using still ran the 3-hour-old image, so his `get_protocol { mode: "conversation" }` failed. While the NUC
is down (see [[nuc-down-deploy-local-only]]) the ONLY thing that makes a change real is `docker compose up -d --build
<app>` on this machine. **How to apply:** for a containerized app, finish the loop — rebuild, then PROVE the change is
in the running image (e.g. grep the bundle inside the container / hit the health endpoint), not just that the build
exited 0. Pre-flight first: `docker logs <app> --timestamps | grep '\[mcp\]'` for a live session, and say up front if
the rebuild will bundle the user's unfinished WIP from the working tree. Pairs with [[execute-over-handoff]].

**Extension (2026-07-26): an ABSENCE-only check passes on a crashed page — an error boundary answers HTTP 200.** I
declared sakubun's new guest-viewable `/guide` verified because `curl` (no cookie) returned 200 with zero app-nav
links, zero sidebar markup and zero "Đăng xuất". Every one of those was true **of the error page** — the route was
crashing (a shared chrome component called a context hook that throws outside its provider) and had been broken for a
whole session. The moment a browser actually opened it, the failure was the first thing on screen. **How to apply:**
(1) never build a check purely out of "X is not present" — assert POSITIVE, page-specific content (a heading, the tab
labels) *plus* the absence of the error string, so the two cannot both be satisfied by a dead page; (2) treat "HTTP
200" as meaning "the server replied", never "the page works"; (3) a crash from React context, and any state applied on
mount (deep links), are invisible to static tests AND to served HTML — that class needs a real browser (Playwright),
which is also the only proof that survives when the Chrome extension is offline. Sharpens the 2026-07-23 extension
above: my own green check is the proxy to distrust first.
