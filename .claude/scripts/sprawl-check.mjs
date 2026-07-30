#!/usr/bin/env node
// @vi WHAT: Cái phanh chống phình. Nó KHÔNG đo lại gì — nó đọc số của `usage-census` rồi áp một luật có ngưỡng:
//   số món "chưa ai dùng" trong mỗi tầng CHỈ được phép giảm, không được tăng. Và nó liệt kê món nào đã đủ điều
//   kiện nghỉ hưu theo hai con số (không ai dùng VÀ gần như không file nào trỏ tới).
// @vi WHEN: Trước khi định thêm một skill/script/hook/tài liệu mới. Và tự động hằng tuần trong health-sweep.
// @vi WHY: Đo 2026-07-31: 17/38 skill và 66/134 file tri thức chưa ai dùng lần nào, `commons` có 27 món và 0 lần
//   được cài. Thêm máy móc vào lúc một nửa máy móc đang nằm không chính là định nghĩa của over-engineering. Nhưng
//   một cổng đỏ ngay ngày đầu thì sẽ bị tắt — nên nó chốt mức HÔM NAY làm mốc và chỉ nổ khi con số TĂNG. Nó không
//   bao giờ tự xoá: xoá là việc của người, qua `attic.mjs`.
//
/**
 * sprawl-check.mjs — the brake. Report-only by default; `--gate` fails a run when sprawl grew.
 *
 * WHY THIS EXISTS. The platform can measure itself (`usage-census`, `skill-audit`, `tool-check`, `link-check`) and
 * it can retire safely (`attic`), but nothing connected the two with a THRESHOLD. So "is this platform still
 * earning its keep?" stayed a matter of opinion, and opinion always answers yes about work one just did.
 *
 * WHAT IT DELIBERATELY IS NOT. Not a new measurement. It spawns `usage-census --json` and judges those numbers;
 * if the census is wrong, this is wrong, and that is the correct coupling — one place counts, one place decides.
 * Building a second counter would be the very sprawl it exists to slow.
 *
 * THE RULE, and where each number comes from (external, not invented here):
 *
 *  1. RETIREMENT ELIGIBILITY — adapted from LaunchDarkly's stale-flag rule, which is the most concrete published
 *     "this is safe to remove" test: created ≥30 days ago AND inactive AND not requested recently.
 *     https://launchdarkly.com/docs/home/releases/flag-health
 *     Adapted, and made STRICTER in the one direction that matters here: an item qualifies only when it has zero
 *     recorded use across ALL history (not merely 7 quiet days) AND at most one inbound link. The second number
 *     is the platform's own hard-won rule — on 2026-07-29 "no script reads it" was taken as proof nobody reads
 *     it, and the day-log tier it condemned turned out to be read 93 times.
 *
 *  2. THE RATCHET — the unused count per tier may only go DOWN. Chrome's feature-deprecation study is the only
 *     source found that puts a real number on "safe to remove" (usage under ~0.01% of page loads, a knee found
 *     in the actual usage distribution rather than chosen by taste):
 *     https://arianamirian.com/docs/icse2019_deprecation.pdf (Mirian et al., ICSE 2019 SEIP)
 *     That threshold cannot be ported literally — this repo has one user, so every share is either 0% or huge.
 *     What ports is the DISCIPLINE: a numeric line, declared in advance, checked automatically. Hence baselines
 *     below, stamped with the date they were measured, and a gate that fires only on an increase.
 *
 *  3. WHY NOT A HARD BLOCK ON NEW TOOLS. Adoption failure is the documented way guardrails die: "aggressive
 *     patterns block legitimate operations, causing users to disable guardrails entirely." A brake that refuses
 *     a legitimately-needed new script would be switched off within a week, and then it brakes nothing. So this
 *     reports, ratchets, and names what to retire first — it never refuses a creation.
 *
 * WHAT THE FIRST RUN ALREADY SHOWS, recorded here because it changes how the output should be read: 17 of 38
 * skills have never been used, and ZERO of them are retirement-eligible, because every one is linked from two or
 * more registry files. The two-number rule is doing its job — it is refusing to condemn things on one signal. So
 * the value of this tool is mostly the ratchet, not the retirement list, and the honest read of a small
 * eligibility list is "nothing is safe to cut yet", not "nothing is wrong".
 *
 * Usage:
 *   node .claude/scripts/sprawl-check.mjs            # the report
 *   node .claude/scripts/sprawl-check.mjs --gate      # exit 1 if any tier's unused count rose above its baseline
 *   node .claude/scripts/sprawl-check.mjs --json
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GATE = process.argv.includes("--gate");
const AS_JSON = process.argv.includes("--json");

/**
 * The line, declared in advance so it cannot be moved after seeing a result. `unused` is the number of items in
 * that tier with zero recorded use; the gate fires when today's count EXCEEDS it. Lower a baseline in the same
 * commit that retires something — never raise one to make a run green.
 */
