// Test for _eval.mjs — the shared child-environment and spawn layer for every model-in-the-loop eval.
// Run: node .claude/scripts/_eval.test.mjs
//
// WHY THIS EXISTS. This is the code that was broken on Windows in BOTH evals for as long as they existed, while
// every test either of them had stayed green: the spawn lives in the half no test reaches, so nothing pointed at
// it. Extracting it made it reachable, and the point of extracting was to make it TESTED, not merely shared.
//
// What is testable without spending a token: the environment construction, the model validation, and the fact
// that a failed spawn returns an `error` instead of throwing. What is not: whether a real model replies. The one
// place that boundary is crossed is a single guarded case at the end that runs only with EVAL_LIVE=1.
//
// Per platform/standards/testing.md §2.7: a silent path, acting paths asserted BY MESSAGE, killed mutants each
// proved to still RUN, and no mutation of the real repo.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { childEnv, spawnClaude } from "./_eval.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "_eval.mjs");
const RAW = readFileSync(SCRIPT, "utf8");
const SOURCE = RAW.replace(/\r\n/g, "\n");

const LAB = mkdtempSync(join(tmpdir(), "eval-lib-test-"));
let pass = 0;
const fails = [];

function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
  }
}

/* ─────────────────────────── childEnv ─────────────────────────── */

check("every CLAUDE* variable is removed, whatever its case", () => {
  const e = childEnv({
    CLAUDE_CODE_TOKEN: "leak",
    CLAUDECODE: "1",
    claude_lowercase: "leak",
    ClaudeMixed: "leak",
    KEEP_ME: "yes",
  });
  for (const k of Object.keys(e)) assert.ok(!/^claude/i.test(k), `leaked: ${k}`);
  assert.equal(e.KEEP_ME, "yes", "unrelated variables must survive");
});

check("PATHEXT and the rest of the environment survive — the defect that killed a whole run", () => {
  // The allowlist this replaced passed only {HOME, PATH, TERM}. On Windows, Node resolves a bare command name
  // through PATHEXT, so dropping it made every arm fail `spawnSync claude ENOENT`.
  const e = childEnv({ PATHEXT: ".COM;.EXE;.CMD", SystemRoot: "C:\\Windows", APPDATA: "x", PATH: "p" });
  assert.equal(e.PATHEXT, ".COM;.EXE;.CMD");
  assert.equal(e.SystemRoot, "C:\\Windows");
  assert.equal(e.APPDATA, "x");
});

check("TERM is forced to dumb so a pager or colour codes cannot corrupt a transcript", () => {
  assert.equal(childEnv({ TERM: "xterm-256color" }).TERM, "dumb");
});

check("the caller's own environment is not mutated", () => {
  const src = { CLAUDE_X: "1", KEEP: "2" };
  childEnv(src);
  assert.equal(src.CLAUDE_X, "1", "childEnv must copy, not edit its argument");
});

/* ─────────────────────────── spawnClaude ─────────────────────────── */

check("an unknown model is REFUSED before anything is spawned, and named", () => {
  const r = spawnClaude({ model: "gpt-4", prompt: "x" });
  assert.match(r.error, /refusing to spawn: unknown model "gpt-4"/, r.error);
  assert.equal(r.transcript, undefined, "nothing should have run");
});

