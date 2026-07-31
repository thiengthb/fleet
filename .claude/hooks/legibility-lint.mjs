// @vi WHAT: Nó kiểm chính cách tôi nói với anh: danh sách lựa chọn phải có cái được khuyến nghị, và thuật ngữ phải có một câu
//   giải thích thường ngày đi kèm.
// @vi WHY: Luật này đã tồn tại ở hai chỗ (CLAUDE.md và một file ký ức) mà vẫn bị vi phạm — vì anh không phản đối, anh chỉ
//   lặng lẽ ngừng đọc theo. Nên nó thành cái gác, thay vì thành một lời nhắc thứ ba.
//
// Legibility lint — the durable half of idea-0025.
// Proposal: platform/plans/2026-07-29-idea-0025-legible-reporting-proposal.md (accepted 2026-07-29, Option A).
//
// WHY THIS IS A HOOK AND NOT A BETTER-WORDED REMINDER
// ───────────────────────────────────────────────────────────────────────────────────────────────
// The rule already existed twice — CLAUDE.md §Conventions ("Legible decision surface") and the memory file
// `legible-proposals-plain-language.md` (since 2026-06-16) — and was broken repeatedly by its own
// author in the session that produced the complaint. The research says that is structural, not
// sloppy: the curse-of-knowledge literature finds that experts misread their own fluency as the
// topic being simple, and that the bias **survives being warned about it**. A self-check cannot fix
// a bias that specifically defeats self-checking. So it is checked from outside.
//
// WHAT THIS DELIBERATELY DOES NOT DO
// ───────────────────────────────────────────────────────────────────────────────────────────────
// It does not score writing for readability. Length and grade-level formulas (Flesch-Kincaid and
// relatives) were built for children's schoolbooks, ignore reader background, and measure countable
// features rather than comprehension — the plain-language field abandoned them in the late 1970s in
// favour of usability testing. Scoring my prose would measure something real and irrelevant.
//
// What IS checkable is an enumerable defect: **an internal term used with no plain-language gloss.**
// That is a closed-vocabulary lint, the same shape as the rulebook's icon rule — not a readability
// score. Its honest limit is stated in the proposal: a jargon-free report can still be
// incomprehensible, and a term only joins the list after it has already confused someone once.
//
// SURFACES (Microsoft HAX: the right control differs by WHEN it applies)
//   PreToolUse · AskUserQuestion → the decision moment. Blocks only on the one rule CLAUDE.md
//                                  already makes mandatory and nothing enforced: exactly one
//                                  option marked (khuyến nghị).
//   Stop                         → the last message of a turn, which is what actually gets read.
//                                  WARNS ONLY. It must never block; a gate that obstructs the
//                                  conversation gets switched off, and then it protects nothing.

import { readPayload, declareFailMode } from './_util.mjs';

// Fail-open and REPORTED. It grades how I phrase things; a broken linter must never be able to block a question to
// the user or the end of a turn. Exit 1 allows and reports.
declareFailMode(1, 'The legibility check did not run, so verify by hand that any option list names a recommendation and that jargon carries a plain gloss.');

/**
 * The seed vocabulary, taken from the terms actually used on the supervisor on 2026-07-29 without
 * explanation — not from a general list of technical words. Each entry carries the plain-language
 * phrasing to use instead, because a warning that only says "too jargony" reproduces the problem.
 *
 * GROWTH RULE (reactive by design, and that limit is acknowledged): a term joins this list the turn
 * the supervisor says he does not follow it. It is not meant to be exhaustive.
 *
 * MEASURED FIRING RATE, and a correction to this file's own first draft. That draft said "if it
 * fires more than roughly once a session, the list is too broad and should SHRINK". Replaying the
 * check over 43 deduped real reports says otherwise: it fires 16 times — about 4 to 8 distinct terms
 * in a working session, 0 in a light one. **Every one of those was a true positive.** `mutant`,
 * `thin-slice`, `backflow`, `RICE`, `exploration floor`, `Reflexion`, `idempotent`, `wildcard`,
 * `oracle` are all genuinely opaque to the reader they were aimed at.
 *
 * So the "once a session" number was a guess made before the data, and shrinking the list to meet it
 * would be weakening a rule to get a green light — the exact move the rulebook forbids. The rate
 * measures the AGENT'S PROSE, not this check's accuracy, and it falls to zero by writing
 * differently. What was fixed instead is repetition: a term is introduced ONCE per session (see
 * `lintReport`), which cut 16 warnings to 12 without hiding a single distinct defect. SHRINK the
 * list only for a term that fires on prose he would have understood anyway.
 */