const BASELINE = {
  // PER MACHINE, and that is not bookkeeping — it is the difference between a brake and a false alarm. The
  // numbers come from `usage-census`, which mines the transcripts of the box it runs on: this fleet's Linux box
  // has ~70 recorded sessions and the Windows box 9, so the same tree legitimately reads 15 idle skills on one
  // and 22 on the other. Measured 2026-07-31, the single shared baseline made the Windows box report three
  // tiers "RISING" on its very first run — a brake whose first act is to cry wolf is a brake that gets ignored,
  // which is the adoption failure documented in reason 3 above.
  //
  // Read from this tool's own `--json` on the machine in question, not eyeballed. The first draft of the Linux
  // numbers used the raw unused count (66/17/9/3/0), which is 2–9x looser than reality and would have made the
  // gate unfireable — a baseline set above the true value is a gate that is green forever, the most comfortable
  // way for a check to be useless.
  "thien-ubuntu": {
    measured: "2026-07-31",
    skill: 15,
    knowledge: 7,
    script: 0,
    hook: 0,
    other: 0,
  },
  "TNT-Laptop": {
    measured: "2026-07-31",
    skill: 22,
    knowledge: 11,
    script: 0,
    hook: 2,
    other: 0,
  },
};

/** Same shape as the health-sweep log's column, so a human reads one identity across both. */
const MACHINE = (hostname() || "unknown").replace(/[|\s]+/g, "-").slice(0, 24);
/**
 * This machine's line, or null. A box with no declared baseline is NOT green: nothing is being ratcheted there,
 * and saying "ok" would be the silent-gap failure this platform keeps catching (see `tool-check`'s EXEMPT list,
 * whose whole point is that a declared gap can be argued with and a silent one cannot). So the run says so out
 * loud and fails `--gate` until someone records the line.
 */
const MINE = BASELINE[MACHINE] ?? null;

const MIN_AGE_DAYS = 30; // LaunchDarkly's age condition; a thing built last week has not had its chance yet.
const MAX_LINKS_TO_RETIRE = 1; // the second number — one pointer is a mention, two is a dependency.

/**
 * Tiers where "never explicitly opened" is the NORMAL, HEALTHY state, so a zero-use reading carries no
 * information about worth. Excluded from eligibility entirely — and each with the reason written down, because
 * an exclusion nobody can read is indistinguishable from a blind spot.
 *
 * This list exists because the first run of this script proposed retiring FIVE memory files, among them
 * `never-print-secret-file-contents` — a rule that is actively obeyed. `usage-census`'s own LIMITS block already
 * says it in words: "MEMORY FILES: 0 here means 'never explicitly opened', NOT 'never used'... Never retire a
 * memory on this number alone." A brake whose first suggestion is to delete a live safety rule would have been
 * switched off immediately, and rightly.
 */
