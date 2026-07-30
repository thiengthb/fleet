// Test for suggest-session-wrap.mjs — the Stop hook that nudges toward /session-wrap when a session did real
// work and recorded none of it.
// Run: node .claude/hooks/suggest-session-wrap.test.mjs
//
// WHY THIS EXISTS. This hook is the last thing standing between a session's knowledge and its evaporation:
// if it stays silent after a substantial pass, nothing gets written to decisions.md or the ledger, and the
// next session re-derives what this one learned. That failure is invisible — nobody notices a nudge that did
// not arrive.
//
// The opposite failure is what gets a nudge IGNORED, and it has more ways to happen: firing after a two-line
// fix, firing again on the same session, or firing when the user has ALREADY recorded (Gate 2). A nudge that
// appears when it is not wanted stops being read, which converts it into the first failure anyway. So both
// gates get cases in both directions.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the hook and asserts it notices.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HOOK = join(HERE, "suggest-session-wrap.mjs");

const lab = mkdtempSync(join(tmpdir(), "wrap-nudge-"));

let seq = 0;
const newSession = () => `wraptest-${process.pid}-${Date.now()}-${seq++}`;

/** One transcript line carrying one tool_use block, in the shape the harness writes. */
const edit = (file, name = "Edit") =>
  JSON.stringify({ message: { content: [{ type: "tool_use", name, input: { file_path: file } }] } });

