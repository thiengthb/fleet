#!/usr/bin/env python3
"""Bot-side gate-token SIGNER (the function that will live in nuc-ops-bot/gate_approval.py).

Produces the SAME compact token the Node verifier (.claude/scripts/gate-verify.mjs) expects:
    token = base64url(payloadJson) + "." + base64url( RSA-SHA256/PKCS#1v1.5 signature over the payloadB64 ASCII bytes )

RSA-SHA256 (PKCS#1 v1.5) is chosen to match Node's crypto.verify('RSA-SHA256', ...). The bot is the ONLY
holder of the private key; the worker + the autonomy-gate hold only the public key and can never mint a token.

CLI (used by the interop test): sign_gate.py <priv.pem> <gate_id> <decision> <exp_epoch> <jti>  → prints token.
"""
import base64
import json
import sys

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def sign_gate_token(payload: dict, private_key_pem: str) -> str:
    """Sign a gate-approval payload, returning the compact `payloadB64.sigB64` token."""
    key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = key.sign(payload_b64.encode("ascii"), padding.PKCS1v15(), hashes.SHA256())
    return f"{payload_b64}.{_b64url(sig)}"


if __name__ == "__main__":
    priv_path, gate_id, decision, exp, jti = sys.argv[1:6]
    with open(priv_path, encoding="utf-8") as fh:
        pem = fh.read()
    payload = {"gate_id": gate_id, "decision": decision, "iat": int(exp) - 900, "exp": int(exp), "jti": jti}
    sys.stdout.write(sign_gate_token(payload, pem))
