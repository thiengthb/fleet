# B4b.3 fixes — sandbox proposal (human reviews + installs)

The live e2e (B4b.3, 2026-06-15) surfaced 3 fixable defects. These are the **proposed** fixes, prepared as sandbox
copies — **the agent does NOT install them** (`.claude/scripts/**` is governance; per `nuc-platform/09-autonomy-contract.md`
+ memory [[sandbox-propose-governance]] the agent proposes, a human commits — the CVE-2025-53773 lesson). Review each,
`cp` it over the live file, run the verify step, commit.

Findings + rationale: `nuc-platform/plans/2026-06-14-autonomous-agent.md` (B4b.3) · bot finding also in
`nuc-ops-bot/docs/decisions.md`.

## Verification status (what the agent already checked)

| Fix | File | Verified |
|---|---|---|
| #1 leak/auto-heal | `scripts/nuc-set-env-remote.sh` | ✅ `bash -n` + **end-to-end on a synthetic malformed `.env`**: orphan base64 line dropped + NOT listed (no leak), legit 200-char value preserved, upsert works |
| #2 (GATE)-count | `scripts/auto-pilot-run.sh` | ✅ `bash -n`; loop logic reviewed (smoke-test on install — see below) |
| #2 (GATE)-count | `scripts/auto-pilot-run.ps1` | ✅ PowerShell `Parser::ParseFile` clean; loop logic reviewed |
| #3 channel-authz | `nuc-ops-bot/guards.py` | ✅ `py_compile` |
| #3 channel-authz | `nuc-ops-bot/gate_approval.patch.md` | one-line change, documented |

---

## Fix #1 — `nuc-set-env-remote.sh` no longer leaks a value on a malformed `.env` (GOVERNANCE)

**Bug:** the "names-only" listing + auto-heal used `^[A-Za-z_][A-Za-z0-9_]*=`, which a long base64 **orphan** line
(e.g. a stray signing-key value) could match → the listing printed the VALUE (a private key leaked into the transcript;
in B4b.3 it was a DEAD key, harmless, but a live one would not be), and auto-heal kept the orphan instead of dropping it.
**Fix:** bound a valid env-key NAME to ≤64 chars (`KEYMAX`). An orphan has no short `key=` prefix → never listed,
never kept (auto-heal drops it → a corrupted `.env` self-cleans).

```bash
cp nuc-platform/plans/b4b3-fixes-sandbox/scripts/nuc-set-env-remote.sh .claude/scripts/nuc-set-env-remote.sh
# verify (no NUC needed): a synthetic malformed .env self-cleans + nothing leaks
t=$(mktemp -d); printf 'K=v\n%s=\n' "$(printf 'A%.0s' {1..120})" > "$t/e.env"
echo 'NEW=1' | NUC_RESTART=0 NUC_ENV_FILE="$t/e.env" bash .claude/scripts/nuc-set-env-remote.sh testapp
grep -cE '^[A-Za-z0-9]{65,}=' "$t/e.env"   # expect 0 (orphan dropped); listing above shows only K, NEW. rm -rf "$t"
```

## Fix #2 — auto-pilot can cross an approved gate autonomously (GOVERNANCE)

**Bug:** `count_unchecked`/`Get-UncheckedCount` exclude `(GATE)` lines, so when the only remaining work is an approved
gate (the usual case — the PR is the last step) the loop saw 0 work → "done" → never spawned the batch that crosses it.
The B4b.3 cross had to be driven by hand. **Fix:** also spawn a batch when `gate-cli check == approve`, and treat
"the approved gate got crossed (approve → consumed)" as progress (so the loop doesn't immediately call it stalled).

```bash
cp nuc-platform/plans/b4b3-fixes-sandbox/scripts/auto-pilot-run.sh  .claude/scripts/auto-pilot-run.sh
cp nuc-platform/plans/b4b3-fixes-sandbox/scripts/auto-pilot-run.ps1 .claude/scripts/auto-pilot-run.ps1
# smoke-test: dry-run still works (no gate pending → unchanged behaviour)
bash .claude/scripts/auto-pilot-run.sh --plan <any-active-plan> --dry-run
# real test: re-run a B4b.3-style park → approve → the NEXT orchestrator run now spawns the crossing batch on its own.
```

## Fix #3 — gate-approval authorizes the approval channel (OPTIONAL, bot app code — needs redeploy)

Only if you want a **dedicated** approval channel again (the live stopgap collapsed it to the ops channel, which works).
See `nuc-ops-bot/gate_approval.patch.md` in this folder for the exact one-line `_decide` change + the `guards.py` copy +
the env revert. Requires commit → push `nuc-ops-bot` main → CI → Watchtower redeploy.

---

## After installing

- Re-verify from the live locations, commit the governance files (human commits governance), then:
  `rm -rf nuc-platform/plans/b4b3-fixes-sandbox`
- Mark the relevant B4b.3 findings resolved in `nuc-platform/plans/2026-06-14-autonomous-agent.md`.
- Then B5 (real unattended window) is unblocked by fix #2.
