// Test for prettier-on-edit.mjs — a PostToolUse hook that REWRITES the file that was just written.
// Run: node .claude/hooks/prettier-on-edit.test.mjs
//
// WHY THIS EXISTS, and why it is in the same batch as the two blocking guards. This hook does not block
// anything, so it looks harmless — and it is the only hook on the platform that CHANGES CONTENT, on every
// single edit. Its failure modes are therefore the quietest of the three:
//
//   invokes nothing   — formatting silently stops happening. Nobody notices for weeks; the lint gate
//                       catches it eventually, at commit time, in bulk.
//   invokes the wrong
//   binary            — a prettier from somewhere up the tree formats with the WRONG project's config, so
//                       files churn back and forth between two styles and every diff carries noise.
//   invokes with the
//   wrong arguments   — the contract is `--write`. Drop it and prettier prints to stdout, which the hook
//                       discards: a hook that appears to work and does nothing at all.
//
// METHOD: a fake `node_modules/.bin/prettier` shell script that records its arguments and tags which copy
// ran. That is deliberate — the thing under test is the hook's RESOLUTION and ARGUMENT contract, not
// prettier itself, and using real prettier would make the suite depend on a node_modules tree existing.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the hook and asserts it notices.
// KNOWN GAP, stated rather than hidden: the Windows branch (`prettier.cmd` + `shell: true`) is not
// exercised — this platform runs on Linux, and a fake `.cmd` would test the fake, not the hook.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "prettier-on-edit.mjs");

const root = mkdtempSync(join(tmpdir(), "prettier-hook-"));
const LOG = join(root, "invocations.log");

/**
 * Install a fake prettier at `<dir>/node_modules/.bin/prettier` that appends `tag|<args>` to the log.
 * `exitCode` lets a case prove the hook survives a formatter that fails.
 */
function fakePrettier(dir, tag, exitCode = 0) {
  const bin = join(dir, "node_modules", ".bin");
  mkdirSync(bin, { recursive: true });
  // The shim has to be the SAME artefact the hook looks for, per platform: `prettier.cmd` on Windows (a
  // `#!/bin/sh` file with no extension is not executable there, so every case measured a formatter that
  // never ran), `prettier` elsewhere. The .cmd defers to node rather than fighting batch quoting.
  if (process.platform === "win32") {
    const runner = join(bin, "fake-prettier.mjs");
    writeFileSync(
      runner,
      `import { appendFileSync } from "node:fs";\n` +
        `appendFileSync(${JSON.stringify(LOG)}, ${JSON.stringify(tag)} + "|" + process.argv.slice(2).join(" ") + "\\n");\n` +
        `process.exit(${exitCode});\n`,
    );
    const p = join(bin, "prettier.cmd");
    writeFileSync(
      p,
      `@echo off\r\n"${process.execPath}" "${runner}" %*\r\nexit /b %errorlevel%\r\n`,
    );
    return p;
  }
  const p = join(bin, "prettier");
  writeFileSync(p, `#!/bin/sh\nprintf '%s|%s\\n' '${tag}' "$*" >> '${LOG}'\nexit ${exitCode}\n`);
  chmodSync(p, 0o755);
  return p;
}

const readLog = () => (existsSync(LOG) ? readFileSync(LOG, "utf8") : "");
const clearLog = () => {
  if (existsSync(LOG)) rmSync(LOG);
};

/** Fire the hook on a file. Returns {code, log}. */
function fire(hookPath, filePath) {
  clearLog();
  const payload = JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: filePath },
  });
  let code = 0;
  try {
    execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOOK_USAGE_LOG: "off" }, // never pollute the counter (_util.mjs)
    });
  } catch (err) {
    code = err.status ?? -1;
  }
  return { code, log: readLog() };
}

/** A file inside its own sandbox dir, so each case controls exactly which prettier is reachable. */
function fixture(name, body = "const  x   =  1\n") {
  const dir = join(root, "cases", name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, body);
  return { dir, file };
}

