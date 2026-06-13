// PreToolUse hook (Edit|Write) — BLOCKS hardcoding a real secret into any file that is not .env.
// Enforces MiniServer invariant #4: secrets live ONLY in .env (chmod 600, gitignored).
import path from 'node:path';
import { readPayload, getWriteText } from './_util.mjs';

// High-confidence patterns only — a tight set keeps false positives near zero.
const SECRET_PATTERNS = [
  { name: 'GitHub personal access token', re: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { name: 'OpenAI/Anthropic-style key', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: 'assigned secret literal',
    re: /(?:api[_-]?key|secret|token|password|passwd|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"][^'"\s${}<>]{12,}['"]/i,
  },
];

// Obvious non-secrets — skip these even if a pattern matches.
const PLACEHOLDER = /(your[_-]|example|changeme|placeholder|x{4,}|\.\.\.|dummy|sample|redacted|<[^>]+>|\$\{)/i;

const payload = await readPayload();
const filePath = payload?.tool_input?.file_path || '';
const base = path.basename(filePath).toLowerCase();

// .env family is the sanctioned home for secrets — never block it.
if (base === '.env' || base.startsWith('.env.')) process.exit(0);

const text = getWriteText(payload.tool_input);
for (const { name, re } of SECRET_PATTERNS) {
  const m = text.match(re);
  if (m && !PLACEHOLDER.test(m[0])) {
    console.error(
      `secret-guard BLOCKED: looks like a hardcoded ${name} in ${filePath}.\n` +
        `Invariant #4 — secrets live ONLY in .env (chmod 600, gitignored), never in compose/Dockerfile/code.\n` +
        `Move the value to .env and reference it via an environment variable. ` +
        `If this is a false positive (test fixture / public sample), put it in a .env* file or rename the value.`,
    );
    process.exit(2);
  }
}
process.exit(0);
