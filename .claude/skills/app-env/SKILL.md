---
name: app-env
description: Set an app's env vars / secrets without ever exposing the values to the agent — reads `target` from INVENTORY §0 first. On `nuc`: idempotent upsert into `/opt/apps/<app>/.env` over SSH from a LOCAL mirror. On `local`: the project's own gitignored `.env` at chmod 600. Use whenever an app needs env/secret values set, changed or rotated.
---

# Skill: set NUC app env/secrets without leaking them (app-env)

Setting env on a NUC app used to mean "SSH in, hand-edit `.env`, get the dotenv syntax exactly right" — fiddly and
error-prone. This skill makes it one command **and** keeps secrets out of the chat: values go **keyboard → a local
mirror file → ssh STDIN → the NUC `.env`**, never through a command line and never through the agent.

## Step 0 — Read the `target` FIRST (mandatory)

**Which kind of machine is this app on?** Read the project's row in `platform/inventory.md §0`. It is **DATA — read
it, never assume.** The full law per target is in `platform/targets/<target>/README.md`.

| `target` | What this skill does |
|---|---|
| `nuc` | The procedure below. 🔴 **Check `INVENTORY` §NUC STATUS first** — the host has been down since 2026-07-22, so a `git push` deploys nothing. |
| `local` | No SSH. Values go into the project's own `.env` (chmod 600, gitignored) on this machine. **The hard rule is unchanged: the agent never receives the values** — direct the user to the file. |
| `cloud` | **Not defined yet.** Read `platform/targets/cloud/README.md`, propose the procedure, and get it approved — do not improvise one. No project uses this target today. |
| `none` | This skill does not apply. |

> Unless a section says otherwise, **everything below this line is the `nuc` branch.** This skill was written
> NUC-first and renamed on 2026-07-28; the `local` column is the honest summary, not a second full procedure.

## The hard rule for the agent (security — non-negotiable)

**NEVER ask the user to paste a secret value (token, key, password, PAT) into the chat.** A secret in the transcript =
compromised (cache/logs) and must be rotated. When an app needs env set:

1. Tell the user to put the values in their **local mirror file** `~/.nuc-env/<app>.env` (one `KEY=VALUE` per line).
2. Tell them to run **`app-env.ps1 <app>`** (or `.sh`).
3. The agent only ever discusses / records **key NAMES**, never values.

This mirrors the platform invariant "secrets only in `.env`, never in code/transcript" and the bot's "LLM suggests,
code re-validates" trust split: the secret path never crosses the model.

## How the user runs it

```
# one-time per app: create the mirror (stays on THIS machine, outside any repo)
mkdir ~/.nuc-env ; notepad ~/.nuc-env/<app>.env      # KEY=VALUE lines, e.g. GATES_REPO=owner/repo
# then, any time values change:
.claude/scripts/app-env.ps1 <app>                # Windows
.claude/scripts/app-env.sh  <app>                # Git Bash / Linux
#   flags: -NoRestart / --no-restart  ·  -NucHost / $NUC_HOST  ·  -EnvDir / $NUC_ENV_DIR
```

It SSHes to `thien25@thienminiserver`, merges the mirror into `/opt/apps/<app>/.env`, and (unless `--no-restart`)
`docker compose up -d --force-recreate`s the app so the new env takes effect. It prints the resulting **key names**
(never values).

## What the merge guarantees (see `app-env-remote.sh`)

- **Idempotent upsert** — a key already in `.env` is replaced *in place*; a new key is appended; all other lines
  (comments, untouched keys) are preserved. Re-running the same mirror changes nothing.
- **Atomic + safe** — writes a temp file then `mv` (no half-written `.env`); keeps one `.env.bak`; restores **chmod 600**.
- **Secret-safe transport** — the snippet travels via ssh **STDIN** (never argv → invisible to `ps`/history); only the
  non-secret merge script rides the command line (base64'd, LF-normalized so the NUC's bash never sees a CR).
- **Names-only output** — confirms which keys are set; never echoes a value.

## After setting env — keep INVENTORY honest (anti-drift)

If you added a **new** env KEY an app depends on, record the key **NAME** (never the value) in that app's row /
secrets note in `inventory.md` (and `registries/known-traps`/`auth-apps.md` if relevant). The single source of truth must list
what an app expects; the value lives only in the NUC `.env`.

## Boundaries

- The agent does NOT run this (it has no business holding the values); the **user** runs it locally. If a flow needs
  env set, the agent stops and points here.
- Targets `/opt/apps/<app>/.env` only; `<app>` is validated `^[a-z0-9][a-z0-9-]*$` (no path traversal). The app must
  already be deployed (its `.env` must exist).
- Pairs with `/coding-convention` (secrets invariant) and the deploy chain (after env change, force-recreate applies it;
  a code change still goes through git push → CI → Watchtower as usual).