const NEVER_ELIGIBLE = [
  {
    prefix: ".claude/memory/",
    reason:
      "a memory is injected as a system-reminder, which is not a tool call and is not mined — zero use here " +
      "means 'never explicitly opened', not 'never used'. usage-census states this outright.",
  },
  {
    prefix: "platform/log/",
    reason:
      "the recall tier: dated raw records, never auto-loaded by design. A log entry from June is not stale, it " +
      "is history, and its value is being there on the day someone asks what happened.",
  },
  {
    prefix: "platform/ledger/",
    reason: "the archive half of the knowledge ledger — written once, read by anchor from the index.",
  },
  { prefix: "platform/reports/", reason: "dated snapshots; a report's whole purpose is to be superseded, not re-read." },
  { prefix: "platform/attic/", reason: "already staged for retirement — counting it again would double-count." },
];

const exclusion = (p) => NEVER_ELIGIBLE.find((x) => p.startsWith(x.prefix));

/* ─────────────────────────── the census, spawned, never re-implemented ─────────────────────────── */

const census = spawnSync(process.execPath, [join(REPO, ".claude", "scripts", "usage-census.mjs"), "--json"], {
  cwd: REPO,
  encoding: "utf8",
  timeout: 180_000,
  env: { ...process.env, HOOK_USAGE_LOG: "off" },
});

let rows;
try {
  rows = JSON.parse(census.stdout || "").rows;
  if (!Array.isArray(rows)) throw new Error("no rows array");
} catch (e) {
  // A census this script cannot read is a THIRD state. Reporting "0 unused, all clear" here would be the
  // instrument failure standards/testing.md §2.5 is about: a clean number produced by a check that never ran.
  console.log(`!! usage-census --json không đọc được (${e.message}) — KHÔNG có kết luận nào ở đây.`);
  console.log(`   exit=${census.status}. Chạy tay: node .claude/scripts/usage-census.mjs --json`);
  process.exit(1);
}

/* ─────────────────────────── how old is each file, in one git pass ─────────────────────────── */

/**
 * First-commit date per path, from ONE `git log` walk. A per-file git call would be 240 subprocesses; and file
 * mtime is not age (a reformat resets it), which would make freshly-touched dead weight look new forever.
 */
function addedAt() {
  const r = spawnSync("git", ["log", "--diff-filter=A", "--format=%at", "--name-only", "--no-renames"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });
  const map = new Map();
  let ts = null;
  for (const line of (r.stdout || "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^\d{9,}$/.test(t)) {
      ts = Number(t) * 1000;
      continue;
    }
    if (ts !== null) map.set(t, Math.min(map.get(t) ?? Infinity, ts)); // keep the EARLIEST add for a path
  }

  /**
   * Roll file dates up to their directories. `usage-census` reports a SKILL as a directory
   * (`.claude/skills/mcp-builder`), and `git log --name-only` only ever names files — so without this every
   * skill's age came back "unknown", every skill failed the maturity test, and the whole tier with the largest
   * sprawl (17 of 38 unused) was silently invisible to the brake. Found by reading the table, not by any error:
   * the column simply said 0. A directory's age is its OLDEST file.
   */
  for (const [file, ts] of [...map]) {
    const parts = file.split("/");
    for (let i = parts.length - 1; i > 0; i--) {
      const dir = parts.slice(0, i).join("/");
      map.set(dir, Math.min(map.get(dir) ?? Infinity, ts));
    }
  }
  return map;
}

const added = addedAt();
const now = Date.now();
const ageDays = (p) => {
  const t = added.get(p);
  return t === undefined ? null : Math.floor((now - t) / 86_400_000);
};

/* ─────────────────────────── judge ─────────────────────────── */

const unusedRow = (r) => (r.total || 0) === 0 && (r.runs || 0) === 0;

