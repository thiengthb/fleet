// Test for plan-checkin.mjs — the classifier that decides what a session start reminds you about.
// Run: node .claude/hooks/plan-checkin.test.mjs
//
// The bar here is not "does it print something". A reminder mechanism fails in exactly two ways that
// matter, and both are asserted below:
//   - it stays SILENT when it should fire (the obligation is missed and nobody knows), and
//   - it fires with an INCOMPLETE runbook (the user has to re-ask the steps, which is the whole thing
//     this was built to remove — so a missing runbook is a reported DEFECT, not a skipped file).

import assert from 'node:assert/strict';

process.env.PLAN_CHECKIN_TEST = '1'; // import without running the hook body
const { classify } = await import('./plan-checkin.mjs');

const NOW = '2026-08-04';
const plan = (fm, extra = {}) => ({
  project: 'sakubun',
  file: 'p.md',
  path: 'sakubun/docs/plans/p.md',
  hasRunbook: true,
  fm,
  ...extra,
});

// --- due / soon / not-yet -------------------------------------------------------------------
{
  const { due, soon } = classify(
    [
      plan({ status: 'active', checkin: '2026-08-04' }, { file: 'today.md' }),
      plan({ status: 'active', checkin: '2026-07-28' }, { file: 'late.md' }),
      plan({ status: 'active', checkin: '2026-08-05' }, { file: 'tomorrow.md' }),
      plan({ status: 'active', checkin: '2026-09-01' }, { file: 'far.md' }),
    ],
    NOW,
  );
  assert.deepEqual(
    due.map((p) => p.file),
    ['late.md', 'today.md'],
    'due = arrived or overdue, MOST OVERDUE FIRST',
  );
  assert.equal(due[0].delta, -7, 'overdue by 7 days');
  assert.deepEqual(soon.map((p) => p.file), ['tomorrow.md'], 'one day out is a heads-up, not due');
}

// --- a closed plan never nags ---------------------------------------------------------------
{
  const { due, dangling } = classify(
    [
      plan({ status: 'done', checkin: '2026-01-01' }),
      plan({ status: 'abandoned', checkin: '2026-01-01' }),
      plan({ status: 'done', updated: '2020-01-01' }),
    ],
    NOW,
  );
  assert.equal(due.length, 0, 'done/abandoned plans are closed — a past date must not resurrect them');
  assert.equal(dangling.length, 0);
}

// --- THE defect that matters: a date with no runbook -----------------------------------------
{
  const { due, defects } = classify(
    [plan({ status: 'active', checkin: '2026-08-04', title: 'x' }, { hasRunbook: false })],
    NOW,
  );
  assert.equal(due.length, 1, 'still fires — a missing runbook must not swallow the reminder');
  assert.equal(defects.length, 1);
  assert.match(defects[0].problem, /no `## Check-in runbook`/);
}

// --- a malformed date is reported, never silently ignored ------------------------------------
{
  const { due, defects } = classify([plan({ status: 'active', checkin: 'next week' })], NOW);
  assert.equal(due.length, 0);
  assert.equal(defects.length, 1, 'an unparseable date is loud — a silent skip would be trusted');
  assert.match(defects[0].problem, /not YYYY-MM-DD/);
}

// --- dangling: active + idle, and never double-reported --------------------------------------
{
  const { dangling } = classify(
    [
      plan({ status: 'active', updated: '2026-07-20' }, { file: 'idle15.md' }),
      plan({ status: 'active', updated: '2026-08-01' }, { file: 'fresh.md' }),
      plan({ status: 'draft', updated: '2020-01-01' }, { file: 'draft.md' }),
      plan({ status: 'active', updated: '2020-01-01', checkin: '2026-12-01' }, { file: 'dated.md' }),
    ],
    NOW,
  );
  assert.deepEqual(
    dangling.map((p) => p.file),
    ['idle15.md'],
    'only an ACTIVE, undated, idle plan dangles — a dated plan already has its own clock, and a draft was never started',
  );
  assert.equal(dangling[0].idle, 15);
}

// --- anti-noise cap ---------------------------------------------------------------------------
{
  const many = Array.from({ length: 9 }, (_, i) =>
    plan({ status: 'active', updated: '2026-06-0' + ((i % 9) + 1) }, { file: `p${i}.md` }),
  );
  assert.equal(classify(many, NOW).dangling.length, 3, 'capped — a wall of reminders is ignored wholesale');
}

console.log('plan-checkin: all assertions passed');
