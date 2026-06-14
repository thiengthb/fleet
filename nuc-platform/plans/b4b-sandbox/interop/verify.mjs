// Verify a Python-signed token with the REAL Node verifier. Exit 0 iff ok && decision === expected.
import { readFileSync } from 'node:fs';
import { verifyGateToken } from '../scripts/gate-verify.mjs';

const [pubPath, token, gate, nowSec, wantDecision = 'approve'] = process.argv.slice(2);
const r = verifyGateToken({
  token,
  publicKeyPem: readFileSync(pubPath, 'utf8'),
  expectedGateId: gate,
  nowSec: Number(nowSec),
  consumedJtis: new Set(),
});
console.log(JSON.stringify(r));
process.exit(r.ok && r.decision === wantDecision ? 0 : 1);
