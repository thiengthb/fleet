<!--
  TEMPLATE docs/00-map.md — AI-primer. Chuẩn: nuc-platform/05-TAI-LIEU-CHUAN.md §4.
  Điền nội dung THẬT của project; xóa mọi dòng <!-- hướng dẫn --> và placeholder <...> trước khi lưu.
  Mục tiêu: ≤ ~1 trang, đọc xong nắm project mà chưa mở code. Ưu tiên bảng + cây + gạch đầu dòng.
-->

# <tên project> — Bản đồ

> Một câu: <app này là gì, cho ai>. `kind`: <web-app|monorepo|worker|infra|meta>. Deploy: <domain hoặc "headless (không Traefik)"> · NUC `/opt/apps/<tên>`.

## 1. Bản chất

<2–4 dòng: vấn đề nó giải · giá trị cốt lõi · điều KHÔNG phải mục tiêu của nó.>

## 2. Stack

| Lớp | Công nghệ |
|-----|-----------|
| Framework | <...> |
| UI | <... hoặc "headless"> |
| Data | <...> |
| AI / ngoài | <...> |
| Deploy | <Docker → ghcr → Watchtower → Traefik … hoặc đặc thù worker/infra> |

## 3. Module map / entry points

```
<cây thư mục RÚT GỌN — chỉ phần quan trọng, mỗi dòng kèm "làm gì">
```

## 4. Luồng chính

<1–3 luồng quan trọng nhất, mỗi luồng đánh số vài bước. Ghi thẳng bẫy / trust-boundary nếu có.>

## 5. Điểm sáng

- <cái khéo / non-obvious đáng biết: tính ĐỘNG thay vì lưu cột? trust boundary server recompute? topo nhiều image? …>

## 6. Bất biến

- <luật KHÔNG được phá khi sửa project này — cô đọng từ CLAUDE.md + platform; mỗi dòng 1 bất biến.>

## 7. Secrets / env

| Biến | Dùng để | Nằm ở | Build-time? |
|------|---------|-------|-------------|
| `<TÊN>` | <...> | <.env NUC / GitHub Secret / Variable> | <có/không> |

> Chỉ ghi TÊN biến, KHÔNG ghi giá trị.

## 8. Đọc thêm

- Chi tiết kỹ thuật: `docs/02-technical.md` <hoặc "(không có — xem code")>
- Vì sao + bẫy: `docs/decisions.md`
- Hạ tầng/deploy: `INVENTORY.md §<n>` · skill liên quan: `/<...>`
