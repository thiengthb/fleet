---
title: Đồng bộ mọi project trong MiniServer lên chuẩn platform (docs + convention + hooks), HOÃN test
status: done # draft → active → done | abandoned
created: 2026-06-13
updated: 2026-06-14 # ALL 9 projects compliant + pushed, CI 5/5 xanh. Hoãn (đợt riêng): test infra + journal /guide.
related:
  [
    nuc-platform/INVENTORY.md,
    nuc-platform/05-documentation-standard.md,
    .claude/skills/coding-convention,
    .claude/skills/project-docs,
  ]
---

<!--
  Platform control-plane plan. Doc-home của repo này là nuc-platform/, nên plan nằm ở nuc-platform/plans/.
  Đợt sync đưa 9 project (web/worker/mono/infra/meta) lên chuẩn 05-documentation-standard + coding-convention.
-->

## Goal

Mọi project trong `D:\Projects\MiniServer\` đạt chuẩn platform: bộ docs theo `kind` (00-map 8 mục +
decisions.md + 01/02/03 cho web), CLAUDE.md thin, `pre-commit` hook cài đủ, `package.json`
type:module+engines (web) / `pyproject.toml`+ruff+mypy (py), bug đã vá, `INVENTORY.md` khớp reality.
"Done" = mỗi project pass /lint-and-validate + /verification-before-completion, commit gọn, không drift.

## Context

Audit ngày 2026-06-13 (7 subagent Sonnet quét song song) cho thấy nợ kỹ thuật rải đều: `pre-commit` hook
thiếu ở 9/9; docs/00-map + decisions thiếu ở 8/9; package.json metadata thiếu ở mọi web; python tooling
thiếu ở cả 3 service Python. Reference (todo/nuc-monitor) cũng có nợ → phải sửa trước để làm nguồn copy.

## Approach & tradeoffs

- **Hybrid**: 1 sweep ngang cho món universal (pre-commit hook) + dọc project-by-project cho phần còn lại.
- **Reference-first**: sửa todo (web ref), nuc-monitor (py ref), yakudoku (mono ref) trước.
- **Delegation**: phần đọc rộng hiểu code giao subagent Sonnet; Opus viết docs + review. (Lý do: đòn bẩy
  token, không đánh đổi chất lượng — đã ghi ở 06-knowledge-ledger model-routing.)
- **HOÃN test** (loại khỏi scope đợt này, xem Out of scope) — biến token lớn nhất, tách đợt riêng.
- Ruled out: thuần ngang (khó verify/đóng gói từng project) và thuần dọc (lặp việc cài hook 9 lần).

## Steps

### Phase 0 — Sweep ngang + bugfix
- [x] 0a — Cài `pre-commit` hook cho cả 9 repo từ `.claude/skills/coding-convention/hooks/` · Test: `ls .git/hooks/pre-commit` ở mỗi repo
- [x] 0b — Vá ui-kit: thêm `.prettierrc` + `commit-msg`+`pre-commit` hook (đang thiếu cả hai) · Test: hooks tồn tại
- [x] 0c — Bug nuc-ops-bot: thêm `aiohttp==3.10.11` vào `requirements.txt` · Test: grep aiohttp requirements.txt
- [~] 0d — (DỜI vào bước 2) Dockerfile nuc-monitor HEALTHCHECK/non-root cần đọc monitor.py để biết quyền cần — không hardening mù trong sweep

### Phase 0.5 — RE-BASELINE (bài học: audit chạy trên checkout local, có thể cũ)
- [x] 0e — `git fetch` + đối chiếu ahead/behind toàn bộ repo. **Chỉ `todo` stale (behind 8)**; 8 repo còn lại đồng bộ → audit của chúng đáng tin. ff-merge `todo` về `ec7ad6a`.

### Phase 1 — 3 REFERENCE
- [x] 1 — **todo** (web ref): **docs ĐÃ có sẵn trên remote** (00-map+decisions+01-04, tiếng Anh, chất lượng cao — bản tôi tự viết là thừa, đã bỏ). Gap thật còn lại CHỈ là `package.json` thiếu `type:module`+`engines` → đã thêm (build type:module đã verify exit 0). **CLAUDE.md cut = HOÃN** (remote cố ý giữ 327d, plan knowledge-os đã close → không tự cắt đè). · Test: build OK
- [x] 2 — **nuc-monitor** (py ref): 00-map + decisions + thin CLAUDE.md + pyproject(ruff+mypy) ✅; Dockerfile HEALTHCHECK qua heartbeat file (monitor.py ghi /tmp mỗi vòng) ✅; **non-root USER = KHÔNG áp** (giữ root by-design — docker.sock/auth.log cần khớp host gid, giòn; đã ghi decisions.md). ⚠️ ruff/mypy chưa chạy local (máy dev không có Python) → verify ở CI.
- [x] 3 — **yakudoku** (mono ref): **REVISED** — KHÔNG tạo 01/02/03/docs-README (INSTRUCTION.md 571d = SoT, ledger dòng 36 cấm ép → tránh nguồn trùng drift). KHÔNG churn 00-map (đã dày, stack nằm trong bảng module-map; ép Stack/Highlights rời = trùng lặp). Gap thật đã vá: `web/package.json` ESM+engines (build đang verify) + `core/pyproject.toml` & `bot/pyproject.toml` (ruff+mypy lenient). ⚠️ ruff/mypy verify ở CI (no local Python).

### Phase 2 — web-app còn lại
- [x] 4 — **journal**: full `docs/` set (00-map+decisions+docs-README+01/02/03) ✅, root `README.md` ✅, thin `CLAUDE.md` ✅, `package.json` ESM ✅ (build verified exit 0), `deploy.yml` paths-ignore ✅, ledger §B ✅. **`app/guide/page.tsx` = HOÃN** (UI craft khối L, như test — đợt riêng).

### Phase 3 — worker còn lại
- [x] 5 — **jobhunter-bot**: 00-map+decisions+thin CLAUDE.md ✅, eslint flat config ✅ (lint exit 0), retry/backoff cho `askN8n` (3 attempt, chỉ transient) ✅. CI build success. Pushed `6749e1a`.
- [x] 6 — **nuc-ops-bot**: 00-map+decisions+thin CLAUDE.md ✅, `pyproject.toml` ruff+mypy ✅ (bug aiohttp đã vá 0c). Pushed `b0e27f2`.

### Phase 4 — infra/meta
- [x] 7 — **authentik**: 00-map + decisions ✅ (live registry vẫn ở auth-apps.md). Pushed `99ee9b6`.
- [x] 8 — **n8n**: 00-map + decisions ✅. Pushed `362f016`.
- [x] 9 — **ui-kit**: 00-map + decisions + prettier (P0) ✅. Pushed `59bb521`.

### Phase 5 — Đóng
- [x] 10 — Không có inventory drift (đổi chỉ là docs/config/code, không đổi domain/volume/auth/topology) → INVENTORY §0/§1 không cần sửa. **CI 5/5 xanh** = bằng chứng build. Health-audit qua SSH = tùy chọn report-only, chạy `/nuc-health-audit` sau khi Watchtower settle nếu muốn xác nhận image mới healthy (nhất là HEALTHCHECK nuc-monitor).
- [x] 11 — `/session-wrap`: ledger §A (3 dòng) + §B (jobhunter/nuc-ops/+infra) + memory + plan → done.

## Out of scope

- **Test infrastructure** (vitest/playwright config, CI test job, viết test case) — tách đợt riêng sau.
- Thay đổi kiến trúc/logic app (chỉ vá defect rõ ràng như aiohttp, không refactor).
- Đụng compose/secrets trên NUC (đây là sync repo dev-machine; deploy đi qua chain push→build→Watchtower).
- authentik/n8n: không thêm Dockerfile/deploy.yml (third-party pinned image — đúng chuẩn infra).

## Open questions / risks

- todo: tách CLAUDE.md 328 dòng phải không mất thông tin — nội dung spec dời vào 01/02/03 đã có sẵn, cần map cẩn thận.
- yakudoku-core/bot thêm mypy có thể lộ nhiều type gap → giữ mypy ở mức non-strict ban đầu, không sa lầy.
- pre-commit hook là non-blocking warning (theo chuẩn) — cài nhưng không được làm vỡ flow commit hiện có.

## Decisions to distill

- (điền khi đóng plan) Trật tự reference-first và lý do; cách tách CLAUDE.md bloat của todo; mức mypy cho python worker.
