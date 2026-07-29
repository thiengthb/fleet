// Test for invariant-warn.mjs — the advisory net over the three most damaging NUC invariants
// (Cloudflare-only TLS, no self-hosted CI runner, apps never publish host ports).
// Run: node .claude/hooks/invariant-warn.test.mjs
//
// WHY THIS EXISTS. CLAUDE.md says these three are "enforced in code by invariant-warn.mjs, not by memory".
// That sentence was true about the wiring and unproven about the behaviour: the hook had no test, so the
// platform's own claim of enforcement rested on nobody having broken it yet.
//
// Two things make this hook easy to get wrong, and both are asserted below:
//   - it reads the file FROM DISK (PostToolUse — the write already happened), so a path that does not
//     exist must exit 0 quietly rather than throw; and
//   - it must stay quiet on DOCUMENTATION. Every one of these invariants is discussed in prose in
//     platform/, and a hook that warns about the sentence describing the rule is a hook that gets muted.
//
// Per platform/standards/testing.md §2.5 the suite also MUTATES the hook and asserts it notices.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  writeFileSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "invariant-warn.mjs");
const WARN = 2; // PostToolUse: exit 2 = feedback to Claude (cannot block, the write already landed)
const QUIET = 0;

const root = mkdtempSync(join(tmpdir(), "invariant-warn-"));

/** Write a fixture at a repo-relative path inside the temp root, then fire the hook on it. */
function fire(hookPath, relPath, body) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  const payload = JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: abs },
  });
  try {
    execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      // Never let the suite pollute the hook-usage counter (see _util.mjs — usage recording).
      env: { ...process.env, HOOK_USAGE_LOG: "off" },
    });
    return QUIET;
  } catch (err) {
    return err.status ?? -1;
  }
}

const PORTS = [
  "services:",
  "  app:",
  "    image: x",
  "    ports:",
  '      - "3000:3000"',
].join("\n");

const CASES = [
  // --- must WARN ---------------------------------------------------------------------------------
  {
    id: "certbot-in-compose",
    want: WARN,
    file: "projects/todo/docker-compose.yml",
    body: "services:\n  certbot:\n    image: certbot/certbot\n",
  },
  {
    id: "letsencrypt-in-dockerfile",
    want: WARN,
    file: "projects/todo/Dockerfile",
    body: "FROM node:22\nRUN certbot certonly --standalone\n",
  },
  {
    id: "acme-in-yaml",
    want: WARN,
    file: "infra/traefik-dynamic.yaml",
    body: "tls:\n  acme.email: a@b.c\n",
  },
  {
    id: "self-hosted-runner",
    want: WARN,
    file: ".github/workflows/deploy.yml",
    body: "jobs:\n  build:\n    runs-on: self-hosted\n",
  },
  {
    id: "self-hosted-runner-array",
    want: WARN,
    file: ".github/workflows/ci.yml",
    body: "jobs:\n  b:\n    runs-on: [self-hosted, linux]\n",
  },
  {
    id: "app-publishes-ports",
    want: WARN,
    file: "projects/journal/docker-compose.yml",
    body: PORTS,
  },

  // --- must stay QUIET --------------------------------------------------------------------------
  // Documentation discusses every one of these rules by name. Warning here is how a hook gets muted.
  {
    id: "prose-about-certbot",
    want: QUIET,
    file: "platform/targets/nuc/README.md",
    body: "TLS is Cloudflare-only — never certbot/letsencrypt/acme.\n",
  },
  {
    id: "prose-about-self-hosted",
    want: QUIET,
    file: "docs/00-map.md",
    body: "CI must not use `runs-on: self-hosted`.\n",
  },
  // The reverse-proxy's OWN compose is the one thing that MUST publish 80/443.
  {
    id: "traefik-compose-may-publish",
    want: QUIET,
    file: "infra/traefik/docker-compose.yml",
    body: PORTS,
  },
  {
    id: "compose-without-ports",
    want: QUIET,
    file: "projects/todo/docker-compose.yml",
    body: "services:\n  app:\n    image: x\n",
  },
  {
    id: "ordinary-code",
    want: QUIET,
    file: "projects/todo/lib/db.ts",
    body: "export const db = 1;\n",
  },
  {
    id: "workflow-with-github-runner",
    want: QUIET,
    file: ".github/workflows/deploy.yml",
    body: "jobs:\n  b:\n    runs-on: ubuntu-latest\n",
  },
];

function replay(hookPath) {
  const wrong = [];
  for (const c of CASES)
    if (fire(hookPath, c.file, c.body) !== c.want) wrong.push(c.id);
  return wrong;
}

// ------------------------------------------------------- 1. the real hook must answer correctly
{
  const wrong = replay(HOOK);
  assert.deepEqual(
    wrong,
    [],
    `invariant-warn answered wrongly on: ${wrong.join(", ")}`,
  );
}

// ---------------------------- 2. a file that no longer exists must be silent, not an exception
{
  const payload = JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: join(root, "gone/nowhere.yml") },
  });
  let code = -1;
  try {
    execFileSync(process.execPath, [HOOK], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
    });
    code = 0;
  } catch (err) {
    code = err.status ?? -1;
  }
  assert.equal(
    code,
    QUIET,
    "a missing file must exit 0 — a PostToolUse hook that throws is noise on every delete",
  );
}

// --------------------------------------------- 3. the suite must NOTICE a broken net (mutation)
{
  const src = readFileSync(HOOK, "utf8");
  const mutants = [
    {
      name: "the doc exemption swallows everything",
      apply: (s) => s.replace("const isDoc = ", "const isDoc = true || "),
    },
    {
      name: "the certbot rule dropped",
      apply: (s) =>
        s.replace("certbot|letsencrypt|acme\\.", "NEVERMATCHcertbot"),
    },
    {
      name: "the self-hosted runner rule dropped",
      apply: (s) =>
        s.replace("runs-on:\\s*\\[?\\s*['\"]?self-hosted", "NEVERMATCHrunner"),
    },
    {
      name: "the published-ports rule dropped",
      apply: (s) => s.replace("^\\s*ports:\\s*$", "NEVERMATCHports"),
    },
    {
      name: "the traefik exemption widened to every compose",
      apply: (s) => s.replace("/(infra|traefik)/.test(lower)", "true"),
    },
    {
      name: "feedback downgraded to silence",
      apply: (s) =>
        s.replace(
          "process.exit(2); // PostToolUse",
          "process.exit(0); // PostToolUse",
        ),
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(
      mutated,
      src,
      `mutation "${m.name}" did not change the source — the patch is stale`,
    );
    const p = join(
      HERE,
      `.invariant-warn.mutant-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`,
    );
    writeFileSync(p, mutated);
    let killed;
    try {
      killed = replay(p);
    } finally {
      try {
        unlinkSync(p);
      } catch {
        /* nothing to clean up */
      }
    }
    assert.ok(
      killed.length > 0,
      `SURVIVING MUTANT — "${m.name}" broke the net and every case still passed`,
    );
  }
}

rmSync(root, { recursive: true, force: true });
console.log(
  `invariant-warn.test.mjs — ${CASES.length} cases + missing-file case, 6 mutants all killed  ✅`,
);
