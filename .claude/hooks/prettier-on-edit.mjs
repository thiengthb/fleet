// PostToolUse hook (Edit|Write) — best-effort auto-format with the project's LOCAL prettier.
// Silent no-op when prettier is not installed nearby or the file type is unsupported.
// Never blocks (always exits 0): formatting is a convenience, not a gate.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readPayload } from './_util.mjs';

const SUPPORTED = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.css', '.scss', '.html', '.md', '.mdx', '.yaml', '.yml',
]);

const payload = await readPayload();
const filePath = payload?.tool_input?.file_path || '';
if (!filePath || !existsSync(filePath)) process.exit(0);
if (!SUPPORTED.has(path.extname(filePath).toLowerCase())) process.exit(0);

// Walk up from the edited file to find a locally-installed prettier (no global npx — slow + wrong config).
const binName = process.platform === 'win32' ? 'prettier.cmd' : 'prettier';
let dir = path.dirname(path.resolve(filePath));
let bin = null;
for (;;) {
  const candidate = path.join(dir, 'node_modules', '.bin', binName);
  if (existsSync(candidate)) {
    bin = candidate;
    break;
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
if (!bin) process.exit(0); // no local prettier — leave the file as-is.

spawnSync(bin, ['--write', '--log-level', 'warn', filePath], {
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: process.platform === 'win32', // .cmd shims need a shell on Windows
});
process.exit(0);
