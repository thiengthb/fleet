// Shared helpers for MiniServer Claude Code hooks (Node ESM — Windows-safe, no bash).
// Each hook reads a JSON payload from stdin and decides via exit code:
//   PreToolUse:  exit 2 = block the tool call, stderr is shown to Claude.
//   PostToolUse: exit 2 = feedback to Claude (write already happened, cannot block).
//   exit 0 = silent success.

/** Read and parse the hook JSON payload from stdin. Returns {} on any error. */
export async function readPayload() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Extract the text being written from a tool_input (Write/Edit/MultiEdit). */
export function getWriteText(input = {}) {
  if (typeof input.content === 'string') return input.content; // Write
  if (typeof input.new_string === 'string') return input.new_string; // Edit
  if (Array.isArray(input.edits)) return input.edits.map((e) => e?.new_string || '').join('\n'); // MultiEdit
  return '';
}
