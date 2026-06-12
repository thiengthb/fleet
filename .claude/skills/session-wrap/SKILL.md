---
name: session-wrap
description: Chốt một phiên làm việc trên project MiniServer — rút tri thức non-obvious của phiên (quyết định kiến trúc + bẫy + lý do) ghi vào docs/decisions.md, cập nhật docs/00-map.md nếu module map đổi, thêm 1 dòng vào nuc-platform/06-SO-TRI-THUC.md nếu bài học xuyên project, và gợi ý memory cá nhân. Mục đích — khiến session sau thông minh hơn. Dùng khi user nói "chốt phiên", "wrap up", "ghi lại những gì học được", "cập nhật tài liệu sau khi xong", hoặc cuối một đợt sửa đáng kể.
---

# Skill: Chốt phiên & tích lũy tri thức (session-wrap)

Đây là cơ chế **compounding**: biến những gì vừa làm trong phiên thành tri thức committed để session sau
đọc được. Chuẩn ghi + chỗ ghi theo `nuc-platform/05-TAI-LIEU-CHUAN.md §5–§6`. Chạy ở CUỐI một đợt làm
việc đáng kể (không phải mỗi sửa lặt vặt).

Nguyên tắc lọc: **chỉ ghi cái non-obvious** — thứ mà nếu session sau không biết sẽ *lặp lại sai lầm /
phá một bất biến / tốn công dò lại*. Cái code và `git log` đã tự nói (đổi tên, fix typo, thêm field hiển
nhiên) → KHÔNG ghi.

## Bước 1 — Xác định phạm vi phiên

- Project nào (thư mục dưới `MiniServer/`)? Tra `kind` ở `INVENTORY §0`.
- Phiên này đã làm gì? Dựa vào: thay đổi đang có (`git status`/`git diff --stat`), các commit mới của
  phiên, và mạch hội thoại. Tóm tắt thầm 3–6 gạch đầu dòng "đã thay đổi gì".

## Bước 2 — Rút quyết định/bẫy → `docs/decisions.md`

Với mỗi điều non-obvious của phiên, hỏi 4 câu rồi viết 1 mục (mới nhất LÊN ĐẦU, đúng khung §5):

- **Bối cảnh** — vì sao phải quyết định?
- **Chốt / Bẫy** — đã chọn gì / bẫy là gì?
- **Vì sao** — lý do + phương án đã loại (phần quý nhất).
- **Liên quan** — `file:line`, `[[mục-khác]]`, `INVENTORY §n`.

Nếu project chưa có `docs/decisions.md` → tạo từ `project-docs/templates/decisions.md` trước (hoặc chạy
`/project-docs scaffold`). Không có gì non-obvious trong phiên → nói rõ "phiên này không sinh tri thức
mới đáng ghi" và bỏ qua, ĐỪNG bịa mục cho có.

## Bước 3 — Cập nhật `docs/00-map.md` nếu cần

Phiên có thêm/xóa/đổi vai module, route, model, hoặc luồng chính, hoặc đổi một bất biến/secret? → cập
nhật mục tương ứng của `00-map` (§3 module map, §4 luồng, §6 bất biến, §7 secrets). Map phải khớp code
sau phiên. Không đổi gì cấu trúc → để nguyên.

## Bước 4 — Bài học xuyên project → `06-SO-TRI-THUC.md`

Tri thức này áp cho **≥2 project** hoặc cho **chính platform**? → thêm 1 dòng vào mục A của
`nuc-platform/06-SO-TRI-THUC.md` (ngày · bài học 1 dòng · áp cho · con trỏ chi tiết). Nếu project lần
đầu lập `decisions.md` → thêm/sửa con trỏ ở mục B.

> Bẫy cấp **hạ tầng** (Docker/Traefik/Watchtower/Authentik) KHÔNG vào 06 — ghi
> `02-MO-XE-LOI-HE-THONG-CU.md`. Vòng đời app (thêm/gỡ/đổi domain) → `INVENTORY.md`.

## Bước 5 — Memory cá nhân (chỉ khi đúng loại)

Nếu trong phiên user bộc lộ **sở thích / cách muốn làm việc** (không phải tri thức về code) → cân nhắc
ghi memory cá nhân (`~/.claude/.../memory`) theo quy ước memory. Tri thức *về project* thì KHÔNG cho vào
memory — nó thuộc `decisions.md`. (Phân vai: xem `05-TAI-LIEU-CHUAN.md §6`.)

## Bước 6 — Báo cáo (KHÔNG tự commit/push)

Liệt kê gọn: mục nào đã thêm vào `decisions.md`, `00-map` sửa gì, có thêm dòng `06` không, memory nào
(nếu có). Các thay đổi tài liệu này nên đi **cùng commit với code của phiên** (theo gợi ý pre-commit
hook) — nhưng **chỉ commit/push khi user yêu cầu**. Nếu user muốn commit, gợi ý gộp docs vào commit code.