export const TERMS = [
  [/\bRICE\b/, 'điểm ưu tiên tính từ: bao nhiêu người dùng × lợi ích × độ chắc chắn ÷ công sức'],
  [/\bWIP cap\b/i, 'giới hạn số việc được mở cùng lúc'],
  [/\bexploration floor\b/i, 'suất bắt buộc cho một ý tưởng lạ, để không chỉ toàn làm việc quen'],
  [/\bwildcard\b/i, 'ý tưởng lạ được đưa vào có chủ đích'],
  [/\bT[1-4]\b/, 'mức rủi ro của hành động (T1 đọc → T4 không hoàn tác được)'],
  [/\bP[1-3]\b/, 'mức "việc này to cỡ nào" (P1 nhỏ → P3 lớn/khó sửa)'],
  [/propose-don'?t-execute/i, 'tôi đề xuất, bạn quyết — tôi không tự làm'],
  [/\btier[- ]2\b/i, 'nhóm luật máy kiểm được'],
  [/\bMoSCoW\b/i, 'phân loại phải-có / nên-có / có thì tốt'],
  [/\boracle\b/i, 'người đưa ra phán quyết đúng-sai cuối cùng (là bạn)'],
  [/\bReflexion\b/, 'ghi lại phán quyết cũ để lần sau đề xuất khác đi'],
  [/\bpre-?mortem\b/i, 'liệt kê trước các cách việc này có thể hỏng'],
  [/\bmutation testing\b|\bmutant\b/i, 'cố tình làm hỏng code để xem test có bắt không'],
  [/\bthin[- ]slice\b/i, 'làm một lát mỏng chạy được từ đầu đến cuối trước'],
  [/\bbackflow\b/i, 'đường để bài học chảy ngược về kho tri thức'],
  [/\bshingle\b/i, 'cụm 6 từ liên tiếp, dùng để dò trùng văn bản'],
  [/\bidempotent\b/i, 'chạy lại nhiều lần vẫn ra cùng kết quả'],
];

/**
 * The SECOND defect, added 2026-07-29 after idea-0026's measurement pass — and the measurement is
 * the reason this rule exists in this shape rather than another.
 *
 * The pass began by proposing to shrink the machinery on disk (31 plan files, 1 of them live). That
 * was refuted by checking it: the closed plans nag nobody (`plan-checkin` already skips them, and
 * only 3 plans carry a `checkin:` date — all open), while moving them would break **63 files** that
 * reference them by name. The machinery on disk is quiet.
 *
 * What is NOT quiet is how much of it gets named out loud. Across the three real transcripts of
 * 2026-07-29 the median turn-ending report named **1** artefact, p75 was 2, p90 was 4 — and the
 * worst named **9**. Those outliers are the sessions he stopped following.
 */
export const NAMED_ARTEFACT =
  /idea-\d{4}|platform\/[a-z-]+\/[\w.@-]+\.(?:md|mjs|json|sh)|\.claude\/[\w./@-]+|docs\/[\w./-]+\.md|(?<![\w/-])\/[a-z][a-z-]{2,}(?![\w/-])/g;

/**
 * BOOKKEEPING the supervisor never opens — named 10 times in one session, and not once did he need
 * to act on any of them.
 *
 * This came out of classifying all 31 names from the 2026-07-29 session by what he had to DO with
 * them: type it (`/exit`, `/plugin`, a `cp` line), decide about it (an `idea-00NN` under discussion),
 * or open it. The paths below are none of those — they are where the agent files its own records
 * afterwards. Naming them spends his attention to describe filing.
 *
 * NOTE the deletion this replaced. The first instinct was to delete a tier: `platform/log/` is 29
 * files and 392 KB, no hook or script reads it, and it is written at every wrap — a textbook
 * write-only artefact. Counting tool calls across every transcript refuted it: **93 reads against
 * 20 writes.** It is consulted more than it is produced. So the machinery stays and the NARRATION
 * of it goes; that is the whole finding of idea-0026 in one line.
 */
export const BOOKKEEPING =
  /platform\/log\/|platform\/ledger\/|docs\/decisions(?:\.md|\/)|docs\/00-map\.md|knowledge-ledger\.md/g;

export function findBookkeeping(text) {
  return [...new Set(prose(text).match(BOOKKEEPING) ?? [])];
}

/**
 * Warn above FOUR distinct names in one message. Lowered from six 2026-07-29 by INSPECTION, not by
 * rate: all 31 names of one session were classified, and 17 of them (10 bookkeeping paths + 7 skill
 * names cited only to justify the agent's reasoning) were things he never had to act on. The old
 * threshold was set against prose written before that rule existed, so it measured the wrong thing.
 * Inspect-then-tune is the only legitimate order — see the ledger entry on firing rates. Chosen from the distribution, not from taste:
 * Measured on the same 53 reports: >4 fires on 11% (~2× per session), >6 on 4%. The higher number
 * was chosen first to honour a pre-mortem sentence, then lowered once the names had actually been
 * read one by one. A compliant message under the naming rule below carries one or two names, so this
 * threshold should now be reached only by a genuine dump.
 */
export const MAX_NAMES = 4;

/** Null when the message is within budget — the common case, and it must cost nothing to say so. */
export function findNameOverload(text) {
  const names = [...new Set(prose(text).match(NAMED_ARTEFACT) ?? [])];
  return names.length > MAX_NAMES ? { count: names.length, names } : null;
}

/** A term counts as explained if a gloss opens shortly after it, in the same breath. */
const GLOSS_MARKERS = /[—–:(]|\bnghĩa là\b|\btức là\b|\bhiểu là\b|\bmeans\b|\bi\.e\.\b/i;
const GLOSS_WINDOW = 80; // chars after the term — a gloss three sentences later is not a gloss

const RECOMMENDED = /\((?:khuyến nghị|recommended)\)/i;
/** Escape hatch, mirroring the rulebook's directive design: opt out ONLY with a stated reason. */
const NO_RECOMMENDATION = /\(no-recommendation:\s*(.{15,})\)/i;

const MIN_DESCRIPTION = 20;

/** Fenced code is not prose the supervisor reads as explanation — strip it before linting. */
function prose(text = '') {
  return String(text).replace(/```[\s\S]*?```/g, ' ');
}

/**
 * Un-glossed internal terms in a piece of prose. Returns at most one finding per term so a report
 * that repeats a word is reported once, not eleven times.
 */
export function findJargon(text) {
  const body = prose(text);
  const found = [];
  for (const [re, gloss] of TERMS) {
    const m = re.exec(body);
    if (!m) continue;
    const from = m.index + m[0].length;
    // The window stops at the end of the line. Caught by its own test 2026-07-29: without this, a
    // gate question's un-glossed "T3" was silently excused by a "(khuyến nghị)" belonging to an
    // unrelated option two lines below. A gloss on a different line is not a gloss.
    const rest = body.slice(from, from + GLOSS_WINDOW);
    const after = rest.split('\n')[0];
    if (GLOSS_MARKERS.test(after)) continue;
    found.push({ term: m[0], gloss });
  }
  return found;
}

/** Lint several fields independently and keep one finding per term. */
function jargonAcross(fields) {
  const seen = new Map();
  for (const f of fields) {
    for (const hit of findJargon(f ?? '')) if (!seen.has(hit.term)) seen.set(hit.term, hit);
  }
  return [...seen.values()];
}

/**
 * The decision moment. `blocking` is reserved for the ONE rule CLAUDE.md already mandates — a
 * recommendation the supervisor can see at a glance — because that rule has a definite answer and
 * costs him nothing when I get it right. Everything else advises.
 */
export function lintGate(questions = []) {
  const blocking = [];
  const warnings = [];

  questions.forEach((q, i) => {
    const label = `question ${i + 1} ("${String(q?.question ?? '').slice(0, 50)}…")`;
    const options = Array.isArray(q?.options) ? q.options : [];
    const marked = options.filter((o) => RECOMMENDED.test(String(o?.label ?? '')));

    if (NO_RECOMMENDATION.test(String(q?.question ?? ''))) {
      // Opting out is allowed, but only out loud and with a reason — the same shape as the
      // rulebook's `rulebook-allow`, where writing the sentence is where a person decides rather
      // than silences.
    } else if (marked.length === 0) {
      blocking.push(
        `${label}: no option is marked (khuyến nghị). CLAUDE.md §Conventions ("Legible decision surface") requires ` +
          `flagging the one you recommend so the supervisor sees your pick without inferring it. ` +
          `Add it to exactly one option label, or state why there is no recommendation with ` +
          `"(no-recommendation: <reason ≥15 chars>)" in the question.`,
      );
    } else if (marked.length > 1) {
      blocking.push(
        `${label}: ${marked.length} options are marked (khuyến nghị). Recommending everything is ` +
          `recommending nothing — pick one.`,
      );
    }

    for (const [j, o] of options.entries()) {
      const d = String(o?.description ?? '').trim();
      if (d.length < MIN_DESCRIPTION) {
        warnings.push(
          `${label} option ${j + 1} ("${String(o?.label ?? '')}"): description is ${d.length} chars. ` +
            `Say what happens if he picks it, in plain language — a label alone makes him guess.`,
        );
      }
    }

    // Each field is linted on its own: a gloss belonging to one option never excuses a bare term
    // in another, and the question is not excused by anything below it.
    const fields = [q?.question, ...options.flatMap((o) => [o?.label, o?.description])];
    for (const { term, gloss } of jargonAcross(fields)) {
      warnings.push(`${label}: "${term}" is used without explaining it. Plain version: ${gloss}.`);
    }

    // A decision point carries the same budget: if he has to hold seven names to answer, the
    // question is doing the work the file should be doing.
    const overload = findNameOverload(fields.filter(Boolean).join('\n'));
    if (overload) {
      warnings.push(
        `${label}: ${overload.count} artefacts named in one question. Name the one he acts on.`,
      );
    }
  });

  return { blocking, warnings };
}

/**
 * The last message of a turn. Advisory always — see the header on why this must never block.
 * The standing note is composed ONCE by the caller, not repeated per finding: three findings each
 * carrying the same trailing paragraph is itself an unreadable message, which would be a poor
 * advertisement for a legibility check.
 */
export const REPORT_NOTE =
  'warning only — he does not object to jargon, he silently stops following.';

/**
 * `alreadyIntroduced` carries the terms this session has already been warned about, so a word is
 * flagged on FIRST use and not on every use — which is what introducing a term actually means, and
 * is scope-guess (b) of idea-0025 arriving by measurement rather than by taste.
 *
 * The name-overload finding is deliberately NOT deduped: it is a property of one message, not a
 * word that gets learned once.
 */
export function lintReport(text, alreadyIntroduced = new Set()) {
  const findings = [];
  const introduced = [];
  for (const { term, gloss } of findJargon(text)) {
    const key = term.toLowerCase();
    if (alreadyIntroduced.has(key)) continue;
    introduced.push(key);
    findings.push(`unexplained: "${term}" → ${gloss}`);
  }
  const overload = findNameOverload(text);
  if (overload) {
    findings.push(
      `${overload.count} artefacts named in one message (${overload.names.slice(0, 4).join(', ')}…). ` +
        `Keep the ONE he has to act on; the rest belong in the file, not in his head.`,
    );
  }

  // Deduped like a term: it is one habit to break, not a fresh defect every message.
  const books = findBookkeeping(text).filter((b) => !alreadyIntroduced.has(b));
  if (books.length) {
    introduced.push(...books);
    findings.push(
      `named the agent's own filing (${books.join(', ')}) — he never opens these. ` +
        `Say "đã ghi lại" and let the file hold the detail.`,
    );
  }
  return { findings, introduced };
}

/** Last assistant text block in a Claude Code transcript (JSONL, one event per line). */
export function lastAssistantText(transcriptLines = []) {
  for (let i = transcriptLines.length - 1; i >= 0; i--) {
    let ev;
    try {
      ev = JSON.parse(transcriptLines[i]);
    } catch {
      continue;
    }
    if (ev?.message?.role !== 'assistant') continue;
    const content = ev.message.content;
    const parts = Array.isArray(content)
      ? content.filter((c) => c?.type === 'text').map((c) => c.text)
      : typeof content === 'string'
        ? [content]
        : [];
    if (parts.length) return parts.join('\n');
  }
  return '';
}

// ── hook body ──────────────────────────────────────────────────────────────────────────────────
// Guarded so the pure functions above can be imported by the test without running any of this.
if (!process.env.LEGIBILITY_LINT_TEST) {
  try {
    const payload = await readPayload();
    const event = payload.hook_event_name;

    if (event === 'PreToolUse' && payload.tool_name === 'AskUserQuestion') {
      const { blocking, warnings } = lintGate(payload.tool_input?.questions ?? []);
      if (blocking.length) {
        console.error(
          `Legibility gate — fix before asking:\n  ${[...blocking, ...warnings].join('\n  ')}`,
        );
        process.exit(2);
      }
      if (warnings.length) {
        console.error(`Legibility (advisory):\n  ${warnings.join('\n  ')}`);
      }
      process.exit(0);
    }

    if (event === 'Stop') {
      const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      // Per-session memory of which terms have already been introduced. Temp dir on purpose: if it
      // is cleared, the worst case is one repeated warning — harmless — whereas a file in the repo
      // would be session state committed by accident. Same trade `suggest-session-wrap.mjs` makes.
      const sessionId = String(payload.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
      const marker = join(tmpdir(), `claude-legibility-${sessionId || 'nosession'}.json`);
      let seen = new Set();
      if (sessionId && existsSync(marker)) {
        try {
          seen = new Set(JSON.parse(readFileSync(marker, 'utf8')));
        } catch {
          // A corrupt marker means "introduce everything again" — noisier, never wrong.
        }
      }

      const lines = readFileSync(payload.transcript_path, 'utf8').split('\n').filter(Boolean);
      const { findings, introduced } = lintReport(lastAssistantText(lines), seen);

      if (sessionId && introduced.length) {
        try {
          writeFileSync(marker, JSON.stringify([...seen, ...introduced]));
        } catch {
          // Unwritable temp dir → the check still works, it just repeats itself.
        }
      }

      if (findings.length) {
        console.log(
          JSON.stringify({
            systemMessage: `Legibility — ${findings.join(' · ')} (${REPORT_NOTE})`,
          }),
        );
      }
    }
  } catch {
    // Fail silent and open. This hook exists to improve an explanation, never to interrupt work —
    // an error here must cost nothing.
  }
  process.exit(0);
}
