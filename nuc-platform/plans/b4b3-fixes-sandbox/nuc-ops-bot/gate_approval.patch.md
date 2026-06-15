# Patch — `nuc-ops-bot/gate_approval.py` (B4b.3 finding #3, OPTIONAL)

One-line change in `GateApprovalView._decide` so the approval button authorizes against the **approval channel**
(`APPROVAL_CHANNEL_ID`) instead of the ops channel. Pairs with the `guards.user_allowed(..., channel_id=...)` change
(see `../guards.py` in this sandbox). Apply BOTH together.

## The change

In `_decide` (currently ~line 133):

```python
    async def _decide(self, interaction: discord.Interaction, decision: str) -> None:
        if not guards.user_allowed(interaction):  # server-side allowlist — the real gate
            return await interaction.response.send_message("⛔ Bạn không có quyền duyệt gate.", ephemeral=True)
```

becomes:

```python
    async def _decide(self, interaction: discord.Interaction, decision: str) -> None:
        # Authorize against the APPROVAL channel (the card's channel), not the ops channel — user + guild still enforced.
        if not guards.user_allowed(interaction, channel_id=str(APPROVAL_CHANNEL_ID)):
            return await interaction.response.send_message("⛔ Bạn không có quyền duyệt gate.", ephemeral=True)
```

`APPROVAL_CHANNEL_ID` is already defined in this module (the `GATE_APPROVAL_CHANNEL_ID` / `OPS_CHANNEL_ID` fallback).
No other change needed.

## Why this is OPTIONAL

The live stopgap (2026-06-15) set `GATE_APPROVAL_CHANNEL_ID = OPS_CHANNEL_ID`, so the card posts in the ops channel and
the existing `user_allowed` (which checks `OPS_CHANNEL_ID`) passes. That already works. Apply this patch ONLY if you want
a **dedicated** approval channel again — then you can revert the env stopgap:

```
# in ~/.nuc-env/nuc-ops-bot.env, set the dedicated channel back, then:
.claude/scripts/nuc-set-env.ps1 nuc-ops-bot      # or .sh
```

## Install + verify

1. `cp nuc-platform/plans/b4b3-fixes-sandbox/nuc-ops-bot/guards.py nuc-ops-bot/guards.py`
2. apply the one-line `_decide` change above in `nuc-ops-bot/gate_approval.py`
3. `cd nuc-ops-bot && python -m py_compile guards.py gate_approval.py` (parse check)
4. commit + push `nuc-ops-bot` main → CI → ghcr → Watchtower redeploy (bundle with the env revert if you want the
   dedicated channel). Then re-run a B4b.3-style park → the **Duyệt** click in the dedicated channel should succeed.
