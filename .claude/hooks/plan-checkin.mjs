// SessionStart hook — PLAN CHECK-IN reminder (the clock the human does not have to keep).
//
// Some plans cannot be finished by writing code: they contain a gate that can only be answered by
// LETTING TIME PASS and then having a human look (a week of shadow proposals; re-measuring a metric
// once the data has moved). Before this hook, such a gate lived as a date written in the middle of a
// plan file — which meant the user had to remember the date AND re-ask for the steps, and if they
// forgot, the waiting produced nothing. A gate nobody is reminded of is not a gate.
//
// This surfaces two things at session start, across EVERY project (not just the one the session was
// launched in — the user works in whichever repo they feel like, and the obligation does not care):
//
//   1. DUE CHECK-IN   — a plan whose `checkin:` date has arrived. The plan's own `## Check-in runbook`
//                       section is the complete, self-contained procedure, so nothing has to be
//                       re-derived in chat. The runbook is REQUIRED whenever `checkin:` is set.
//   2. DANGLING PLAN  — `status: active` but untouched for STALE_DAYS. No date, just abandonment
//                       drift; offered so a plan cannot quietly rot.
//
// Also reports CONFIG DEFECTS loudly (a `checkin:` with no runbook, an unparseable date) rather than
// skipping them — a reminder that silently fails to fire is worse than none, because it is trusted.
//
// Output contract matches git-sync-check.mjs: SessionStart, always exit 0, `systemMessage` to the
// user (Vietnamese) + `hookSpecificOutput.additionalContext` to the model (English). Silent when
// there is nothing to say.
//
// Manual run (no stdin, human-readable): `node .claude/hooks/plan-checkin.mjs --list`

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPayload } from './_util.mjs';
import { projectRoots } from '../scripts/_layout.mjs';

const STALE_DAYS = 10; // an `active` plan untouched this long is offered as dangling
const LEAD_DAYS = 1; // a check-in this close is shown as "sắp tới" so it is never a surprise
const MAX_DANGLING = 3; // anti-noise: the oldest few, not a wall of every open plan

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HOOK_DIR, '..', '..');

const RUNBOOK_HEADING = /^##\s+Check-in runbook\b/m;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD in LOCAL time — the user's calendar day, not UTC's. */
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). Negative = `b` is in the past. */
function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/**
 * Minimal frontmatter reader: the leading `---` block, one `key: value` per line. Deliberately not a
 * YAML parser — the plan schema is flat scalars, and a dependency here would run on every session
 * start. Nested/multi-line values are ignored rather than guessed at.
 */
function frontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const out = {};
  for (const line of text.slice(3, end).split('\n')) {
    const m = /^([a-z_]+):\s*(.*)$/i.exec(line.trim());
    if (!m) continue;
    out[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/**
 * Every plan directory on the platform: `<project>/docs/plans` and `<project>/plans`.
 * Project discovery is delegated to `_layout.mjs`, so a project nested under `projects/` is still found —
 * this function used to scan only the repo's immediate children and went silently blind on 2026-07-30.
 */
function planDirs(root) {
  const dirs = [];
  for (const project of projectRoots(root)) {
    for (const rel of [path.join('docs', 'plans'), 'plans']) {
      const dir = path.join(project.dir, rel);
      if (existsSync(dir)) dirs.push({ project: project.name, dir });
    }
  }
  return dirs;
}

/** Read every plan file, returning {project, file, path, fm, hasRunbook}. Never throws. */
function readPlans() {
  const plans = [];
  for (const { project, dir } of planDirs(ROOT)) {
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
    } catch {
      continue;
    }
    for (const file of files) {
      const full = path.join(dir, file);
      let text = '';
      try {
        text = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const fm = frontmatter(text);
      if (!fm) continue;
      plans.push({
        project,
        file,
        path: path.relative(ROOT, full).split(path.sep).join('/'),
        fm,
        hasRunbook: RUNBOOK_HEADING.test(text),
      });
    }
  }
  return plans;
}

/** Sort plans into the three buckets the session start cares about. */
export function classify(plans, now) {
  const due = [];
  const soon = [];
  const dangling = [];
  const defects = [];

  for (const p of plans) {
    const status = (p.fm.status || '').toLowerCase();
    if (status === 'done' || status === 'abandoned') continue;

    const checkin = p.fm.checkin;
    if (checkin) {
      // A defect is REPORTED, never silently skipped: a reminder that fails quietly is trusted and
      // therefore worse than no reminder at all.
      if (!DATE_RE.test(checkin)) {
        defects.push({ ...p, problem: `checkin: "${checkin}" is not YYYY-MM-DD` });
        continue;
      }
      if (!p.hasRunbook) {
        defects.push({ ...p, problem: 'has `checkin:` but no `## Check-in runbook` section' });
      }
      const delta = daysBetween(now, checkin); // <0 overdue, 0 today, >0 upcoming
      if (delta <= 0) due.push({ ...p, delta });
      else if (delta <= LEAD_DAYS) soon.push({ ...p, delta });
      continue; // a dated plan is never ALSO reported as dangling
    }

    if (status === 'active' && DATE_RE.test(p.fm.updated || '')) {
      const idle = -daysBetween(now, p.fm.updated);
      if (idle >= STALE_DAYS) dangling.push({ ...p, idle });
    }
  }

  due.sort((a, b) => a.delta - b.delta); // most overdue first
  dangling.sort((a, b) => b.idle - a.idle);
  // Report the TOTAL alongside the truncated list. Showing 3 of 6 as if it were 3 of 3 makes a growing
  // backlog look static — on 2026-07-28 three plans were closed and three more appeared, which is exactly
  // the shape a silent cap produces. Truncate the list, never the count.
  return { due, soon, dangling: dangling.slice(0, MAX_DANGLING), danglingTotal: dangling.length, defects };
}

const label = (p) => `${p.project}/${p.file.replace(/\.md$/, '')}`;

function render({ due, soon, dangling, danglingTotal = dangling.length, defects }) {
  const user = [];
  const model = [];

  if (due.length) {
    user.push('⏰ Plan cần CHECK-IN hôm nay:');
    for (const p of due) {
      const when = p.delta === 0 ? 'đến hạn hôm nay' : `QUÁ HẠN ${-p.delta} ngày`;
      user.push(`• ${label(p)} — ${when}${p.fm.title ? ` — ${p.fm.title}` : ''}`);
    }
    user.push('→ Các bước nằm sẵn ở mục "Check-in runbook" trong chính file plan; nói "làm check-in" là tôi chạy.');

    model.push('PLAN CHECK-INS DUE (a human-gated step whose date has arrived):');
    for (const p of due) {
      model.push(`- ${p.path} (${p.delta === 0 ? 'due today' : `${-p.delta} days overdue`})`);
    }
    model.push(
      'ACTION: OFFER to run these this session, before other work. Read the plan\'s ' +
        '"## Check-in runbook" section and follow it verbatim — it is written to be self-contained, ' +
        'so do NOT re-derive the steps or ask the user to recall them. When the check-in is completed, ' +
        'record the outcome in the plan and roll `checkin:` forward by `checkin_every` (or clear it if ' +
        'the gate is now answered). This applies whichever project the session is working in.',
    );
  }

  if (soon.length) {
    user.push(
      `🗓 Sắp tới: ${soon.map((p) => `${label(p)} (${p.delta} ngày nữa)`).join(', ')}`,
    );
  }

  if (dangling.length) {
    const more = danglingTotal - dangling.length;
    user.push(
      `💤 Plan còn dang dở (status: active, lâu chưa đụng)${more > 0 ? ` — ${danglingTotal} cái, hiện ${dangling.length}:` : ':'}`,
    );
    for (const p of dangling) user.push(`• ${label(p)} — ${p.idle} ngày`);
    if (more > 0) user.push(`• …và ${more} plan nữa (chạy \`node .claude/hooks/plan-checkin.mjs --list\` để xem hết)`);

    model.push(
      `DANGLING PLANS (status: active, untouched >= 10 days) — ${danglingTotal} total, showing ${dangling.length}:`,
    );
    for (const p of dangling) model.push(`- ${p.path} (idle ${p.idle}d)`);
    if (more > 0) model.push(`- (+${more} more not shown — the backlog is larger than this list)`);
    model.push(
      'ACTION: once the session\'s actual request is handled, offer ONE of these as the next piece of ' +
        'work — name the specific unchecked step, not just the plan. If it is stalled on the user, say ' +
        'what is blocking it. Do not silently ignore it, and do not derail the current request for it.',
    );
  }

  if (defects.length) {
    user.push('⚠️ Plan khai báo check-in nhưng hỏng:');
    for (const p of defects) user.push(`• ${label(p)} — ${p.problem}`);

    model.push('CHECK-IN CONFIG DEFECTS (the reminder cannot fire correctly):');
    for (const p of defects) model.push(`- ${p.path}: ${p.problem}`);
    model.push('ACTION: fix the plan file — a `checkin:` without a runbook makes the user re-ask the steps, which is the exact failure this mechanism exists to remove.');
  }

  return { user, model };
}

async function main() {
  const manual = process.argv.includes('--list');
  if (!manual) {
    const payload = await readPayload();
    // 'compact' fires often and mid-session; the plan files have not changed since startup.
    if (payload.source === 'compact') process.exit(0);
  }

  const { user, model } = render(classify(readPlans(), today()));

  if (manual) {
    process.stdout.write(user.length ? `${user.join('\n')}\n` : 'Không có plan nào tới hạn check-in.\n');
    process.exit(0);
  }
  if (!user.length) process.exit(0); // nothing due, nothing rotting → completely silent

  process.stdout.write(
    JSON.stringify({
      systemMessage: user.join('\n'),
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: model.join('\n') },
    }),
  );
  process.exit(0);
}

// Importable for the test; only auto-runs as a hook.
if (!process.env.PLAN_CHECKIN_TEST) main().catch(() => process.exit(0));
