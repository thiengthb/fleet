#!/usr/bin/env node
/**
 * tool-catalog.mjs — generate ONE page that explains every hook and script to the human supervisor.
 *
 * @vi WHAT: Sinh ra một trang duy nhất giải thích cả 29 hook + script: cái nào tự chạy, cái nào anh tự gọi,
 * nổ vào lúc nào, chặn được hay chỉ nhắc, đã có test chưa.
 * @vi WHEN: Sau khi thêm/xoá/sửa một hook hay script, chạy `--write` để cập nhật trang. Muốn kiểm trang còn
 * khớp với thực tế không thì `--check` (health-sweep gọi cái này).
 * @vi WHY: Bảng viết tay không sống được. `.claude/hooks/README.md` có đúng cái bảng này và đã thiếu 3/13
 * hook trong vòng một ngày — hai trong ba cái thiếu là loại CHẶN được lệnh ghi file. Trang này sinh từ chính
 * các file + settings.json, nên nó không thể lệch; và một công cụ chưa tự giới thiệu thì lệnh này thất bại.
 *
 * WHY THIS EXISTS. The supervisor said, verbatim, that the executable layer is "gần như bất khả thi" for them
 * to read: 29 tools, 6.8k lines, self-documented in English inside `.mjs` files with no index. The information
 * was there; an entry point was not. Their first instinct was one folder per tool with a hand-written README
 * each — refused after measuring, because 29 hand-written pages drift 29× faster than the one that already
 * drifted, and because understanding a set needs ONE page, not 29 doors. See the ## Decision block below.
 *
 * THE SPLIT, and it is the whole design. Everything a machine can know is DERIVED and never typed:
 *   - which tools exist            → walk `.claude/hooks` + `.claude/scripts`
 *   - when a hook fires            → parse `.claude/settings.json` (event + matcher), never prose
 *   - can it BLOCK or only warn    → the event it is wired to × whether the source really contains exit(2)
 *   - does it have a test          → `<name>.test.mjs` on disk (same rule `tool-check.mjs` enforces)
 *   - is it wired at all           → a hook file in no settings.json entry is dead code that looks alive
 * Only the plain-Vietnamese sentences are human-written, and they live INSIDE the tool they describe as
 * `@vi WHAT/WHEN/WHY` header tags. That is the supervisor's colocation instinct, honoured without moving a
 * single file: the description travels with the code because it IS the code's header.
 *
 * WHY THE PAGE CARRIES NO RUN COUNTS. `~/.claude/hook-usage.jsonl` is a LOCAL log (it starts empty on a new
 * machine), so putting "ran 244 times" into a committed file would make the file differ per machine and churn
 * on every regeneration. `--counts` prints them to the terminal instead, where they belong: a live reading,
 * not a fact about the repo. This keeps `--check` meaningful — the page is a pure function of tracked files.
 *
 * WHY IT IS IN VIETNAMESE, against the English-dev-artifact rule. The rule's purpose is that the AGENT's
 * working surface stays machine-agnostic; this page's only reader is the human supervisor, whose chat contract
 * is Vietnamese. Same exemption the in-app `/guide` page has, and the same pattern as a plan's Vietnamese lead
 * block. Tool names, paths and commands stay verbatim.
 *
 * SELF-REFERENCE TRAP, deliberate. This file documents the `@vi` tag format, so its own examples would be
 * parsed as tags. The parser takes FIRST occurrence per key and this file's real tags sit at the top — the
 * same "anchor on code, not on the comment that explains it" lesson as standards/testing.md §2.7.
 *
 * Usage:
 *   node .claude/scripts/tool-catalog.mjs            # print the page to stdout
 *   node .claude/scripts/tool-catalog.mjs --write     # write platform/registries/tool-catalog.md
 *   node .claude/scripts/tool-catalog.mjs --check     # exit 1 if the page is stale or a tool has no @vi WHAT
 *   node .claude/scripts/tool-catalog.mjs --counts    # add the LOCAL ran/fired reading (terminal only)
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLAUDE = join(REPO, ".claude");
const OUT = join(REPO, "platform", "registries", "tool-catalog.md");

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const COUNTS = process.argv.includes("--counts");

/* ═══════════════════════════════ 1. discover the tools ═══════════════════════════════ */

const listMjs = (dir) =>
  (existsSync(dir) ? readdirSync(dir) : [])
    .filter((n) => n.endsWith(".mjs") && !n.endsWith(".test.mjs"))
    .sort()
    .map((n) => join(dir, n));

