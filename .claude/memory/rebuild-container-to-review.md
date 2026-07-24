---
name: rebuild-container-to-review
description: After finishing app-visible edits, rebuild + restart the local Docker container so the user can review the running result
metadata:
  type: feedback
---

After finishing a set of edits that change what an app RENDERS or DOES (UI, behavior, routes), rebuild
and restart that project's LOCAL Docker container so the user can immediately see the latest changes
running — don't stop at "gates pass / committed". Stated as a standing rule on 2026-07-24 (sakubun):
"luôn rebuild container để tôi xem những phần chỉnh sửa mới nhất".

**Why:** The NUC is down and there's no VPS, so deploy is local-only ([[nuc-down-deploy-local-only]]) —
the running local container (often behind a local cloudflared tunnel to the real domain) IS how the user
reviews work. A diff or a green test suite isn't the thing he looks at; the live app is. This is the
container-flavoured version of [[execute-over-handoff]] and [[preview-visual-changes-before-commit]].

**How to apply:**
- Batch ALL edits first, THEN rebuild once — Docker snapshots the build context at start, so a mid-edit
  build ships stale files (sakubun `docs/00-map.md` note).
- Before recreating, check the container isn't mid-session (e.g. `docker logs <name> --since 5m` for
  recent `[mcp]`/request activity) so you don't cut a live session.
- Rebuild the app service only: `docker compose up -d --build <service>` (leave sidecars like voicevox /
  cloudflared running). Local app image is built locally (`build: .`), NOT pulled — this is the one
  place local build is correct (the NUC-only-pulls invariant is about the NUC, not the dev machine).
- Verify end state, not the build log ([[verify-end-state-not-upload]]): container `healthy` + key
  routes return 200 + no errors in fresh logs. Then tell the user the URL/port.
- Skip the rebuild for pure doc/memory/plan edits (nothing app-visible changed).