function transcript(lines) {
  const p = join(lab, `t-${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

function fire(hookPath, { session = newSession(), transcriptPath, stopActive } = {}) {
  const payload = JSON.stringify({
    session_id: session,
    transcript_path: transcriptPath,
    ...(stopActive === undefined ? {} : { stop_hook_active: stopActive }),
  });
  try {
    const out = execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      env: { ...process.env, HOOK_USAGE_LOG: "off" },
    });
    return { code: 0, out: out || "" };
  } catch (err) {
    return { code: err.status ?? -1, out: (err.stderr || "") + (err.stdout || "") };
  }
}

const parse = (out) => {
  assert.ok(out.trim(), "expected JSON output, got nothing");
  return JSON.parse(out);
};

/* ═══════════════════ 1. it must stay silent on everything that is not substantial ═══════════════ */
{
  const SILENT = [
    { what: "a session with no edits at all", lines: ["{}"] },
    { what: "one file edited once", lines: [edit("/repo/a.ts")] },
    {
      what: "two files edited — under the 3-file gate, and only 2 of the 5 total edits",
      lines: [edit("/repo/a.ts"), edit("/repo/b.ts")],
    },
    {
      what: "the same file edited four times — under BOTH gates",
      lines: [edit("/repo/a.ts"), edit("/repo/a.ts"), edit("/repo/a.ts"), edit("/repo/a.ts")],
    },
    {
      what: "reads, greps and shell commands, which are not work",
      lines: [
        JSON.stringify({ message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/repo/a.ts" } }] } }),
        JSON.stringify({ message: { content: [{ type: "tool_use", name: "Grep", input: { path: "/repo" } }] } }),
        JSON.stringify({ message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] } }),
      ],
    },
  ];

  for (const c of SILENT) {
    const r = fire(HOOK, { transcriptPath: transcript(c.lines) });
    assert.equal(r.code, 0, `must exit 0: ${c.what}`);
    assert.equal(r.out.trim(), "", `NUDGED WHEN IT SHOULD NOT: ${c.what}\n${r.out}`);
  }
}

/* ═══════════════════ 2. …and it must fire when the work really was substantial ═══════════════ */
{
  const byFiles = fire(HOOK, {
    transcriptPath: transcript([edit("/repo/a.ts"), edit("/repo/b.ts"), edit("/repo/c.ts")]),
  });
  assert.equal(byFiles.code, 0);
  const j = parse(byFiles.out);
  assert.match(j.systemMessage, /đã sửa 3 file nhưng chưa ghi lại tri thức/, j.systemMessage);
  assert.match(
    j.systemMessage,
    /\/session-wrap/,
    "the nudge must name the command — one that does not say what to do costs a round trip",
  );
  assert.match(j.systemMessage, /trước khi mất context/, "…and say why now rather than later");
  assert.equal(j.suppressOutput, true, "it speaks to the user, not into the model's transcript");

  const byCount = fire(HOOK, {
    transcriptPath: transcript([
      edit("/repo/a.ts", "Write"),
      edit("/repo/a.ts"),
      edit("/repo/b.ts", "MultiEdit"),
      edit("/repo/b.ts"),
      edit("/repo/b.ts"),
    ]),
  });
  assert.match(
    parse(byCount.out).systemMessage,
    /đã sửa 2 file/,
    "five edits over two files is substantial by the total-edits gate",
  );
}

/* ═══════════════════ 3. GATE 2 — if knowledge was already recorded, say nothing ═══════════════
 * This is the gate that keeps the nudge credible. Nagging someone who has just written their decisions log is
 * how a reminder becomes noise, and a noisy reminder is ignored on the day it matters.
 */
{
  const KNOWLEDGE = [
    "/repo/projects/todo/docs/decisions.md",
    "/repo/projects/todo/docs/00-map.md",
    "/repo/.claude/memory/MEMORY.md",
    "/repo/.claude/memory/user-profile.md",
    "/repo/platform/registries/knowledge-ledger.md",
    "/repo/platform/registries/known-traps.md",
    "C:\\repo\\projects\\todo\\docs\\DECISIONS.MD", // backslashes and case must not defeat it
  ];

  for (const k of KNOWLEDGE) {
    const r = fire(HOOK, {
      transcriptPath: transcript([edit("/repo/a.ts"), edit("/repo/b.ts"), edit("/repo/c.ts"), edit(k)]),
    });
    assert.equal(
      r.out.trim(),
      "",
      `substantial work PLUS a knowledge write must stay silent — the user already recorded: ${k}\n${r.out}`,
    );
  }

  const onlyKnowledge = fire(HOOK, {
    transcriptPath: transcript([
      edit("/repo/projects/a/docs/decisions.md"),
      edit("/repo/projects/b/docs/decisions.md"),
      edit("/repo/projects/c/docs/decisions.md"),
    ]),
  });
  assert.equal(onlyKnowledge.out.trim(), "", "three knowledge files is a wrap, not unrecorded work");
}

/* ═══════════════════ 4. once per session, and never during a continuation loop ═══════════════ */
{
  const session = newSession();
  const t = transcript([edit("/repo/a.ts"), edit("/repo/b.ts"), edit("/repo/c.ts")]);

  assert.ok(fire(HOOK, { session, transcriptPath: t }).out.trim(), "the first Stop must nudge");
  assert.equal(
    fire(HOOK, { session, transcriptPath: t }).out.trim(),
    "",
    "a second Stop in the SAME session must be silent — a Stop hook fires many times per session",
  );
  assert.ok(
    fire(HOOK, { session: newSession(), transcriptPath: t }).out.trim(),
    "a different session must be nudged again",
  );
  assert.equal(
    fire(HOOK, { session: newSession(), transcriptPath: t, stopActive: true }).out.trim(),
    "",
    "`stop_hook_active` means the agent is already continuing — interrupting that loop is never wanted",
  );
}

/* ═══════════════════ 5. every degraded input must be silent, never an exception ═══════════════
 * A Stop hook that throws fails at the end of every session the user cares about.
 */
{
  const t = transcript([edit("/repo/a.ts"), edit("/repo/b.ts"), edit("/repo/c.ts")]);
  const cases = [
    { what: "no transcript path", payload: { session_id: newSession() } },
    {
      what: "a transcript that does not exist",
      payload: { session_id: newSession(), transcript_path: join(lab, "nope.jsonl") },
    },
    { what: "no session id", payload: { transcript_path: t } },
    { what: "an empty payload", payload: {} },
  ];
  for (const c of cases) {
    let code = 0;
    let out = "";
    try {
      out = execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(c.payload),
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8",
        env: { ...process.env, HOOK_USAGE_LOG: "off" },
      });
    } catch (err) {
      code = err.status ?? -1;
    }
    assert.equal(code, 0, `must exit 0: ${c.what}`);
    assert.equal(out.trim(), "", `must be silent: ${c.what}`);
  }

  const mixed = transcript([
    "{ not json",
    "",
    edit("/repo/a.ts"),
    "also not json",
    edit("/repo/b.ts"),
    edit("/repo/c.ts"),
  ]);
  assert.ok(
    fire(HOOK, { transcriptPath: mixed }).out.trim(),
    "a few unparseable lines must not stop the count — a transcript is appended live and can be ragged",
  );
}

/* ═══════════════════ 6. a tool_use block is found wherever it sits ═══════════════
 * The collector is deliberately shape-agnostic: the transcript format is the harness's, not ours, and a
 * nesting change would silently zero the count.
 */
{
  const nested = transcript([
    JSON.stringify({ a: { b: [{ type: "tool_use", name: "Edit", input: { file_path: "/repo/x.ts" } }] } }),
    JSON.stringify({ type: "tool_use", name: "Edit", input: { file_path: "/repo/y.ts" } }),
    JSON.stringify({ message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "/repo/z.ts" } }] } }),
  ]);
  assert.match(
    parse(fire(HOOK, { transcriptPath: nested }).out).systemMessage,
    /đã sửa 3 file/,
    "top-level, nested and message.content shapes must all be counted",
  );
}

/* ═══════════════════ 7. the suite must NOTICE a broken nudge (mutation) ═══════════════ */
{
  const src = readFileSync(HOOK, "utf8");
  const mutLab = join(lab, "mutants");
  mkdirSync(mutLab, { recursive: true });
  copyFileSync(join(HERE, "_util.mjs"), join(mutLab, "_util.mjs"));

  const THREE = [edit("/repo/a.ts"), edit("/repo/b.ts"), edit("/repo/c.ts")];

  const mutants = [
    {
      name: "Gate 2 removed (nags the user who just recorded)",
      apply: (s) => s.replace("if (wrapped) process.exit(0);", ""),
      probe: (h) =>
        fire(h, {
          transcriptPath: transcript([...THREE, edit("/repo/projects/todo/docs/decisions.md")]),
        }).out.trim() !== "",
    },
    {
      name: "the work threshold dropped to 1 (fires after a typo fix)",
      apply: (s) => s.replace("const WORK_FILE_THRESHOLD = 3;", "const WORK_FILE_THRESHOLD = 1;"),
      probe: (h) => fire(h, { transcriptPath: transcript([edit("/repo/a.ts")]) }).out.trim() !== "",
    },
    {
      name: "the nudge silenced entirely (knowledge evaporates and nothing says so)",
      apply: (s) => s.replace("const substantial =", "const substantial = false &&"),
      probe: (h) => fire(h, { transcriptPath: transcript(THREE) }).out.trim() === "",
    },
    {
      name: "the once-per-session marker ignored (a nudge on every Stop)",
      apply: (s) => s.replace("if (existsSync(marker)) process.exit(0);", ""),
      probe: (h) => {
        const session = newSession();
        const t = transcript(THREE);
        fire(h, { session, transcriptPath: t });
        return fire(h, { session, transcriptPath: t }).out.trim() !== "";
      },
    },
    {
      name: "the continuation-loop guard removed (interrupts the agent mid-loop)",
      apply: (s) => s.replace("if (payload.stop_hook_active === true) process.exit(0);", ""),
      probe: (h) => fire(h, { transcriptPath: transcript(THREE), stopActive: true }).out.trim() !== "",
    },
    {
      name: "knowledge files no longer recognised (memory writes counted as unrecorded work)",
      apply: (s) => s.replace("base === 'decisions.md' ||", "false ||"),
      probe: (h) =>
        fire(h, {
          transcriptPath: transcript([
            edit("/repo/projects/a/docs/decisions.md"),
            edit("/repo/projects/b/docs/decisions.md"),
            edit("/repo/projects/c/docs/decisions.md"),
          ]),
        }).out.trim() !== "",
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(mutated, src, `mutation "${m.name}" changed nothing — the patch is stale`);
    const p = join(mutLab, `mutant-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(p, mutated);
    assert.ok(m.probe(p), `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`);
  }
}

rmSync(lab, { recursive: true, force: true });
console.log(
  "suggest-session-wrap.test.mjs — 5 silent paths under both gates, both firing gates, 7 knowledge-file " +
    "shapes suppressing the nudge, once-per-session + the continuation guard, 5 degraded inputs, three " +
    "transcript nestings, 6 mutants all killed  ✅",
);