const HOOK_DIR = join(CLAUDE, "hooks");
const SCRIPT_DIR = join(CLAUDE, "scripts");
const files = [...listMjs(HOOK_DIR), ...listMjs(SCRIPT_DIR)];

/* ═══════════════════════ 2. the @vi tags — the only hand-written part ═══════════════════════ */

const VI_KEYS = ["WHAT", "WHEN", "WHY", "RUN"];

/**
 * Read `@vi <KEY>: text` out of a tool's comment header. A following comment line that starts no new tag is
 * a continuation, so a sentence may wrap at the repo's 120-column margin. First occurrence per key wins (see
 * the self-reference note at the top).
 */
function parseVi(src) {
  const out = {};
  let key = null;
  for (const raw of src.split(/\r?\n/)) {
    const isComment = /^\s*(\/\/|\/\*|\*)/.test(raw);
    const line = raw.replace(/^\s*(\/\/+|\/\*+|\*+\/?)\s?/, "").trimEnd();
    const tag = line.match(/^@vi\s+([A-Z]+):\s*(.*)$/);
    if (tag) {
      key = VI_KEYS.includes(tag[1]) && out[tag[1]] === undefined ? tag[1] : null;
      if (key) out[key] = tag[2].trim();
      continue;
    }
    if (!key) continue;
    if (!isComment || !line.trim() || line.trim().startsWith("@")) {
      key = null;
      continue;
    }
    out[key] = `${out[key]} ${line.trim()}`.trim();
  }
  return out;
}

/* ═══════════════════════ 3. the wiring — derived from settings.json, never typed ═══════════════════════ */

/**
 * When a hook fires, in the supervisor's words rather than the harness's. An UNMAPPED event/matcher pair
 * falls through to its raw form on purpose: a blank cell would be indistinguishable from "fires nowhere",
 * which is the "no third state" failure standards/testing.md §2.5 is about.
 */
const WHEN_VI = {
  "SessionStart|": "đầu mỗi phiên làm việc",
  "Stop|": "khi tôi kết thúc một lượt trả lời",
  "PreToolUse|Edit|Write|MultiEdit": "TRƯỚC mỗi lần ghi/sửa file",
  "PreToolUse|Bash|Edit|Write|MultiEdit": "TRƯỚC mỗi lệnh Bash hoặc mỗi lần ghi file",
  "PreToolUse|AskUserQuestion": "TRƯỚC mỗi lần tôi hỏi anh một câu có lựa chọn",
  "PostToolUse|Edit|Write|MultiEdit": "NGAY SAU mỗi lần ghi/sửa file",
};

