// Test for secret-guard.mjs — the hook that BLOCKS a hardcoded secret from being written anywhere
// except .env. Run: node .claude/hooks/secret-guard.test.mjs
//
// WHY THIS EXISTS. Until 2026-07-30 this hook had no test at all, which made it the most-trusted and
// least-verified control on the platform: it is the only mechanical thing standing between a leaked key and
// a commit, and nobody had ever proved it can still say no. A guard that has never been shown to fire is
// indistinguishable from a guard that exits 0 on everything.
//
// The hook has no exported function — it runs on import and answers with an exit code — so it is tested
// the way it is actually used: as a subprocess fed a real PreToolUse payload on stdin.
//
// Per platform/standards/testing.md §2.5 the suite does not stop at "the cases pass". It MUTATES the hook
// (removes the placeholder escape, drops a pattern, blesses every file as .env) and asserts the suite
// notices. A case list that survives a broken guard is decoration.
//
// EVERY FIXTURE IS ASSEMBLED AT RUNTIME, and that is not stylistic. The first version of this file was
// itself BLOCKED by the hook under test: writing `PASSWORD: "<a real-looking value>"` as a source literal
// is exactly what the guard exists to stop. Two things follow. (1) A guard this strict cannot have inline
// fixtures — split them, never weaken the hook or exempt `*.test.mjs`, because a real secret in a test file
// deserves the same block. (2) It confirms the assigned-literal pattern is literal-only: a value built by
// concatenation at runtime is invisible to it, so this hook is a guard against carelessness, not against
// an adversary.
//
// KNOWN LIMIT, asserted nowhere because it is out of this hook's scope: secret-guard sees Write/Edit/
// MultiEdit only. `echo <token> > file.ts` in Bash is not checked here — that surface belongs to
// autonomy-gate, whose own redirect check covers governance paths only.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "secret-guard.mjs");

/**
 * Fire a hook as a subprocess with a PreToolUse payload; return its exit code.
 *
 * HOOK_USAGE_LOG=off is not optional: `_util.mjs` records every hook run to a local counter, and a suite
 * that fires the guard ~120 times per run (19 cases × 1 real + 5 mutants) would drown the real signal in
 * test noise — the counter exists to answer "does this guard ever fire in practice".
 */
function fire(hookPath, file_path, content) {
  const payload = JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path, content },
  });
  try {
    execFileSync(process.execPath, [hookPath], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOOK_USAGE_LOG: "off" },
    });
    return 0;
  } catch (err) {
    return err.status ?? -1;
  }
}

const BLOCK = 2;
const ALLOW = 0;

// Real-SHAPED, deliberately fake, and assembled from parts (see the header). No live credential is ever
// committed to a fixture, and no fixture is a source literal the guard could legitimately object to.
const q = (s) => '"' + s + '"'; // build a quoted literal without writing one
const FAKE = {
  ghp: "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8",
  pat: "github_pat_" + "A".repeat(22) + "_" + "b".repeat(30),
  sk: "sk-ant-api03-" + "Zx9yW8vU7tS6rQ5pO4nM3lK2jI1h",
  aws: "AKIA" + "J7QK2MNPZ4RTVX9C", // exactly 16 chars after the prefix — 15 does not match, and should not
  slack: "xoxb-" + "123456789012-abcdefghijkl",
  gcp: "AIza" + "SyD1234567890abcdefghijklmnopqrstuv",
  plain: "pr0d" + "-db-value-here", // a value with no vendor prefix — only the assigned-literal rule sees it
};

/**
 * Every case as data, so the exact same list can be replayed against a MUTATED copy of the hook.
 * `id` is what the mutation report names when a mutant survives.
 */