const tiers = new Map();
for (const r of rows) {
  const t = tiers.get(r.kind) || { kind: r.kind, n: 0, unused: [], mature: [], eligible: [], excluded: 0 };
  t.n++;
  if (unusedRow(r)) {
    t.unused.push(r);
    const age = ageDays(r.path);
    // `age === null` means git has no add-commit for it — uncommitted or ignored. NOT silently treated as old:
    // an unknown age must never satisfy an age condition (the `null < 30` coercion trap recorded 2026-07-30).
    if (age !== null && age >= MIN_AGE_DAYS) {
      // THE RATCHET COUNTS MATURE NON-ADOPTION, not newness. Its first run tripped on `script: 3 → 4` because
      // this very file had just been created and had, tautologically, never been used. A brake that fires the
      // moment anything is added measures activity, not sprawl — and it would be muted within a day. What is
      // worth catching is a thing that has sat unused for a MONTH.
      t.mature.push({ ...r, ageDays: age });
      const ex = exclusion(r.path);
      if (ex) t.excluded++;
      else if ((r.links || 0) <= MAX_LINKS_TO_RETIRE) t.eligible.push({ ...r, ageDays: age });
    }
  }
  tiers.set(r.kind, t);
}

const report = [...tiers.values()]
  .map((t) => {
    const base = MINE ? MINE[t.kind] : undefined;
    return {
      kind: t.kind,
      total: t.n,
      unused: t.unused.length,
      mature: t.mature.length,
      excluded: t.excluded,
      baseline: base ?? null,
      rose: base === undefined ? false : t.mature.length > base,
      delta: base === undefined ? null : t.mature.length - base,
      eligible: t.eligible.sort((a, b) => b.ageDays - a.ageDays),
    };
  })
  .sort((a, b) => b.mature - a.mature);

const rising = report.filter((t) => t.rose);
const untracked = report.filter((t) => t.baseline === null);

if (AS_JSON) {
  console.log(JSON.stringify({ baseline: BASELINE, minAgeDays: MIN_AGE_DAYS, tiers: report }, null, 2));
  process.exit((rising.length || !MINE) && GATE ? 1 : 0);
}

console.log(
  `\nsprawl-check — cái phanh. Máy \`${MACHINE}\`, mốc chốt ngày ${MINE ? MINE.measured : "(chưa có)"}; ` +
    `số "chưa dùng" chỉ được phép GIẢM.\n`,
);
console.log(
  `  Cột "nằm không ≥${MIN_AGE_DAYS}d" là cột được canh: một món vừa thêm hôm nay thì đương nhiên chưa ai dùng,\n` +
    `  cái đáng bắt là món đã nằm không suốt một tháng.\n`,
);
console.log(
  `  ${"tầng".padEnd(11)}${"tổng".padStart(6)}${"chưa dùng".padStart(11)}${`nằm không ≥${MIN_AGE_DAYS}d`.padStart(16)}${"mốc".padStart(6)}${"chênh".padStart(7)}${"nên bỏ".padStart(8)}${"miễn xét".padStart(10)}`,
);
for (const t of report) {
  const d = t.delta === null ? "  —  " : t.delta > 0 ? `+${t.delta}` : `${t.delta}`;
  const mark = t.rose ? "  ← TĂNG" : "";
  console.log(
    `  ${t.kind.padEnd(11)}${String(t.total).padStart(6)}${String(t.unused).padStart(11)}${String(t.mature).padStart(16)}` +
      `${String(t.baseline ?? "—").padStart(6)}${d.padStart(7)}${String(t.eligible.length).padStart(8)}${String(t.excluded).padStart(10)}${mark}`,
  );
}
const totalExcluded = report.reduce((n, t) => n + t.excluded, 0);
if (totalExcluded)
  console.log(
    `\n  ${totalExcluded} món nằm không nhưng MIỄN XÉT — với chúng, "chưa ai mở" là trạng thái bình thường:\n` +
      NEVER_ELIGIBLE.map((x) => `    ${x.prefix.padEnd(20)} ${x.reason}`).join("\n"),
  );

