// @vi WHAT: Thư viện dùng chung cho các phép thử có model tham gia: dựng môi trường cho tiến trình con và gọi Claude
//   headless một cách chạy được trên cả Linux và Windows.
// @vi WHEN: Được import bởi mọi `eval-*.mjs`. Không tự chạy gì.
// @vi WHY: Đúng đoạn code này đã hỏng âm thầm trên máy Windows và làm eval duy nhất của platform không chạy được suốt
//   thời gian nó tồn tại — mà mọi test vẫn xanh. Gom về một chỗ nghĩa là chỉ có một chỗ để sửa, và một chỗ để test.
//
/**
 * _eval.mjs — the shared half of every model-in-the-loop eval on this platform.
 *
 * WHY THIS EXISTS NOW AND NOT EARLIER. `/code-reuse`'s rule of three: `eval-ledger-rule.mjs` and
 * `eval-plan-execution-gate.mjs` each carried their own copy of the child-environment and spawn logic, and two
 * copies is not a reason to extract. The third eval is, and the history makes it more than a tidiness argument
 * — **this is precisely the code that was broken on Windows**, in both copies, for as long as they existed
 * (`PATHEXT` dropped by an env allowlist; Node refusing to spawn `claude.cmd` directly since its
 * CVE-2024-27980 mitigation). One copy means one place to fix and one place to test.
 *
 * What is deliberately NOT here: fixtures, metrics, verdicts. Those are what each eval is *about*, and folding
 * them into a shared library would produce a framework nobody can read — the `commons` failure with a new name.
 */

import { execFileSync } from "node:child_process";

/**
 * The child's environment: everything EXCEPT this session's own Claude Code variables.
 *
 * A DENYLIST, and the allowlist it replaces is a measured defect. The original passed `{HOME, PATH, TERM}` with
 * the stated intent "do not leak this session's `CLAUDE_*` vars". On Windows that kills the run outright: Node
 * resolves a bare command through `PATHEXT`, and the launcher there is `claude.cmd`. An allowlist has to
 * enumerate every variable the toolchain needs and is wrong the moment it wants one more; a denylist states the
 * actual requirement.
 */
export function childEnv(source = process.env) {
  const env = { ...source, TERM: "dumb" };
  for (const k of Object.keys(env)) {
    if (/^CLAUDE/i.test(k)) delete env[k];
  }
  return env;
}

/**
 * Spawn a headless Claude run and return its stdout, or an `error` string. Never throws.
 *
 * `shell: true`, and every alternative was tried on `TNT-Laptop` first:
 *   `claude`      → ENOENT (the launcher on PATH is `claude.cmd`; Node does not apply PATHEXT here)
 *   `claude.cmd`  → EINVAL (Node refuses to spawn a `.cmd` directly since its CVE-2024-27980 mitigation)
 *   with a shell  → works.
 *
 * Node's DEP0190 warns that args are concatenated rather than escaped under `shell`, so **nothing variable is
 * interpolated into the command**: the flags are constant and `model` is validated against a fixed set below.
 * The prompt — the only variable-length input — always goes in over **stdin**, never argv.
 */
const MODELS = new Set(["haiku", "sonnet", "opus"]);

export function spawnClaude({ cwd, prompt, model = "sonnet", timeout = 300000, acceptEdits = true } = {}) {
  if (!MODELS.has(model)) return { error: `refusing to spawn: unknown model ${JSON.stringify(model)}` };
  const flags = acceptEdits ? "-p --permission-mode acceptEdits" : "-p";
  try {
    const out = execFileSync(`claude ${flags} --model ${model}`, {
      cwd,
      input: prompt,
      env: childEnv(),
      shell: true,
      encoding: "utf8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { transcript: String(out || "") };
  } catch (e) {
    return { error: String(e.message || e).slice(0, 200), transcript: "" };
  }
}

/**
 * The cheapest possible answer to "can this machine run any eval at all?".
 *
 * It exists because the untestable half of an eval is untested by definition, and that is exactly where both
 * spawn defects lived: `eval-ledger-rule.mjs` sat broken on this box for as long as it existed while every test
 * it had stayed green. Deliberately NOT wired into `health-sweep` — that sweep is deterministic and free, and
 * making it spend tokens would change what it is. Run it by hand on a machine that has never produced a result
 * (`/behavioural-eval` rule 8).
 */
export function smoke({ model = "haiku" } = {}) {
  process.stdout.write("  smoke: spawning the CLI … ");
  const { transcript, error } = spawnClaude({
    prompt: "reply with the single word OK and stop",
    model,
    timeout: 180000,
    acceptEdits: false,
  });
  if (error) {
    console.log(`FAILED — ${error}`);
    console.log("  This machine cannot run any eval on this platform. Fix the spawn before reading any result.");
    return 1;
  }
  console.log(`ok — ${String(transcript).trim().slice(0, 40) || "(empty reply)"}`);
  return 0;
}
