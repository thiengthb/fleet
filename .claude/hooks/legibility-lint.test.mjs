// Test for legibility-lint.mjs — the check that fires when I use my own vocabulary at the
// supervisor without translating it. Run: node .claude/hooks/legibility-lint.test.mjs
//
// The bar: this control only earns its place if it fails on the real 2026-07-29 messages and stays
// quiet on their fixed versions. So the fixtures below are LIFTED from that session rather than
// invented — an invented fixture would be written by the same intuition the control exists to
// distrust.

import assert from 'node:assert/strict';

process.env.LEGIBILITY_LINT_TEST = '1'; // import without running the hook body
const { findJargon, lintGate, lintReport, lastAssistantText, TERMS, REPORT_NOTE, findNameOverload, MAX_NAMES } = await import(
  './legibility-lint.mjs'
);

// --- the jargon check ---------------------------------------------------------------------------
{
  // Verbatim shape of what actually went out on 2026-07-29 and was agreed to without being understood.
  const real = 'Hàng chờ đã sắp lại theo RICE, còn 5 slot trong WIP cap, và tôi đã đẩy một wildcard lên.';
  const found = findJargon(real).map((f) => f.term);
  assert.ok(found.includes('RICE'), 'RICE un-glossed must be caught — this is the real message');
  assert.ok(found.includes('WIP cap'), 'WIP cap un-glossed must be caught');
  assert.ok(found.includes('wildcard'), 'wildcard un-glossed must be caught');

  // Every finding must carry the plain replacement. A warning that only says "too technical"
  // reproduces the problem it is reporting.
  for (const f of findJargon(real)) {
    assert.ok(f.gloss && f.gloss.length > 10, `finding for "${f.term}" carries no plain version`);
  }
}

{
  // Glossed in the same breath → silent. This is the behaviour being asked for, so it must not warn.
  const fixed =
    'Hàng chờ sắp lại theo RICE (điểm ưu tiên: bao nhiêu người dùng × lợi ích ÷ công sức), ' +
    'còn 5 chỗ trong WIP cap — giới hạn số việc mở cùng lúc.';
  assert.equal(findJargon(fixed).length, 0, 'a term explained right after it is not a finding');
}

{
  // A gloss three sentences later is not a gloss — he reads left to right, once.
  const late =
    'Tôi đã đẩy một wildcard lên đầu hàng chờ. ' +
    'Việc này mất khoảng hai tiếng. Sau đó tôi sẽ chạy lại toàn bộ test và báo cáo. ' +
    'Nhân tiện, wildcard nghĩa là một ý tưởng lạ được đưa vào có chủ đích.';
  assert.equal(findJargon(late).length, 1, 'a gloss far away from the term does not count');
}

{
  // The window stops at end-of-line. This is the mutant that SURVIVED the first mutation pass:
  // the same defect had been fixed twice (clamp the window AND lint each field separately), so
  // removing the clamp broke nothing that was asserted. Two fixes, one test, is one fix untested.
  const acrossLines = 'Đây là T3 nên tôi cần bạn duyệt.\nLàm đầy đủ (khuyến nghị)';
  assert.equal(
    findJargon(acrossLines).length,
    1,
    'a parenthesis on the NEXT line must not excuse a bare term on this one',
  );
}

{
  // Reported once per term, not once per occurrence — eleven warnings for one word is noise.
  const repeated = 'thin slice này nhỏ, thin slice kia to, và thin slice nào cũng phải chạy được.';
  assert.equal(findJargon(repeated).length, 1, 'one finding per term, not per occurrence');
}

{
  // Fenced code is not prose. `T4` inside a snippet is an identifier, not an unexplained concept.
  const code = 'Kết quả:\n```js\nconst tier = "T4";\nconst mode = "P3";\n```\n';
  assert.equal(findJargon(code).length, 0, 'fenced code is stripped before linting');
}

// --- the gate check -----------------------------------------------------------------------------
const q = (over = {}) => ({
  question: 'Bạn chọn phương án nào?',
  options: [
    { label: 'Làm đầy đủ (khuyến nghị)', description: 'Tôi viết cả hai nửa và cài đặt luôn cho bạn.' },
    { label: 'Chỉ làm một nửa', description: 'Nhỏ hơn, an toàn hơn, nhưng bỏ sót chỗ hay sai nhất.' },
  ],
  ...over,
});

