# 06 — Sổ tri thức xuyên project (index)

> **Index** các bài học đáng nhớ của cả nền tảng — KHÔNG chép nội dung, chỉ **1 dòng/bài học + con trỏ**
> về nơi đầy đủ. Hai nguồn: (a) bài học **xuyên nhiều project** (ghi thẳng ở đây), (b) bài học **riêng một
> project** (sống ở `<project>/docs/decisions.md`, ở đây chỉ trỏ tới).
>
> Lập 2026-06-12. Bồi đắp bởi skill `/session-wrap`. Chuẩn ghi: xem `05-TAI-LIEU-CHUAN.md §5`.

---

## Cách dùng

- Vào một việc mới và muốn biết "đã từng vấp gì liên quan?" → quét bảng dưới, theo con trỏ tới chi tiết.
- Học được điều gì **xuyên project** (áp cho ≥2 project, hoặc cho chính platform) → thêm 1 dòng mục A.
- Học được điều gì **riêng 1 project** → ghi đầy đủ vào `<project>/docs/decisions.md`, rồi (nếu đáng
  cho người khác biết) thêm 1 dòng trỏ ở mục B.
- Bẫy cấp **hệ thống/hạ tầng** (Docker/Traefik/Watchtower/Authentik) KHÔNG vào đây — chỗ của chúng là
  `02-MO-XE-LOI-HE-THONG-CU.md`. File này lo tri thức **phát triển/sản phẩm/quyết định**.

---

## A. Bài học xuyên project (nội dung ở đây)

| Ngày | Bài học (1 dòng) | Áp cho | Chi tiết |
|------|------------------|--------|----------|
| 2026-06-12 | **Tính ĐỘNG thay vì lưu cột phái sinh** (streak, delay, progress…) để tránh dữ liệu lệch khi nguồn đổi. | mọi app có thống kê | `todo/docs/02-technical.md §2` (bảng "Giá trị tính ĐỘNG") |
| 2026-06-12 | **`CLAUDE.md` thin + spec dày tách sang `docs/`** — file auto-nạp đừng để phình, tốn context mỗi turn. | mọi project | `05-TAI-LIEU-CHUAN.md §2`; `todo/CLAUDE.md` (mẫu đã slim 641→327 dòng) |
| 2026-06-12 | **Endpoint client-máy gọi (MCP/OAuth/webhook/health) KHÔNG được sau forward-auth** — tách router riêng, auth ở tầng app. | web-app có Authentik | `CLAUDE.md` bất biến #8; `coding-convention §9`; `authentik/docs/auth-apps.md` |

---

## B. Con trỏ tới sổ tri thức từng project

> Mỗi project có `docs/decisions.md` riêng (nếu đã lập). Bảng này chỉ là mục lục — đọc chi tiết ở file đó.

| Project | Sổ tri thức | Ghi chú |
|---------|-------------|---------|
| todo | `todo/docs/decisions.md` | _(sẽ lập ở Phase 1)_ |
| journal | `journal/docs/decisions.md` | _(sẽ lập ở Phase 2)_ |
| yakudoku | `yakudoku/docs/decisions.md` | _(sẽ lập ở Phase 2)_ |
| jobhunter-bot | `jobhunter-bot/docs/decisions.md` | _(sẽ lập ở Phase 2)_ |
| nuc-monitor | `nuc-monitor/docs/decisions.md` | _(sẽ lập ở Phase 2)_ |
| nuc-ops-bot | `nuc-ops-bot/docs/decisions.md` | _(sẽ lập ở Phase 2)_ |

> Khi một project lập `decisions.md`, đổi "_(sẽ lập…)_" thành ghi chú thật + ngày. Project chưa có dòng
> ở đây mà đã có `decisions.md` → bổ sung dòng (việc của `/session-wrap`).