/* ─────────────────────────────────────── 1. it must always exit 0 — formatting is not a gate ──
 * Checked in every case below, and separately here for the paths where the hook does nothing at all.
 * A PostToolUse hook that exits non-zero sends feedback to Claude on EVERY edit; for a convenience
 * feature that is pure noise.
 */
{
  const { dir, file } = fixture("no-prettier-anywhere.md");
  // No fake installed in this sandbox: the walk-up must terminate at the filesystem root and give up.
  const { code, log } = fire(HOOK, file);
  assert.equal(code, 0, "a missing local prettier must be a silent no-op, not a failure");
  assert.equal(log, "", `nothing may be invoked when no local prettier exists:\n${log}`);
  rmSync(dir, { recursive: true, force: true });
}

/* ─────────────────────────────────────────────── 2. the silent paths (it must not invoke) ── */
{
  const cases = [
    {
      what: "an unsupported extension",
      make: () => {
        const f = fixture("notes.txt");
        fakePrettier(f.dir, "same-dir");
        return f.file;
      },
    },
    {
      what: "a file that no longer exists (edited then deleted)",
      make: () => {
        const f = fixture("gone.md");
        fakePrettier(f.dir, "same-dir");
        rmSync(f.file);
        return f.file;
      },
    },
    {
      what: "an empty file_path",
      make: () => "",
    },
    {
      what: "a lockfile-ish extension prettier should not touch here",
      make: () => {
        const f = fixture("Dockerfile");
        fakePrettier(f.dir, "same-dir");
        return f.file;
      },
    },
  ];

  for (const c of cases) {
    const { code, log } = fire(HOOK, c.make());
    assert.equal(code, 0, `must exit 0: ${c.what}`);
    assert.equal(log, "", `INVOKED PRETTIER WHEN IT SHOULD NOT: ${c.what}\n${log}`);
  }
}

/* ────────────────────────────── 3. the argument contract — `--write`, or the hook is decoration ── */
{
  const { file, dir } = fixture("styled.ts");
  fakePrettier(dir, "same-dir");
  const { code, log } = fire(HOOK, file);
  assert.equal(code, 0, "a successful format must exit 0");
  assert.match(log, /^same-dir\|/, `the prettier beside the file must be the one that runs:\n${log}`);
  assert.match(
    log,
    /--write/,
    `WITHOUT --write prettier prints to stdout, which this hook discards — it would format nothing:\n${log}`,
  );
  assert.match(log, /--log-level warn/, `the noise level is part of the contract:\n${log}`);
  assert.ok(log.includes(file), `the edited file must be passed by absolute path:\n${log}`);
}

