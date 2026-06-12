---
name: project-docs
description: Sinh & đồng bộ bộ tài liệu chuẩn cho một project trong MiniServer (00-map AI-primer, decisions sổ tri thức, và bộ 01/02/03 cho web-app) theo chuẩn nuc-platform/05-TAI-LIEU-CHUAN.md. Hai mode — scaffold (tạo file docs còn thiếu, copy cấu trúc từ app tham chiếu của kind) và audit (dò drift code↔docs, báo cáo read-only). Dùng khi tạo project mới, project thiếu/lệch tài liệu, user nói "viết tài liệu cho project này", "docs có còn khớp code không", hoặc bước tài liệu trong /nuc-new-project.
---

# Skill: Tài liệu chuẩn cho project (project-docs)

Sinh và giữ đồng bộ bộ tài liệu theo **`nuc-platform/05-TAI-LIEU-CHUAN.md`** (đọc nó trước — đó là
hợp đồng; skill này chỉ là quy trình thực thi). Mục tiêu cuối: mỗi project có `docs/00-map.md` (agent
hiểu trong 1 lần đọc rẻ) + `docs/decisions.md` (tri thức tích lũy), web-app thì đủ thêm bộ 01/02/03.

**Không tự chế cấu trúc khác** với §3/§4/§5 của 05-TAI-LIEU-CHUAN. Nếu thấy chuẩn cần đổi → sửa file
chuẩn trước, rồi mới theo.

## Bước 0 — Xác định project & kind

1. Project nào (thư mục dưới `D:\Projects\MiniServer\<tên>`)?
2. Tra `kind` trong `nuc-platform/INVENTORY.md §0`. Chưa có dòng → đây là project mới: hỏi user kind
   (`web-app`/`monorepo`/`worker`/`infra`/`meta`) và **thêm dòng §0 trước** (chống drift).
3. `kind` quyết định bộ file bắt buộc (bảng §3 của 05-TAI-LIEU-CHUAN) + **app tham chiếu để copy**:

| kind | Tham chiếu copy cấu trúc | Bộ file bắt buộc |
|------|--------------------------|------------------|
| `web-app` (Next) | `todo/docs/` | 00-map · decisions · README · 01-product · 02-technical · 03-user-guide |
| `monorepo` | `todo/docs/` (02-technical mô tả topo nhiều image như `yakudoku`) | như web-app |
| `worker` (node-bot/python-worker) | `nuc-monitor/` (cấu trúc gọn) | 00-map · decisions · README |
| `infra` | `authentik/docs/` | 00-map · decisions · README |
| `meta` | — | README · (decisions nếu có giá trị) |

## Mode A — scaffold (tạo file còn thiếu)

Chạy khi project thiếu doc-set (project mới, hoặc cũ mà trống).

1. **Đọc code đủ để hiểu thật** (đừng bịa): entry points (`app/`, `src/`, `index.*`, `main.py`),
   `package.json`/`requirements.txt` (stack), Prisma schema / models, route handlers + server actions,
   `Dockerfile` + `deploy.yml` (deploy), `.env.example` (secrets — chỉ TÊN biến). Với web-app dùng
   `/coding-convention` làm nền hiểu stack.
2. **Sinh `docs/00-map.md`** theo đúng 8 mục khung §4 của 05-TAI-LIEU-CHUAN. Quy tắc rẻ token: bảng +
   cây thư mục rút gọn + gạch đầu dòng; mỗi mục vài dòng; trỏ docs sâu thay vì chép. Mục 5 "Điểm sáng"
   phải nêu cái khéo/non-obvious thật (tính động? trust boundary? topo lạ?) — đừng để trống nếu có.
3. **Sinh `docs/decisions.md`** từ template `templates/decisions.md` (header + 1 mục seed nếu rút được
   quyết định non-obvious từ code/CLAUDE.md/INVENTORY; nếu chưa có gì đáng ghi → để header + ghi chú "chưa
   có mục nào").
4. **web-app/monorepo**: sinh thêm `docs/README.md` (index — copy bảng kiểu `todo/docs/README.md`),
   `01-product.md`, `02-technical.md`, `03-user-guide.md`. Copy **bố cục mục** từ `todo/docs/` rồi điền
   nội dung THẬT của project (không để placeholder của todo sót lại).
5. **`CLAUDE.md` thin**: nếu chưa có → tạo bản ngắn (rule + bất biến riêng project + con trỏ "đọc
   `docs/00-map.md`"). Nếu đã có mà phình spec → đề xuất tách spec sang `docs/` (như `todo` đã làm), HỎI
   trước khi cắt.
6. **Cập nhật index**: thêm/sửa dòng project trong `nuc-platform/06-SO-TRI-THUC.md §B`.
7. **KHÔNG tự commit/push.** Báo cáo file đã tạo, để user xem. Push repo app = trigger CI → hỏi user.

## Mode B — audit (dò drift code↔docs)

Chạy khi muốn biết docs còn khớp code không (read-only — chỉ báo cáo, như `/nuc-health-audit`).

Đối chiếu và liệt kê lệch:
- **Module map (`00-map §3`) vs thực tế**: route/model/lib/thư mục mới chưa có trong map? Mục map trỏ
  file đã xóa/đổi tên?
- **Stack (`00-map §2`) vs `package.json`/`requirements.txt`**: lệch version lớn / lib đã bỏ?
- **Secrets (`00-map §7`) vs `.env.example`**: biến mới chưa ghi?
- **Đủ bộ theo kind chưa** (bảng §3): file bắt buộc nào còn thiếu?
- **`decisions.md`**: có quyết định lớn trong git gần đây mà chưa được ghi không? (gợi ý chạy
  `/session-wrap`.)

Báo cáo theo mục ✅/⚠️, mỗi lệch 1 dòng + đề xuất sửa. **Không tự sửa file** trừ khi user đồng ý; sửa
xong vẫn KHÔNG commit/push khi chưa được yêu cầu.

## Nghiệm thu

- `docs/00-map.md` đọc một lần là nắm project; module map khớp code; mục "Điểm sáng" + "Bất biến" có thật.
- Đủ bộ file theo `kind` (bảng §3 của 05-TAI-LIEU-CHUAN).
- `INVENTORY §0` có dòng project; `06-SO-TRI-THUC §B` có con trỏ.
- Không có placeholder/nội dung của app tham chiếu sót lại.
