// @vi WHAT: Sau mỗi lần ghi file, nó đọc lại file và nhắc (không chặn) nếu thấy chạm vào ba bất biến của NUC: tự xin chứng
//   chỉ SSL, dùng runner tự dựng trong CI, hoặc mở cổng ra host trong compose của một app.
// @vi WHY: Ba thứ này đều có trường hợp ngoại lệ hợp lệ, nên chặn cứng sẽ chặn oan việc đúng. Nhắc thì đúng liều: lỗi vẫn
//   được thấy ngay trong lúc làm.
//
// PostToolUse hook (Edit|Write) — ADVISORY (never blocks; the write already happened).
// Reads the final file and surfaces platform-invariant leaks back to Claude as feedback (exit 2).
// Soft net so a violation is caught in-loop without false-blocking legitimate work.
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readPayload } from './_util.mjs';

const payload = await readPayload();
const filePath = payload?.tool_input?.file_path || '';
if (!filePath || !existsSync(filePath)) process.exit(0);

const base = path.basename(filePath).toLowerCase();
const lower = filePath.replace(/\\/g, '/').toLowerCase();

let text;
try {
  text = readFileSync(filePath, 'utf8');
} catch {
  process.exit(0);
}

const isDoc = base.endsWith('.md');
const isCompose = /^docker-compose.*\.ya?ml$/.test(base) || base === 'compose.yml' || base === 'compose.yaml';
const isYaml = /\.ya?ml$/.test(base);
const isDockerfile = base === 'dockerfile' || base.endsWith('.dockerfile');
const isWorkflow = lower.includes('/.github/workflows/');

const warnings = [];

// Invariant #6 — TLS is Cloudflare-only; never certbot/letsencrypt/acme (config files, not prose in docs).
if (!isDoc && (isCompose || isYaml || isDockerfile) && /\b(certbot|letsencrypt|acme\.)/i.test(text)) {
  warnings.push('Invariant #6: TLS is Cloudflare-only — remove any certbot/letsencrypt/acme config.');
}

// Invariant #1 — the NUC only PULLs images; CI must not use a self-hosted runner.
if (isWorkflow && /runs-on:\s*\[?\s*['"]?self-hosted/i.test(text)) {
  warnings.push('Invariant #1: no self-hosted runner — CI builds & pushes to ghcr; the NUC only PULLs.');
}

// Invariant #2 — apps never publish host ports (Traefik reaches them over the edge network).
// Advisory only: a repo compose used for LOCAL DEV may legitimately publish ports — ignore then.
if (isCompose && !/(infra|traefik)/.test(lower) && /^\s*ports:\s*$/m.test(text) && /^\s*-\s*["']?\d+:\d+/m.test(text)) {
  warnings.push(
    'Invariant #2: app compose publishes host ports — on the NUC apps must reach Traefik over the edge network, not publish ports. ' +
      '(Ignore if this compose is local-dev only.)',
  );
}

if (warnings.length) {
  console.error(`invariant-warn (${filePath}):\n- ${warnings.join('\n- ')}`);
  process.exit(2); // PostToolUse: feedback to Claude, does not block (write already done).
}
process.exit(0);