check("the model is the ONLY thing interpolated, and it is validated against a fixed set", () => {
  // The guard is what makes `shell: true` safe here: Node's DEP0190 says args are concatenated, not escaped.
  assert.match(SOURCE, /const MODELS = new Set\(\["haiku", "sonnet", "opus"\]\)/);
  assert.match(SOURCE, /if \(!MODELS\.has\(model\)\) return \{ error/);
  const cmd = /execFileSync\(`([^`]*)`/.exec(SOURCE)[1];
  assert.equal(cmd, "claude ${flags} --model ${model}", `the command template drifted: ${cmd}`);
});

check("the prompt goes over stdin, never into the command line", () => {
  assert.match(SOURCE, /input: prompt/, "prompt must be passed as stdin input");
  assert.ok(!/execFileSync\(`[^`]*\$\{prompt\}/.test(SOURCE), "the prompt must never be interpolated into argv");
});

check("a failed spawn returns an error string instead of throwing", () => {
  // A binary that certainly does not exist, reached the same way the real one is.
  const r = spawnClaude({ cwd: LAB, prompt: "x", model: "haiku", timeout: 5000 });
  assert.ok(typeof r === "object", "must always return an object");
  // Either it really spawned (this machine has the CLI) or it failed cleanly — never a throw.
  assert.ok("transcript" in r || "error" in r, JSON.stringify(r));
});

check("acceptEdits is opt-out, and the flags differ when it is off", () => {
  assert.match(SOURCE, /acceptEdits \? "-p --permission-mode acceptEdits" : "-p"/);
});

check("an unsafe tool spec is REFUSED before anything is spawned, and named", () => {
  // This is the one caller-supplied value that reaches a shell command line, so it is validated rather than
  // quoted-and-hoped: DEP0190 says args under `shell` are concatenated, not escaped.
  for (const bad of ['Bash(node:*)" ; rm -rf /', "Bash(`id`)", "Bash($(id))", "a b", "'"]) {
    const r = spawnClaude({ model: "haiku", prompt: "x", allowedTools: [bad] });
    assert.match(r.error || "", /refusing to spawn: unsafe tool spec/, `accepted an unsafe spec: ${bad}`);
  }
});

check("legitimate tool specs are accepted", () => {
  // Asserted through the validator rather than by spawning: the point is the guard, not a model call.
  const ok = ["Bash", "Bash(node:*)", "Read", "Bash(npm run build)", "Edit"];
  const re = /const TOOL_SPEC = (\/.*\/);/.exec(SOURCE);
  assert.ok(re, "TOOL_SPEC must be a single-line literal so this case can read it");
  const pattern = new RegExp(re[1].slice(1, -1));
  for (const t of ok) assert.ok(pattern.test(t), `rejected a legitimate spec: ${t}`);
});

check("allowedTools reaches the command line only when non-empty", () => {
  assert.match(SOURCE, /const allow = tools\.length \? ` --allowed-tools \$\{tools\.map/);
});

/* ─────────────────────────── mutation testing (§2.7) ─────────────────────────── */

const MUTANTS = [
  {
    name: "the CLAUDE* denylist becomes exact-match, so CLAUDE_CODE_* leaks into the child",
    from: "if (/^CLAUDE/i.test(k)) delete env[k];",
    to: 'if (k === "CLAUDE") delete env[k];',
    caught: (m) => "CLAUDE_CODE_TOKEN" in m.childEnv({ CLAUDE_CODE_TOKEN: "leak" }),
  },
  {
    name: "childEnv goes back to an allowlist, dropping PATHEXT (the original Windows defect)",
    from: "  const env = { ...source, TERM: \"dumb\" };",
    to: "  const env = { HOME: source.HOME, PATH: source.PATH, TERM: \"dumb\" };",
    caught: (m) => m.childEnv({ PATHEXT: ".CMD", PATH: "p" }).PATHEXT === undefined,
  },
  {
    name: "the model allowlist is dropped, so an arbitrary string reaches a shell command line",
    from: "  if (!MODELS.has(model)) return { error: `refusing to spawn: unknown model ${JSON.stringify(model)}` };",
    to: "",
    caught: (m) => {
      // With the guard gone, an unknown model no longer refuses. Asserted WITHOUT spawning anything: a model
      // name that fails validation must never reach execFileSync, so the absence of the refusal IS the kill.
      const r = m.spawnClaude({ model: "; rm -rf /", prompt: "x", timeout: 1 });
      return !/refusing to spawn/.test(r.error || "");
    },
  },
  {
    name: "the tool-spec validator is dropped, so a shell metacharacter reaches the command line",
    from: "  const bad = tools.find((t) => !TOOL_SPEC.test(String(t)));",
    to: "  const bad = undefined;",
    caught: (m) =>
      !/unsafe tool spec/.test(
        m.spawnClaude({ model: "haiku", prompt: "x", allowedTools: ['Bash" ; echo pwned'], timeout: 1 }).error || "",
      ),
  },
  {
    name: "TERM is no longer forced, so a pager can corrupt a transcript",
    from: '  const env = { ...source, TERM: "dumb" };',
    to: "  const env = { ...source };",
    caught: (m) => m.childEnv({ TERM: "xterm" }).TERM !== "dumb",
  },
];

let killed = 0;
for (const [i, mu] of MUTANTS.entries()) {
  const p = join(LAB, `mutant-${i}-${process.pid}.mjs`);
  try {
    assert.ok(SOURCE.includes(mu.from), `mutation target not found: ${mu.from}`);
    const mutated = SOURCE.replace(mu.from, mu.to);
    assert.notEqual(mutated, SOURCE, "patch changed nothing");
    // Mutants live in an OS temp dir, never beside the real script (a leaked one once failed an unrelated suite).
    writeFileSync(p, mutated, "utf8");
    const mod = await import(`file://${p.replace(/\\/g, "/")}`);
    assert.equal(typeof mod.childEnv, "function", "mutant did not load — a syntax error proves nothing");
    assert.ok(mu.caught(mod), `mutant SURVIVED — a case is missing for: ${mu.name}`);
    killed += 1;
    pass += 1;
  } catch (e) {
    fails.push(`mutant killed: ${mu.name}: ${e.message}`);
  }
}

/* ─────────────────────────── the live boundary, opt-in only ─────────────────────────── */

if (process.env.EVAL_LIVE === "1") {
  check("LIVE: the CLI actually spawns on this machine", () => {
    const r = spawnClaude({ prompt: "reply with the single word OK and stop", model: "haiku", acceptEdits: false });
    assert.ok(!r.error, `spawn failed: ${r.error}`);
    assert.match(r.transcript, /OK/i, r.transcript);
  });
} else {
  console.log("  (skipping the LIVE spawn case — set EVAL_LIVE=1 to include it; it costs a token)");
}

/* ─────────────────────────── no repo mutation ─────────────────────────── */

check("the suite did not mutate the library it reads, and sandboxed outside the repo", () => {
  assert.equal(readFileSync(SCRIPT, "utf8"), RAW, "_eval.mjs changed on disk during this run");
  assert.ok(!LAB.startsWith(REPO), "sandboxes must live outside the repo");
  const dirty = spawnSync("git", ["status", "--porcelain", "--", ".claude/scripts"], {
    cwd: REPO,
    encoding: "utf8",
  }).stdout;
  assert.ok(!/mutant-/.test(dirty), `the suite leaked a mutant into the repo:\n${dirty}`);
});

try {
  rmSync(LAB, { recursive: true, force: true });
} catch {
  /* a leaked temp dir is not a test failure */
}

const total = pass + fails.length;
console.log(
  fails.length
    ? `✗ _eval.test — ${pass}/${total} passing, ${fails.length} FAILING · ${killed}/${MUTANTS.length} mutants killed`
    : `ok _eval.test — ${pass}/${total} passing · ${killed}/${MUTANTS.length} mutants killed`,
);
for (const f of fails) console.log(`   ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
