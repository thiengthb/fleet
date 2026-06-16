# ask_answer.py — DRAFT for nuc-ops-bot (plan 2026-06-16, Phase 3 / D2). Sibling of gate_approval.py.
#
# PROPOSE-DON'T-INSTALL: this file is NOT in the bot repo (nuc-ops-bot is not on this machine). It is a faithful
# TEMPLATE the human adapts into nuc-ops-bot and tests on deploy — exactly like gate_approval.py was (B4a.3). The
# JS counterpart (gate-answer.mjs + ask-cli.mjs) is fully tested (26/26); this side is verified live on deploy.
#
# What it adds: the free-form Q&A half of the control plane.
#   - poll_asks():   tasks.loop over the gates repo `asks/` dir; post each new free-form question to the approval
#                    channel as a THREAD, remember {ask_id -> thread_id} so a later reply can be matched.
#   - on_answer():   an on_message handler — when an ALLOWED user replies in a pending ask-thread, sign an ANSWER
#                    token (RS256, REUSING gate_approval's existing signer; only the payload shape differs) and write
#                    answers/<ask_id>.json, then delete asks/<ask_id>.json. The worker's ask-cli verifies + reads it.
#   - poll_reports(): post each outbound digest from `reports/` to the channel (NO signing — info only), then delete.
#
# SECURITY (mirrors the approve/deny buttons):
#   - Authorize the replier with the SAME guards.user_allowed(...) gate_approval uses (server-side allowlist + the
#     approval channel) — never trust the message author blindly.
#   - The answer text is signed for AUTHENTICITY only. The worker treats it as DATA, never a command (ask-cli docs).
#   - Reuse gate_approval's RS256 sign_token(payload) so the bytes match gate-answer.mjs exactly: the signature is over
#     the ASCII of the base64url(JSON payload), base64url WITHOUT '=' padding, RSA PKCS#1 v1.5 + SHA-256.
#   - Single-use jti + 15-min exp, same as approvals (shared consumed-jti store on the worker side).

from __future__ import annotations

import json
import time
import uuid

import discord
from discord.ext import tasks

# --- INTEGRATION POINTS (wire these to nuc-ops-bot's actual modules — names match gate_approval.py) ---
# from gate_approval import sign_token            # REUSE: payload(dict) -> "<b64url(json)>.<b64url(sig)>" (no '=' pad)
# from guards import user_allowed                 # REUSE: (user_id, channel_id) -> bool  (server-side allowlist)
# from gates_repo import list_dir, read_json, write_file, delete_file   # the same GitHub Contents API client used for requests/gates
# APPROVAL_CHANNEL_ID, ANSWER_TTL_SECONDS = ...   # from config/.env (ANSWER_TTL_SECONDS default 900)

ANSWER_TTL_SECONDS = 900  # 15 min, same window as an approval token

# ask_id -> discord thread id, so an incoming reply can be matched back to the pending question. In-RAM is fine: if the
# bot restarts, poll_asks() simply re-posts unanswered asks (the asks/ file persists in the repo until answered).
_pending: dict[str, int] = {}


def _answer_payload(ask_id: str, answer: str) -> dict:
    now = int(time.time())
    return {
        "kind": "answer",          # disjoint from approval tokens (which carry decision/gate_id, no kind)
        "ask_id": ask_id,
        "answer": answer,          # free text — DATA, the worker never executes it
        "iat": now,
        "exp": now + ANSWER_TTL_SECONDS,
        "jti": uuid.uuid4().hex,   # single-use
    }


def setup(bot: discord.Client, *, sign_token, user_allowed, gates, channel_id: int) -> None:
    """Call from bot.py on_ready (mirrors gate_approval.setup). `gates` = the requests/gates repo client; `sign_token`
    and `user_allowed` are gate_approval's existing helpers (passed in so this module stays decoupled)."""

    @tasks.loop(seconds=20)
    async def poll_asks() -> None:
        try:
            for name in await gates.list_dir("asks"):          # e.g. "ASK-foo-ab12cd.json"
                if not name.endswith(".json"):
                    continue
                ask = await gates.read_json(f"asks/{name}")     # {ask_id, question, branch, created}
                ask_id = ask["ask_id"]
                if ask_id in _pending:
                    continue
                channel = bot.get_channel(channel_id)
                msg = await channel.send(
                    f"**Agent hoi (tra loi truc tiep duoi day):**\n> {ask['question']}\n"
                    f"_(ask `{ask_id}`{(' · branch ' + ask['branch']) if ask.get('branch') else ''})_"
                )
                thread = await msg.create_thread(name=f"ask {ask_id}")
                _pending[ask_id] = thread.id
        except Exception as e:  # never let the loop die
            print(f"[ask_answer] poll_asks error: {e}")

    @tasks.loop(seconds=20)
    async def poll_reports() -> None:
        try:
            for name in await gates.list_dir("reports"):
                if not name.endswith(".json"):
                    continue
                rep = await gates.read_json(f"reports/{name}")  # {id, digest, created}
                channel = bot.get_channel(channel_id)
                digest = rep["digest"]
                await channel.send(f"**Bien ban batch:**\n{digest[:1900]}")  # Discord 2000-char cap
                await delete_report(name)
        except Exception as e:
            print(f"[ask_answer] poll_reports error: {e}")

    async def delete_report(name: str) -> None:
        await gates.delete_file(f"reports/{name}")

    @bot.event
    async def on_message(message: discord.Message) -> None:
        # Only act on replies inside a pending ask-thread, from an authorized user (same gate as the buttons).
        if message.author.bot:
            return
        ask_id = next((aid for aid, tid in _pending.items() if tid == message.channel.id), None)
        if ask_id is None:
            return
        if not user_allowed(message.author.id, channel_id):
            await message.reply("⛔ ban khong co quyen tra loi gate nay.")
            return
        token = sign_token(_answer_payload(ask_id, message.content))
        await gates.write_file(f"answers/{ask_id}.json", json.dumps({"token": token}))
        await gates.delete_file(f"asks/{ask_id}.json")
        _pending.pop(ask_id, None)
        await message.add_reaction("✅")

    poll_asks.start()
    poll_reports.start()
