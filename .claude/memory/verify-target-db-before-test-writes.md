---
name: verify-target-db-before-test-writes
description: Before any test-signup / test-write, verify WHICH running server + database you're hitting — in local-only deploy the prod container and dev share a port, and I once polluted the prod DB
metadata:
  type: feedback
---

When deploy is **local-only** (see [[nuc-down-deploy-local-only]]), the LIVE production app runs as a
local Docker container on the SAME port a dev server would use — for sakubun that's container `sakubun`
(image `sakubun:local`, from the gitignored `docker-compose.yml`) on **`localhost:3789`**, exposed to the
internet via Cloudflare. So "a server already listening on 3789" is very likely **PROD, not a dev server**.

**Why:** I assumed a running server on 3789 was the user's dev server and ran a throwaway sign-up against
it — it was the production container, so the junk account landed in the **prod** DB (`/data/sakubun.db` in
volume `sakubun_data`). Worse, my cleanup script targeted `./dev.db` (a DIFFERENT database), so it "succeeded"
while the prod pollution stayed. The user's real users then showed one bogus "unverified" account, and I had
to delete it from the prod volume DB after the fact. A test-write to prod is the exact class of mistake
[[verify-end-state-not-upload]] warns about.

**How to apply:** Before ANY test that WRITES (sign-up, submit, seed): (1) confirm which process is
answering — `docker ps` / check the image + port — don't assume a listener is dev. (2) To test my own new
code safely, start a SEPARATE dev server on a spare port (e.g. `next dev -p 3790`) so I never touch the prod
container or its volume DB. (3) Cleanup must target the SAME database the write hit: the prod container's DB
is `/data/sakubun.db` inside the volume (reach it via `docker exec sakubun node -e ...`), NOT the repo's
`./dev.db`. (4) Prefer NOT to create real users on prod at all — let the user do the real-signup smoke test.