const allEligible = report.flatMap((t) => t.eligible.map((e) => ({ ...e, kind: t.kind })));
if (allEligible.length) {
  console.log(
    `\nĐỦ ĐIỀU KIỆN NGHỈ HƯU (${allEligible.length}) — hai con số đều thấp: chưa ai dùng VÀ ≤${MAX_LINKS_TO_RETIRE} file trỏ tới,`,
  );
  console.log(`và đã tồn tại ≥${MIN_AGE_DAYS} ngày. Đây là DANH SÁCH ĐỀ NGHỊ, không phải lệnh xoá:`);
  console.log(`  ${"tuổi".padStart(6)}${"liên kết".padStart(10)}${"dòng".padStart(7)}   file`);
  for (const e of allEligible.slice(0, 25))
    console.log(
      `  ${String(e.ageDays + "d").padStart(6)}${String(e.links || 0).padStart(10)}${String(e.lines || 0).padStart(7)}   ${e.path}`,
    );
  if (allEligible.length > 25) console.log(`  … còn ${allEligible.length - 25} món nữa (dùng --json để xem hết)`);
  console.log(`\n  Cách bỏ: node .claude/scripts/attic.mjs — nó dàn ra chờ, KHÔNG xoá. Người xoá, không phải máy.`);
} else {
  console.log(`\nKhông món nào đủ điều kiện nghỉ hưu. Đọc đúng: "chưa có gì an toàn để cắt", KHÔNG phải "không có vấn đề".`);
}

if (untracked.length)
  console.log(`\n?? ${untracked.length} tầng chưa có mốc trong BASELINE (${untracked.map((t) => t.kind).join(", ")}) — thêm vào để nó được canh.`);

console.log(
  `\n  ĐỌC TRƯỚC KHI CẮT: "chưa dùng" ≠ vô giá trị. Một runbook hay một bài diễn tập phục hồi kiếm chỗ đứng vào\n` +
    `  ngày nó được cần, không phải bằng việc được đọc thường xuyên. Số ở đây là SÀN, không phải trần (usage-census\n` +
    `  chỉ nhìn thấy 9 phiên và không thấy hook chạy). Đừng bao giờ bỏ một thứ chỉ vì một con số.`,
);

if (rising.length) {
  console.log(
    `\n✗ PHANH ĂN: ${rising.length} tầng có số "chưa dùng" TĂNG so với mốc ${MINE.measured} (máy ${MACHINE}):`,
  );
  // `mature`, NOT `unused`: mature (idle ≥ 30 days) is the column the gate actually compares. Printing the raw
  // unused count beside a delta computed from mature produced arithmetic that does not add up —
  // `skill: 15 → 30 (+7)` — which sends the reader after the wrong number.
  for (const t of rising) console.log(`     ${t.kind}: ${t.baseline} → ${t.mature} (+${t.delta})`);
  console.log(
    `   Trước khi thêm món mới ở tầng này, cho một món cũ nghỉ hưu — hoặc dùng thứ vừa thêm rồi hạ mốc\n` +
      `   trong CÙNG commit. Nâng mốc để cho qua là cách cơ chế này chết.`,
  );
} else if (!MINE) {
  console.log(
    `\n✗ CHƯA CÓ MỐC cho máy \`${MACHINE}\` — ở đây cái phanh KHÔNG canh gì cả.\n` +
      `   Chạy \`--json\` trên máy này, lấy cột "nằm không ≥${MIN_AGE_DAYS}d" của từng tầng, rồi thêm một khối\n` +
      `   \`"${MACHINE}": { measured: "<hôm nay>", ... }\` vào BASELINE. Số của máy khác KHÔNG dùng được ở đây:\n` +
      `   usage-census chỉ đọc transcript của máy đang chạy, nên hai máy có hai con số đúng khác nhau.`,
  );
} else {
  console.log(`\nok  không tầng nào phình thêm so với mốc ${MINE.measured} (máy ${MACHINE}).`);
}

process.exit((rising.length || !MINE) && GATE ? 1 : 0);
