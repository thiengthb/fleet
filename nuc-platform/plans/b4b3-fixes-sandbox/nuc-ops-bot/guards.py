"""Authorization & protection layer — decides who may issue commands, and which containers are off-limits.

This is a control layer that runs ENTIRELY in code (deterministic), independent of the LLM.
Every write action must pass through here before reaching Docker.
"""
import os


def _id_set(env: str) -> set[str]:
    """Read a comma-separated list of IDs from an environment variable."""
    return {s.strip() for s in os.getenv(env, "").split(",") if s.strip()}


# Only these user IDs (Discord numbers) may issue commands. Empty = block everyone (safe default).
ALLOWED_USER_IDS = _id_set("ALLOWED_USER_IDS")

# Lock the bot to exactly 1 server + 1 ops channel. Empty = no constraint (only leave empty when testing).
GUILD_ID = os.getenv("GUILD_ID", "").strip()
OPS_CHANNEL_ID = os.getenv("OPS_CHANNEL_ID", "").strip()

# Infrastructure containers — ABSOLUTELY no stop/start/restart (a wrong shutdown cuts off your own way back).
# Can be extended via the INFRA_PROTECTED env var (overrides the default list).
_DEFAULT_PROTECTED = "traefik,cloudflared,watchtower,authentik-server,authentik-worker,authentik-postgresql,nuc-ops-bot,ops-proxy,img-proxy,nuc-monitor"
INFRA_PROTECTED = {
    s.strip() for s in os.getenv("INFRA_PROTECTED", _DEFAULT_PROTECTED).split(",") if s.strip()
}


def user_allowed(interaction, channel_id: str | None = None) -> bool:
    """True if the interaction comes from the configured user + server + channel.

    channel_id: which channel the interaction MUST come from. Defaults to OPS_CHANNEL_ID (slash commands).
    Pass an explicit id (e.g. the gate-approval channel) when a handler posts to a DIFFERENT channel — otherwise a
    button posted outside the ops channel would always be rejected by the channel check (B4b.3 finding #3).
    """
    expected_channel = channel_id if channel_id is not None else OPS_CHANNEL_ID
    if ALLOWED_USER_IDS and str(interaction.user.id) not in ALLOWED_USER_IDS:
        return False
    if GUILD_ID and str(interaction.guild_id or "") != GUILD_ID:
        return False
    if expected_channel and str(interaction.channel_id or "") != expected_channel:
        return False
    return True


def is_protected(name: str) -> bool:
    """True if the container belongs to the protected infrastructure group."""
    return name in INFRA_PROTECTED