/* ───────────────────────────────── 4. every supported type the platform actually writes ── */
{
  const exts = ["ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "css", "scss", "md", "mdx", "yaml", "yml", "html"];
  const missed = [];
  for (const ext of exts) {
    const { file, dir } = fixture(`sample.${ext}`);
    fakePrettier(dir, ext);
    if (!fire(HOOK, file).log.includes(`${ext}|`)) missed.push(ext);
  }
  assert.deepEqual(missed, [], `these supported extensions were not formatted: ${missed.join(", ")}`);

  // …and the case matters not at all, because extensions arrive however the author typed them.
  const upper = fixture("SHOUTED.MD");
  fakePrettier(upper.dir, "upper");
  assert.match(
    fire(HOOK, upper.file).log,
    /^upper\|/,
    "an uppercase extension must still be formatted — extname is lowercased for a reason",
  );
}

/* ───────────────────────── 5. the NEAREST prettier wins — the whole point of walking up ──
 * A monorepo has several. Picking the wrong one formats with the wrong config, and the file then churns
 * between two styles on alternate edits: noise in every diff, and no error anywhere.
 */
{
  const outer = join(root, "mono");
  const inner = join(outer, "packages", "app");
  mkdirSync(inner, { recursive: true });
  const file = join(inner, "component.tsx");
  writeFileSync(file, "const  y = 2\n");

  fakePrettier(outer, "OUTER");
  const onlyOuter = fire(HOOK, file);
  assert.match(
    onlyOuter.log,
    /^OUTER\|/,
    `an ancestor's prettier must be found by walking up:\n${onlyOuter.log}`,
  );

  fakePrettier(inner, "INNER");
  const both = fire(HOOK, file);
  assert.match(both.log, /^INNER\|/, `the NEAREST prettier must win:\n${both.log}`);
  assert.doesNotMatch(both.log, /OUTER/, "the ancestor must not also run");
}

/* ─────────────────────────── 6. a formatter that FAILS must not turn into feedback on every edit ── */
{
  const { file, dir } = fixture("broken-syntax.ts", "const  =\n");
  fakePrettier(dir, "failing", 1);
  const { code, log } = fire(HOOK, file);
  assert.equal(
    code,
    0,
    "prettier exiting non-zero must not make the hook exit non-zero — it would nag on every unparseable edit",
  );
  assert.match(log, /^failing\|/, "it must still have been attempted");
}

/* ───────────────────────────────── 7. the suite must NOTICE a broken hook (mutation) ── */
{
  // LF-normalized: on a CRLF working tree (Windows) every multi-line mutation patch below would go stale.
  const src = readFileSync(HOOK, "utf8").replace(/\r\n/g, "\n");
  const lab = join(root, "mutants");
  mkdirSync(lab, { recursive: true });
  copyFileSync(join(HERE, "_util.mjs"), join(lab, "_util.mjs"));

  const supported = () => {
    const f = fixture(`mut-${Math.random().toString(36).slice(2)}.ts`);
    fakePrettier(f.dir, "mut");
    return f.file;
  };

  const mutants = [
    {
      // The first version of this mutant wrapped the list in `[].concat([…])`, which empties nothing — it
      // just unbalanced the parens. The suite "killed" it because the hook crashed on a syntax error, so
      // the mutant proved the suite notices a BROKEN FILE and said nothing about the behaviour it claimed
      // to test. Hence the exit-code assertion in the probe: a mutant that only crashes is not a mutant.
      name: "the supported-type list emptied (formats nothing, ever)",
      apply: (s) =>
        s.replace(/const SUPPORTED = new Set\(\[[\s\S]*?\]\);/, "const SUPPORTED = new Set();"),
      probe: (h) => {
        const r = fire(h, supported());
        return r.code === 0 && r.log === "";
      },
    },
    {
      name: "--write dropped (formats to stdout, which is discarded)",
      apply: (s) => s.replace("'--write', ", ""),
      probe: (h) => !/--write/.test(fire(h, supported()).log),
    },
    {
      name: "the resolution path wrong (never finds a local prettier)",
      apply: (s) => s.replace("'node_modules', '.bin'", "'node_modules', '.binary'"),
      probe: (h) => fire(h, supported()).log === "",
    },
    {
      name: "the missing-binary guard dropped (crashes instead of no-op)",
      apply: (s) => s.replace("if (!bin) process.exit(0);", ""),
      probe: (h) => {
        const { dir, file } = fixture("no-bin-mutant.md");
        const r = fire(h, file);
        rmSync(dir, { recursive: true, force: true });
        return r.code !== 0;
      },
    },
    {
      name: "the missing-file guard dropped (formats a path that is not there)",
      apply: (s) =>
        s.replace("if (!filePath || !existsSync(filePath)) process.exit(0);", "if (!filePath) process.exit(0);"),
      probe: (h) => {
        const f = fixture("deleted-mutant.md");
        fakePrettier(f.dir, "mut");
        rmSync(f.file);
        return fire(h, f.file).log !== "";
      },
    },
    {
      name: "the walk-up stops at the file's own directory (misses a monorepo root)",
      apply: (s) => s.replace("if (parent === dir) break;", "break;"),
      probe: (h) => {
        const outer = join(root, "mut-mono");
        const inner = join(outer, "pkg");
        mkdirSync(inner, { recursive: true });
        const file = join(inner, "x.ts");
        writeFileSync(file, "const z=1\n");
        fakePrettier(outer, "OUTERMUT");
        return fire(h, file).log === "";
      },
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(
      mutated,
      src,
      `mutation "${m.name}" changed nothing — the patch is stale and this mutant proves nothing`,
    );
    const path = join(lab, `mutant-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(path, mutated);
    assert.ok(
      m.probe(path),
      `SURVIVING MUTANT — "${m.name}" and the suite still passed. Add a case for it.`,
    );
  }
}

rmSync(root, { recursive: true, force: true });
console.log(
  "prettier-on-edit.test.mjs — 5 silent paths, the --write contract, 15 file types, nearest-wins " +
    "resolution, a failing formatter tolerated, 6 mutants all killed  ✅",
);