const CASES = [
  // --- must BLOCK: a real-shaped secret in a file that is not .env -------------------------------
  {
    id: "github-pat-in-code",
    want: BLOCK,
    file: "projects/todo/lib/db.ts",
    body: "const t = " + q(FAKE.ghp),
  },
  {
    id: "fine-grained-pat",
    want: BLOCK,
    file: "a.ts",
    body: "token: " + q(FAKE.pat),
  },
  {
    id: "anthropic-key",
    want: BLOCK,
    file: "lib/ai.ts",
    body: "const key = " + q(FAKE.sk),
  },
  {
    id: "aws-key-id",
    want: BLOCK,
    file: "infra/main.tf",
    body: "access_key = " + q(FAKE.aws),
  },
  {
    id: "slack-token",
    want: BLOCK,
    file: "bot.py",
    body: "SLACK = " + q(FAKE.slack),
  },
  {
    id: "google-key",
    want: BLOCK,
    file: "app/page.tsx",
    body: "apiKey: " + q(FAKE.gcp),
  },
  {
    id: "assigned-literal",
    want: BLOCK,
    file: "docker-compose.yml",
    body: "      PASSWORD: " + q(FAKE.plain),
  },
  {
    id: "secret-in-dockerfile",
    want: BLOCK,
    file: "Dockerfile",
    body: "ENV API_KEY=" + q(FAKE.gcp),
  },
  // The `.env` string in a NAME is not a licence: only the .env family by BASENAME is sanctioned.
  {
    id: "env-lookalike-name",
    want: BLOCK,
    file: "env.example",
    body: "GITHUB_TOKEN=" + FAKE.ghp,
  },

  // --- must ALLOW: the sanctioned home, and things that only look like secrets -------------------
  {
    id: "dotenv-itself",
    want: ALLOW,
    file: "projects/todo/.env",
    body: "GITHUB_TOKEN=" + FAKE.ghp,
  },
  {
    id: "dotenv-suffixed",
    want: ALLOW,
    file: ".env.production",
    body: "OPENAI_KEY=" + FAKE.sk,
  },
  {
    id: "placeholder-your",
    want: ALLOW,
    file: "README.md",
    body: "api_key = " + q("your-api-key-here"),
  },
  {
    id: "placeholder-changeme",
    want: ALLOW,
    file: "compose.yml",
    body: "      PASSWORD: " + q("changeme-please"),
  },
  {
    id: "placeholder-example",
    want: ALLOW,
    file: "docs/00-map.md",
    body: "secret: " + q("example-value-1234"),
  },
  {
    id: "placeholder-xxxx",
    want: ALLOW,
    file: "a.ts",
    body: "token: " + q("x".repeat(16)),
  },
  {
    id: "env-var-reference",
    want: ALLOW,
    file: "docker-compose.yml",
    body: "      PASSWORD: " + q("${DB_PASSWORD}"),
  },
  {
    id: "angle-bracket-stub",
    want: ALLOW,
    file: "docs/setup.md",
    body: "client_secret: " + q("<your-client-secret>"),
  },
  {
    id: "short-value",
    want: ALLOW,
    file: "a.ts",
    body: "password = " + q("abc123"),
  },
  {
    id: "ordinary-code",
    want: ALLOW,
    file: "lib/util.ts",
    body: "export const cn = (...a) => a.join(' ');",
  },
];

/** Run every case against a hook; return the ids that answered wrongly. */
function replay(hookPath) {
  const wrong = [];
  for (const c of CASES)
    if (fire(hookPath, c.file, c.body) !== c.want) wrong.push(c.id);
  return wrong;
}

// ---------------------------------------------------------------- 1. the real hook must be correct
{
  const wrong = replay(HOOK);
  assert.deepEqual(
    wrong,
    [],
    `secret-guard answered wrongly on: ${wrong.join(", ")}`,
  );
}

// ------------------------------------- 2. the suite must NOTICE a broken guard (mutation testing)
// Each mutant is a plausible way this hook could rot. If a mutant survives, the case list above is
// too weak — the fix is a new case, never a weaker assertion.
{
  const src = readFileSync(HOOK, "utf8");
  const mutants = [
    {
      name: 'placeholder escape removed (every stub becomes a "secret")',
      apply: (s) => s.replace("!PLACEHOLDER.test(m[0])", "true"),
    },
    {
      name: "every file treated as .env (the guard never fires)",
      apply: (s) =>
        s.replace(
          "if (base === '.env' || base.startsWith('.env.'))",
          "if (true)",
        ),
    },
    {
      name: "the GitHub token pattern dropped",
      apply: (s) => s.replace("ghp_[A-Za-z0-9]", "ghpNEVERMATCH_[A-Za-z0-9]"),
    },
    {
      name: "the assigned-literal rule loosened to require 40+ chars",
      apply: (s) => s.replace("{12,}", "{40,}"),
    },
    {
      name: "block downgraded to a pass (exit 0 instead of 2)",
      apply: (s) => s.replace("process.exit(2)", "process.exit(0)"),
    },
  ];

  for (const m of mutants) {
    const mutated = m.apply(src);
    assert.notEqual(
      mutated,
      src,
      `mutation "${m.name}" did not change the source — the patch is stale`,
    );
    // A mutant imports './_util.mjs', so it must live in the hooks dir for the import to resolve.
    const p = join(
      HERE,
      `.secret-guard.mutant-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`,
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
      `SURVIVING MUTANT — "${m.name}" broke the guard and every case still passed`,
    );
  }
}

console.log(
  `secret-guard.test.mjs — ${CASES.length} cases, 5 mutants all killed  ✅`,
);
