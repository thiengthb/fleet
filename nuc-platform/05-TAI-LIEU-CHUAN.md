# 05 — Chuẩn tài liệu MiniServer (Knowledge OS)

> **Hợp đồng tài liệu** áp cho MỌI project trong `D:\Projects\MiniServer\`. Mục đích: agent (và người)
> **hiểu một project trong 1 lần đọc rẻ tiền**, và tri thức không-hiển-nhiên **tích lũy qua các session**
> thay vì tan biến. Đây là nguồn sự thật mà 2 skill `/project-docs` và `/session-wrap` tham chiếu.
>
> Lập 2026-06-12. Nguồn cảm hứng + mẫu vàng: bộ tài liệu của `todo/`.

---

## 1. Vì sao có file này

Trước 2026-06-12 độ chín tài liệu giữa các project lệch nhau rất nặng (`todo` đủ bộ; `journal` trống
trơn; worker chỉ có README). Hậu quả: mỗi lần agent đụng một project, nó phải **đọc lại code từ đầu để
hiểu** → tốn token, và **lý do đằng sau code** (vì sao chọn cách này, bẫy đã gặp) không được ghi → session
sau lặp lại sai lầm cũ.

Chuẩn này giải đúng hai việc đó:

1. **Đường nạp context cố định & rẻ** — agent luôn biết đọc gì trước, dừng sớm khi đủ.
2. **Cơ chế compounding** — mỗi session ghi lại tri thức mới vào sổ committed → session sau thông minh hơn.

---

## 2. Đường nạp context — 3 nấc (BẤT BIẾN)

Agent vào bất kỳ project nào đi đúng thứ tự này, **dừng ngay khi đủ cho task**:

```
Nấc 0 — INVENTORY §0            (1 bảng)      → project này là gì, kind nào, ở đâu
Nấc 1 — <project>/docs/00-map.md (1 trang)    → hiểu bản chất + module map + luồng + bất biến
Nấc 2 — docs/ sâu               (theo task)   → 01-product / 02-technical / 03-user-guide / *-spec
        + docs/decisions.md      (đuôi file)   → vì sao code thế này, bẫy đã biết
```

- `CLAUDE.md` mỗi project là file Claude Code **tự nạp** (đi ngược cây thư mục). Vì auto-nạp tốn context
  mỗi turn → giữ **thin**: chỉ rule + bất biến riêng project + con trỏ "đọc `docs/00-map.md` để nắm".
  **KHÔNG** nhồi module map / luồng / spec vào `CLAUDE.md` — chỗ đó là của `docs/`.
- `docs/00-map.md` là artifact tiết kiệm token cốt lõi: đọc nó xong là "nắm" được project mà chưa cần mở
  code. Luôn ở đúng path này, mọi kind.
- Đọc `docs/` sâu **chỉ khi task cần** (sửa AI → đọc 02-technical §AI; viết hướng dẫn → 03-user-guide…).

---

## 3. Bộ tài liệu chuẩn theo `kind` (tiered)

`kind` lấy từ `INVENTORY.md §0`. Cột ✅ = bắt buộc, ➖ = không cần, "tùy" = khi có giá trị.

| File | `web-app` / `monorepo` | `worker`<br/>(node-bot / python-worker) | `infra` | `meta` |
|------|:---:|:---:|:---:|:---:|
| `README.md` (gốc repo — cho người ghé GitHub) | ✅ | ✅ | ✅ | ✅ |
| `CLAUDE.md` (thin: rule + bất biến + con trỏ) | ✅ | ✅ ngắn | tùy | tùy |
| **`docs/00-map.md`** (AI-primer — §4) | ✅ | ✅ | ✅ | ✅ |
| **`docs/decisions.md`** (sổ tri thức — §5) | ✅ | ✅ | ✅ | tùy |
| `docs/README.md` (index bộ docs) | ✅ | ➖ | ➖ | ➖ |
| `docs/01-product.md` (vì sao / triết lý / người dùng) | ✅ | ➖ | ➖ | ➖ |
| `docs/02-technical.md` (kiến trúc / data model / luồng / deploy chi tiết) | ✅ | ➖ | ➖ | ➖ |
| `docs/03-user-guide.md` (hướng dẫn người dùng cuối) | ✅ | ➖ | ➖ | ➖ |
| `docs/NN-*-spec.md` (đặc tả tính năng sâu, nạp on-demand) | tùy | ➖ | ➖ | ➖ |

**Hai trụ cột mới mọi project đều có:** `docs/00-map.md` (cái rẻ-để-đọc) + `docs/decisions.md` (cái
compounding). Worker/infra dừng ở đó là đủ — KHÔNG ép bộ 01/02/03 cho bot headless (thừa, tốn công).

> Mẫu vàng `web-app`: `todo/docs/` (đủ 01/02/03/04 + README). `00-map.md` của `todo` chính là bản chắt
> lọc §3 (module map) + §4 (luồng) của `todo/docs/02-technical.md`.

---

## 4. `docs/00-map.md` — khung BẮT BUỘC (AI-primer)

Mục tiêu: **≤ ~1 trang**, đọc xong là nắm project mà chưa mở code. Viết đặc, không lan man. 8 mục cố
định (giữ đúng thứ tự + tiêu đề để agent quét nhanh):

```markdown
# <tên project> — Bản đồ

> Một câu: <app này là gì, cho ai>. `kind`: <web-app|worker|…>. Deploy: <domain hoặc "headless"> · NUC `/opt/apps/<tên>`.