function readWiring() {
  const p = join(CLAUDE, "settings.json");
  const wired = new Map();
  if (!existsSync(p)) return wired;
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // A settings.json this script cannot parse must not silently produce "nothing is wired".
    console.error("!! .claude/settings.json không parse được — bảng wiring sẽ trống, đừng tin nó.");
    return wired;
  }
  for (const [event, groups] of Object.entries(cfg.hooks || {}))
    for (const g of groups || [])
      for (const h of g.hooks || []) {
        const m = String(h.command || "").match(/\.claude\/(hooks|scripts)\/([a-z0-9_-]+\.mjs)/);
        if (!m) continue;
        const key = `${event}|${g.matcher || ""}`;
        const entry = {
          event,
          matcher: g.matcher || "",
          when: WHEN_VI[key] || `${event} (matcher: ${g.matcher || "mọi lúc"})`,
          mapped: key in WHEN_VI,
          args: (String(h.command).match(/\.mjs"?\s+(.+)$/) || [, ""])[1].trim(),
        };
        if (!wired.has(m[2])) wired.set(m[2], []);
        wired.get(m[2]).push(entry);
      }
  return wired;
}

const wiring = readWiring();

/* ═══════════════════════ 4. build one record per tool ═══════════════════════ */

const tools = files.map((f) => {
  const name = basename(f);
  const src = readFileSync(f, "utf8");
  const vi = parseVi(src);
  const rel = relative(REPO, f).replace(/\\/g, "/");
  const wires = wiring.get(name) || [];
  const canExit2 = /exit\(2\)/.test(src);
  const isLib = name.startsWith("_");
  const events = new Set(wires.map((w) => w.event));

  // Blocking power is a property of the event it is wired to AND of the code really having an exit(2).
  // Claimed-in-prose blocking is exactly what this page refuses to repeat.
  // `--write` is the flag that makes a formatter modify a file, and it appears in exactly one hook. `writeFileSync`
  // was the obvious signal and is the wrong one: five hooks use it to drop a once-per-session marker in the temp
  // dir, which changes nothing the user owns. Measured 2026-07-30 before choosing.
  const rewritesFile = f.startsWith(HOOK_DIR) && /--write/.test(src);

  /**
   * Events where exit(2) genuinely blocks, per the hooks reference
   * (https://code.claude.com/docs/en/hooks). `PreToolUse` was the only one recognised until 2026-07-31, which
   * made this page report a BLOCKING `Stop` gate as "chỉ nhắc" — the exact class of lie the page exists to
   * prevent, on the one column the supervisor reads it for. Found by adding `verify-claim-gate.mjs` and
   * reading the generated row instead of trusting it.
   *
   * `PreToolUse` keeps its own wording because what it blocks differs: a TOOL CALL, versus the TURN ENDING.
   */
  const BLOCKING_EVENTS = new Set([
    "UserPromptSubmit",
    "UserPromptExpansion",
    "PreToolUse",
    "PermissionRequest",
    "PostToolBatch",
    "PreCompact",
    "Stop",
    "SubagentStop",
    "TaskCreated",
    "TaskCompleted",
    "TeammateIdle",
    "ConfigChange",
    "WorktreeCreate",
    "Elicitation",
    "ElicitationResult",
  ]);
  const blockingWired = [...events].filter((e) => BLOCKING_EVENTS.has(e));

  let power = "—";
  if (isLib) power = "thư viện, không tự chạy";
  else if (events.has("PreToolUse") && canExit2) power = "**CHẶN được**";
  else if (events.has("PreToolUse")) power = "cắm chỗ chặn nhưng không có exit(2)";
  else if (blockingWired.length && canExit2) power = `**CHẶN được** (${blockingWired.join(", ")})`;
  else if (rewritesFile) power = "**SỬA lại file vừa ghi**";
  else if (events.has("PostToolUse") && canExit2) power = "góp ý (không chặn)";
  // NOT relabelled: a blocking-capable event WITHOUT exit(2). The "cắm chỗ chặn nhưng không có exit(2)"
  // warning is right for `PreToolUse`, where a guard that cannot guard is a defect — but on `Stop` most hooks
  // are advisory BY DESIGN (`suggest-session-wrap` says so in its own header). Relabelling those would make
  // two correct hooks read as broken, so they stay "chỉ nhắc". Measured before choosing: the first version of
  // this fix flipped both of them.
  else if (wires.length) power = "chỉ nhắc";
  else power = "anh tự gọi";

  return {
    name,
    rel,
    vi,
    wires,
    isLib,
    power,
    // Sectioned by the DIRECTORY it lives in, not by whether it happens to be wired: `plan-audit.mjs` sits in
    // scripts/ AND is wired as a PostToolUse hook, and a reader looking for it on disk must find it where it is.
    // Its dual nature shows up as a filled "tự chạy" column instead of a second, contradictory row.
    kind: isLib ? "lib" : f.startsWith(HOOK_DIR) ? "hook" : "script",
    inHookDir: f.startsWith(HOOK_DIR),
    hasTest: existsSync(f.replace(/\.mjs$/, ".test.mjs")),
    lines: src.split(/\r?\n/).length,
    run: vi.RUN || `node ${rel}`,
  };
});

/* ═══════════════════════ 5. the findings this page can produce ═══════════════════════ */

const noWhat = tools.filter((t) => !t.vi.WHAT);
// A hook FILE in no settings.json entry is dead code that looks alive — the failure mode nothing else checks.
const orphanHooks = tools.filter((t) => t.inHookDir && !t.isLib && !t.wires.length);
const unmapped = tools.flatMap((t) => t.wires.filter((w) => !w.mapped).map((w) => `${t.name} → ${w.event}|${w.matcher}`));

/* ═══════════════════════ 6. render ═══════════════════════ */

const hooks = tools.filter((t) => t.kind === "hook").sort((a, b) => a.name.localeCompare(b.name));
const scripts = tools.filter((t) => t.kind === "script").sort((a, b) => a.name.localeCompare(b.name));
const libs = tools.filter((t) => t.kind === "lib").sort((a, b) => a.name.localeCompare(b.name));

const cell = (s) => String(s || "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const tick = (b) => (b ? "✓" : "✗");

function render() {
  const L = [];
  L.push(`# Danh mục công cụ của agent — ${tools.length} công cụ`);
  L.push("");
  L.push(
    `> **SINH TỰ ĐỘNG** bởi \`node .claude/scripts/tool-catalog.mjs --write\`. **Đừng sửa tay** — lần sinh sau ghi đè.`,
  );
  L.push(
    `> Muốn đổi phần chữ tiếng Việt: sửa dòng \`@vi WHAT/WHEN/WHY\` **ngay trong file công cụ đó**, rồi sinh lại.`,
  );
  L.push(
    `> Phần "nổ khi nào" và "chặn được" **không phải chữ ai viết** — máy đọc thẳng từ \`.claude/settings.json\``,
  );
  L.push(`> và từ chính mã nguồn, nên nó không thể nói sai về thực tế.`);
  L.push("");
  L.push(
    `Ba loại, phân biệt bằng **ai gọi nó**: hook thì tự chạy không cần anh làm gì; script thì anh (hoặc tôi) gõ lệnh;`,
  );
  L.push(`thư viện thì không tự chạy, chỉ được các file khác dùng lại.`);
  L.push("");
  L.push(`| Loại | Số lượng | Ai gọi |`);
  L.push(`| --- | --- | --- |`);
  L.push(`| Hook | ${hooks.length} | tự động, theo sự kiện |`);
  L.push(`| Script | ${scripts.length} | anh tự gọi khi cần |`);
  L.push(`| Thư viện | ${libs.length} | các file khác import |`);
  L.push("");

  L.push(`## 1. Hook — tự chạy, anh không phải gọi`);
  L.push("");
  L.push(`| Công cụ | Nổ khi nào | Nó làm gì | Quyền | Test |`);
  L.push(`| --- | --- | --- | --- | --- |`);
  for (const t of hooks)
    L.push(
      `| [\`${t.name}\`](#${anchor(t)}) | ${cell(t.wires.map((w) => w.when).join(" · "))} | ${cell(t.vi.WHAT)} | ${t.power} | ${tick(t.hasTest)} |`,
    );
  L.push("");

  L.push(`## 2. Script — anh tự gọi khi cần`);
  L.push("");
  L.push(`| Công cụ | Khi nào anh cần nó | Lệnh | Cắm làm hook? | Test |`);
  L.push(`| --- | --- | --- | --- | --- |`);
  for (const t of scripts)
    L.push(
      `| [\`${t.name}\`](#${anchor(t)}) | ${cell(t.vi.WHEN || t.vi.WHAT)} | \`${t.run}\` | ` +
        `${t.wires.length ? cell(t.wires.map((w) => w.when).join(" · ")) : "không"} | ${tick(t.hasTest)} |`,
    );
  L.push("");

  if (libs.length) {
    L.push(`## 3. Thư viện dùng chung — không tự chạy`);
    L.push("");
    L.push(`| File | Nó giữ cái gì | Test |`);
    L.push(`| --- | --- | --- |`);
    for (const t of libs) L.push(`| [\`${t.name}\`](#${anchor(t)}) | ${cell(t.vi.WHAT)} | ${tick(t.hasTest)} |`);
    L.push("");
  }

  L.push(`## 4. Chi tiết từng công cụ`);
  L.push("");
  L.push(
    `Mỗi mục dưới đây: nổ khi nào · nó làm gì · vì sao nó tồn tại · chạy tay thế nào · file test ở đâu. Phần giải`,
  );
  L.push(`thích dài bằng tiếng Anh (kèm số đo và ngày tháng) nằm ở đầu chính file đó.`);
  L.push("");
  for (const t of [...hooks, ...scripts, ...libs]) {
    const kindVi = t.kind === "hook" ? "hook" : t.kind === "lib" ? "thư viện" : "script";
    L.push(`### ${t.name}`);
    L.push("");
    // No line count on the page. It was here first, and it made the `--check` gate fire every time ANY tool was
    // edited by a line — a gate that alarms over nothing is a gate that gets muted, which is the whole lesson of
    // standards/testing.md §2.7. Size is available in the terminal via --counts, where churn costs nothing.
    L.push(`\`${t.rel}\` · ${kindVi} · test: ${t.hasTest ? `\`${basename(t.rel).replace(/\.mjs$/, ".test.mjs")}\`` : "**chưa có**"}`);
    L.push("");
    if (t.wires.length) {
      L.push(`**Nổ khi nào:** ${t.wires.map((w) => `${w.when}${w.args ? ` (\`${w.args}\`)` : ""}`).join(" · ")}`);
      L.push("");
      L.push(`**Quyền:** ${t.power}`);
      L.push("");
    } else if (t.kind === "script") {
      L.push(`**Chạy tay:** \`${t.run}\``);
      L.push("");
      if (t.vi.WHEN) {
        L.push(`**Khi nào cần:** ${t.vi.WHEN}`);
        L.push("");
      }
    }
    L.push(`**Nó làm gì:** ${t.vi.WHAT || "_(chưa có dòng `@vi WHAT` trong file — cần bổ sung)_"}`);
    L.push("");
    if (t.vi.WHY) {
      L.push(`**Vì sao có nó:** ${t.vi.WHY}`);
      L.push("");
    }
  }

  L.push(`## 5. Cái trang này tự kiểm được`);
  L.push("");
  L.push(`- \`--check\` báo lỗi nếu trang này khác với thực tế trên đĩa, hoặc có công cụ chưa có \`@vi WHAT\`.`);
  L.push(
    `- Một file hook **không được cắm** vào \`settings.json\` là mã chết trông như đang sống — \`--check\` gọi tên nó.`,
  );
  L.push(
    `- Số lần chạy/nổ thật **không nằm trong trang này** (nó là log cục bộ của từng máy, đưa vào sẽ khác nhau mỗi`,
  );
  L.push(`  máy). Xem bằng: \`node .claude/scripts/tool-catalog.mjs --counts\`.`);
  L.push("");
  return `${L.join("\n")}\n`;
}

function anchor(t) {
  return t.name.replace(/\./g, "").toLowerCase();
}

/* ═══════════════════════ 7. run ═══════════════════════ */

const page = render();

if (WRITE) {
  writeFileSync(OUT, page);
  console.log(`Đã ghi ${relative(REPO, OUT)} — ${tools.length} công cụ (${hooks.length} hook · ${scripts.length} script · ${libs.length} thư viện)`);
} else if (!CHECK) {
  process.stdout.write(page);
}

if (COUNTS) {
  const log = join(homedir(), ".claude", "hook-usage.jsonl");
  console.log(`\n── Số lần chạy thật, đọc từ ${log.replace(homedir(), "~")} (log CỦA MÁY NÀY):`);
  if (!existsSync(log)) {
    console.log("   (chưa có log — hook chưa chạy lần nào trên máy này, hoặc HOOK_USAGE_LOG=off)");
  } else {
    const ran = new Map();
    const fired = new Map();
    let bad = 0;
    for (const line of readFileSync(log, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        bad++;
        continue;
      }
      ran.set(r.hook, (ran.get(r.hook) || 0) + 1);
      if (r.code === 2) fired.set(r.hook, (fired.get(r.hook) || 0) + 1);
    }
    for (const t of [...hooks, ...scripts])
      if (ran.has(t.name))
        console.log(
          `   ${String(ran.get(t.name)).padStart(5)} lần chạy · ${String(fired.get(t.name) || 0).padStart(4)} lần nổ · ` +
            `${String(t.lines).padStart(4)} dòng   ${t.name}`,
        );
    // A line the parser could not read is neither a run nor a non-run: say so rather than average it away.
    if (bad) console.log(`   !! ${bad} dòng log không đọc được — con số trên là SÀN, không phải chính xác.`);
    const never = [...hooks].filter((t) => !ran.has(t.name)).map((t) => t.name);
    if (never.length) console.log(`   Chưa thấy chạy lần nào trên máy này: ${never.join(", ")}`);
  }
}

if (CHECK) {
  let fail = 0;
  const onDisk = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  if (onDisk === null) {
    console.log(`✗ chưa có ${relative(REPO, OUT)} — chạy \`--write\``);
    fail = 1;
  } else if (onDisk !== page) {
    console.log(`✗ ${relative(REPO, OUT)} đã lệch so với thực tế — chạy \`--write\` để sinh lại`);
    fail = 1;
  }
  if (noWhat.length) {
    console.log(`✗ ${noWhat.length} công cụ chưa tự giới thiệu (thiếu dòng \`@vi WHAT:\` trong header):`);
    for (const t of noWhat) console.log(`     ${t.rel}`);
    fail = 1;
  }
  if (orphanHooks.length) {
    console.log(`?? ${orphanHooks.length} hook có file nhưng KHÔNG được cắm vào settings.json (mã chết trông như sống):`);
    for (const t of orphanHooks) console.log(`     ${t.rel}`);
  }
  if (unmapped.length) {
    console.log(`?? ${unmapped.length} cặp event/matcher chưa có bản dịch tiếng Việt (bảng sẽ in dạng thô):`);
    for (const u of unmapped) console.log(`     ${u}`);
  }
  if (!fail) console.log(`ok  ${relative(REPO, OUT)} khớp thực tế · ${tools.length} công cụ, tất cả đã tự giới thiệu`);
  process.exit(fail);
}