{
  const { blocking, warnings } = lintGate([q()]);
  assert.equal(blocking.length, 0, 'a well-formed question is not blocked');
  assert.equal(warnings.length, 0, 'and produces no advisory noise either');
}

{
  // The rule CLAUDE.md already mandates and nothing enforced until now.
  const bare = q({
    options: [
      { label: 'Làm đầy đủ', description: 'Tôi viết cả hai nửa và cài đặt luôn cho bạn.' },
      { label: 'Chỉ làm một nửa', description: 'Nhỏ hơn, an toàn hơn, nhưng bỏ sót chỗ hay sai nhất.' },
    ],
  });
  const { blocking } = lintGate([bare]);
  assert.equal(blocking.length, 1, 'no (khuyến nghị) anywhere must BLOCK, not merely warn');
  assert.match(blocking[0], /khuyến nghị/);
}

{
  const both = q({
    options: [
      { label: 'A (khuyến nghị)', description: 'Tôi viết cả hai nửa và cài đặt luôn cho bạn.' },
      { label: 'B (khuyến nghị)', description: 'Nhỏ hơn, an toàn hơn, nhưng bỏ sót chỗ hay sai nhất.' },
    ],
  });
  const { blocking } = lintGate([both]);
  assert.equal(blocking.length, 1, 'recommending everything is recommending nothing');
  assert.match(blocking[0], /pick one/);
}

{
  // The escape hatch must work — and must require a stated reason, not a bare flag.
  const opted = q({
    question: 'Bạn thích màu nào? (no-recommendation: thuần sở thích cá nhân, tôi không có cơ sở để khuyên)',
    options: [
      { label: 'Xanh', description: 'Nền tối hơn, hợp với chế độ ban đêm hơn.' },
      { label: 'Cam', description: 'Nổi hơn trên nền sáng, dễ thấy nút chính hơn.' },
    ],
  });
  assert.equal(lintGate([opted]).blocking.length, 0, 'a stated reason opts out of the rule');

  const bare = q({
    question: 'Bạn thích màu nào? (no-recommendation: vì thế)',
    options: opted.options,
  });
  assert.equal(lintGate([bare]).blocking.length, 1, 'a too-short reason does NOT opt out');
}

{
  // A label with no explanation of consequence is the shape he could not follow.
  const thin = q({
    options: [
      { label: 'Làm đầy đủ (khuyến nghị)', description: 'Nên làm.' },
      { label: 'Chỉ một nửa', description: 'Nhỏ hơn, an toàn hơn, nhưng bỏ sót chỗ hay sai nhất.' },
    ],
  });
  const { blocking, warnings } = lintGate([thin]);
  assert.equal(blocking.length, 0, 'a thin description advises, it does not block');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /plain language/);
}

{
  // Jargon inside a gate is advisory too — but it must be reported, since the gate is the moment
  // a misunderstanding turns into a signature.
  const jargony = q({
    question: 'Đây là T3 nên tôi cần bạn duyệt.',
    options: q().options,
  });
  const { warnings } = lintGate([jargony]);
  assert.ok(
    warnings.some((w) => w.includes('T3')),
    'un-glossed tier language at a gate is reported',
  );
}

// --- report linting + transcript reading ---------------------------------------------------------
{
  assert.equal(
    lintReport('Đã xong, không có gì cần bạn quyết.').findings.length,
    0,
    'plain report is silent',
  );
  const { findings, introduced } = lintReport('Tôi đã chạy mutation testing trên hai cổng mới.');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /cố tình làm hỏng code/, 'a finding carries the plain replacement');
  assert.deepEqual(introduced, ['mutation testing'], 'and reports which term it just introduced');
  // The standing note belongs to the message, not to each finding — three copies of the same
  // paragraph would make the legibility warning itself unreadable.
  assert.ok(!findings[0].includes(REPORT_NOTE), 'the note is not repeated inside every finding');
  assert.match(REPORT_NOTE, /warning only/, 'and it still says the check never blocks');
}

