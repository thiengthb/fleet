// PostToolUse hook (Edit|Write|MultiEdit) — ADVISORY (never blocks; the write already happened).
// Research-before-design / anti-bias gate: when a PLAN file declares `kind: feature` (or `system-change`)
// and is flipped to `status: active`, it MUST carry a "## Prior art & sources" section with ≥2 external URLs.
// Surfaces a reminder in-loop if it doesn't — the agent should research external prior art BEFORE designing,
// not design from its own (bias-prone) opinion. Opt-in via frontmatter, so fix/refactor/chore plans never fire.
//
// Enforcement level: advisory (exit 2 = feedback to Claude). The hard enforcement lives in the skill that
// produces the proposal (it won't write a Recommendation without sources); this is the in-loop backstop.
// Contract: nuc-platform/09-autonomy-contract.md.

import { existsSync, readFileSync } from 'node:fs';
import { readPayload } from './_util.mjs';

const payload = await readPayload();
const filePath = payload?.tool_input?.file_path || '';
const lower = filePath.replace(/\\/g, '/').toLowerCase();

// Only plan files under a plans/ directory.
if (!lower.includes('/plans/') || !lower.endsWith('.md') || !existsSync(filePath)) process.exit(0);

let text;
try {
  text = readFileSync(filePath, 'utf8');
} catch {
  process.exit(0);
}

// Frontmatter = first --- ... --- block.
const fm = text.match(/^---\n([\s\S]*?)\n---/);
if (!fm) process.exit(0);
const front = fm[1];
const status = (front.match(/^status:\s*([a-z]+)/m) || [])[1];
const kind = (front.match(/^kind:\s*([a-z-]+)/m) || [])[1];

// Only gate feature / system-change plans that are active.
if (status !== 'active') process.exit(0);
if (kind !== 'feature' && kind !== 'system-change') process.exit(0);

// Grab the "## Prior art ..." section up to the next ## header (or EOF) and count external URLs.
let urls = 0;
const hdr = text.match(/^##\s+Prior art[^\n]*$/im);
if (hdr) {
  const rest = text.slice(hdr.index + hdr[0].length);
  const next = rest.search(/\n##\s/);
  const section = next === -1 ? rest : rest.slice(0, next);
  urls = (section.match(/https?:\/\/\S+/g) || []).length;
}

if (urls < 2) {
  console.error(
    `prior-art-check (${filePath}):\n` +
      `- This plan is \`kind: ${kind}\`, \`status: active\`, but its "## Prior art & sources" section has ${urls} external URL(s) (need ≥2).\n` +
      `- Research-before-design (anti-bias): survey external prior art FIRST and cite ≥2 sources + ≥2 ruled-out options before committing the design.\n` +
      `- Add the sources (or, if this is genuinely not a feature/system-change, set \`kind:\` to fix/refactor/chore).`,
  );
  process.exit(2); // PostToolUse: feedback to Claude, does not block.
}
process.exit(0);