## 1. Bản chất
2–4 dòng: vấn đề nó giải, giá trị cốt lõi, điều KHÔNG phải mục tiêu của nó.

## 2. Stack
Bảng ngắn: framework · UI · data · AI/ngoài · deploy. (web-app theo stack chuẩn /coding-convention.)

## 3. Module map / entry points
Cây thư mục RÚT GỌN — chỉ thư mục/file quan trọng + 1 dòng "làm gì". Đây là phần agent dùng nhiều nhất.
(Mẫu: todo/docs/02-technical.md §3.)

## 4. Luồng chính
1–3 luồng quan trọng nhất, mỗi luồng vài bước đánh số (vd: mutation, gọi AI, cron). Bẫy/trust-boundary ghi thẳng.

## 5. Điểm sáng
Cái khéo / không-hiển-nhiên đáng biết: tính ĐỘNG thay vì lưu cột? trust boundary? quyết định kiến trúc lạ?
(Đây là "điểm sáng" để người + AI hiểu nhanh chỗ tinh tế — đừng bỏ trống nếu project có gì đặc biệt.)

## 6. Bất biến
Luật KHÔNG được phá khi sửa project này (cô đọng từ CLAUDE.md + platform). Mỗi dòng 1 bất biến.

## 7. Secrets / env
Biến nào cần để chạy (TÊN thôi, KHÔNG giá trị) + nằm ở đâu (.env NUC / GitHub Secret / Variable). Biến build-time đánh dấu.

## 8. Đọc thêm
Con trỏ: docs sâu nào cho việc gì · `docs/decisions.md` (vì sao + bẫy) · INVENTORY §<n> · skill liên quan.
```

**Quy tắc viết cho rẻ token:** ưu tiên bảng + cây + gạch đầu dòng hơn văn xuôi; mỗi mục vài dòng; trỏ
sang docs sâu thay vì chép lại; tránh lặp những gì `CLAUDE.md` đã nói (link, đừng copy).

---

## 5. `docs/decisions.md` — sổ tri thức (cơ chế compounding)

Append-only, **mới nhất lên đầu**. Ghi tri thức **non-obvious**: quyết định kiến trúc + lý do, bẫy đã
gặp + cách tránh, đánh đổi đã cân. **KHÔNG** ghi cái code/git tự nói (đổi tên biến, fix typo).

Mỗi mục đúng khung này (ngắn — 4 dòng là đủ):

```markdown
## YYYY-MM-DD — <tiêu đề quyết định/bẫy, 1 dòng>

**Bối cảnh:** vì sao phải quyết định này (1–2 câu).
**Chốt / Bẫy:** đã chọn gì, hoặc bẫy là gì.
**Vì sao:** lý do + cái đã loại bỏ (đây là phần quý nhất — đừng bỏ).
**Liên quan:** `file.ts:42` · [[tên-khác]] · INVENTORY §n.
```

Tiêu chí "có đáng ghi không?" — hỏi: *nếu session sau không biết điều này, nó có lặp lại sai lầm /
phá một bất biến / tốn thời gian dò lại không?* Có → ghi. Đây là việc của skill `/session-wrap`.

> Khác với `nuc-platform/02-MO-XE-LOI-HE-THONG-CU.md` (bẫy cấp **hệ thống/platform**) và
> `06-SO-TRI-THUC.md` (index xuyên project). `decisions.md` là bẫy + quyết định **riêng một project**.

---

## 6. Quan hệ với memory cá nhân (`~/.claude/.../memory`)

- `docs/decisions.md` = tri thức **của project**, committed, ai cũng đọc, đi theo repo.
- Memory cá nhân = sở thích/feedback **của user**, riêng tư, theo máy. KHÔNG trùng vai.
- Quy tắc: tri thức về *code/quyết định project* → `decisions.md`. Feedback *cách user muốn làm việc* →
  memory. Bài học *xuyên nhiều project* → `06-SO-TRI-THUC.md` (index).

---

## 7. Cưỡng chế (giữ docs không trôi khỏi code) — nhẹ

- **Skill `/project-docs`** scaffold (sinh bộ docs còn thiếu, copy từ app tham chiếu của kind) + audit
  (dò drift code↔docs, báo cáo read-only).
- **Skill `/session-wrap`** cuối phiên: rút quyết định/bẫy → `decisions.md`; cập nhật `00-map` nếu module
  map đổi; 1 dòng vào `06-SO-TRI-THUC.md` nếu xuyên project.
- **Pre-commit hook nhẹ** (`coding-convention/hooks/pre-commit`): commit đụng code mà KHÔNG đụng `docs/`
  → cảnh báo **non-blocking** (không chặn). Nhắc, không cản.
- **`/nuc-new-project`**: project sinh ra là đã chạy `/project-docs scaffold` → born-documented.
- **`/nuc-health-audit`**: kiểm mọi project §0 có đủ doc-set theo bảng §3 (drift cấp platform).

---

## 8. Checklist nhanh khi đụng một project

- [ ] Có `docs/00-map.md` đủ 8 mục §4 chưa? Thiếu → `/project-docs scaffold`.
- [ ] Module map / luồng trong `00-map` còn khớp code không? Lệch → cập nhật (hoặc `/project-docs audit`).
- [ ] Phiên này có quyết định/bẫy non-obvious không? Có → ghi `docs/decisions.md` (qua `/session-wrap`).
- [ ] `CLAUDE.md` còn thin không (không phình spec)? Spec dày → tách sang `docs/`.
- [ ] Bài học xuyên project? → thêm 1 dòng `06-SO-TRI-THUC.md`.