{
  // First use per session. Measured on 43 real reports: 16 warnings → 12 with this rule, and
  // nothing distinct hidden. A term is introduced once; repeating it is not a new defect.
  const msg = 'Tôi đã chạy mutation testing trên hai cổng mới.';
  const first = lintReport(msg, new Set());
  assert.equal(first.findings.length, 1, 'first use warns');

  const second = lintReport(msg, new Set(first.introduced));
  assert.equal(second.findings.length, 0, 'second use of the SAME term is silent');
  assert.deepEqual(second.introduced, [], 'and nothing new is recorded');

  // A different term in a later message still gets introduced — the dedupe is per term, not a
  // once-per-session mute on the whole check.
  const third = lintReport('Đây là một thin slice của backflow.', new Set(first.introduced));
  assert.equal(third.findings.length, 2, 'unseen terms still warn after another was introduced');
}

{
  // The name-overload finding is a property of ONE message, so it must NOT be deduped away by a
  // set that happens to contain a term name.
  const many =
    'idea-0023 idea-0025 idea-0026 /session-wrap docs/00-map.md .claude/hooks/a.mjs platform/standards/testing.md';
  const { findings } = lintReport(many, new Set(['mutant', 'thin-slice', 'backflow']));
  assert.equal(findings.length, 1, 'the overload still reports through a populated seen-set');
  assert.match(findings[0], /7 artefacts named/);
}

{
  const lines = [
    JSON.stringify({ message: { role: 'user', content: 'làm tiếp' } }),
    JSON.stringify({ message: { role: 'assistant', content: [{ type: 'text', text: 'câu cũ' }] } }),
    JSON.stringify({
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Bash', input: {} },
          { type: 'text', text: 'câu cuối' },
        ],
      },
    }),
  ];
  assert.equal(lastAssistantText(lines), 'câu cuối', 'reads the LAST assistant text, past tool calls');
  assert.equal(lastAssistantText(['not json', '{"a":1}']), '', 'garbage in the transcript is survivable');
}

// --- the name-density check (idea-0026) -----------------------------------------------------------
{
  // A normal report names one or two things. It must stay silent, or the check is worthless.
  assert.equal(findNameOverload('Đã ghi vào platform/registries/idea-queue.md.'), null, 'one name is fine');
  assert.equal(findNameOverload('Xong rồi, không có gì cần bạn quyết.'), null, 'no name is fine');

  const six = 'idea-0023 idea-0025 idea-0026 /session-wrap docs/00-map.md .claude/hooks/a.mjs';
  assert.equal(findNameOverload(six), null, `exactly ${MAX_NAMES} is within budget, not over it`);

  const seven = six + ' platform/standards/testing.md';
  const over = findNameOverload(seven);
  assert.ok(over, 'one past the budget must be reported');
  assert.equal(over.count, 7);
}

{
  // A unix path is not an artefact of this platform's process. Counting /home would make every
  // message about a file look like an overload — the false positive that would get this disabled.
  const paths = '/home/thien/projects/fleet và /tmp/scratch và /usr/local/bin và /var/log';
  assert.equal(findNameOverload(paths), null, 'filesystem paths are not named artefacts');
}

{
  // Repeats are not extra load — he holds a name once, however often it appears.
  const repeated = Array(9).fill('idea-0026').join(' ');
  assert.equal(findNameOverload(repeated), null, 'the same name nine times is still one name');
}

{
  const { findings } = lintReport(
    'idea-0023 idea-0025 idea-0026 /session-wrap docs/00-map.md .claude/hooks/a.mjs platform/standards/testing.md',
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /7 artefacts named/);
  assert.match(findings[0], /act on/, 'the warning must say what to do, not merely that it is too many');
}

// --- the list itself ------------------------------------------------------------------------------
{
  // Every term must ship its plain replacement, or the warning is just a scolding.
  for (const [re, gloss] of TERMS) {
    assert.ok(gloss && gloss.length > 10, `term ${re} has no usable plain-language version`);
  }
  assert.ok(TERMS.length <= 25, 'the list stays short on purpose — a broad list becomes noise');
}

console.log('legibility-lint: all assertions passed');
