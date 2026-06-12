---
name: nuc-remove-project
description: Gỡ/khai tử một project khỏi NUC platform một cách trọn vẹn và an toàn — xóa code local, hạ container + volume + image + thư mục trên NUC, dọn cấu hình Authentik (provider/app/group) nếu có, xác minh subdomain đã chết, cập nhật INVENTORY.md + auth-apps.md, và hướng dẫn xóa GitHub repo + ghcr package. Dùng khi user nói "gỡ/xóa/bỏ/khai tử project X", "tôi không dùng app X nữa", "dọn dẹp X trên mini server".
---

# Skill: Gỡ project khỏi NUC platform (an toàn, không sót)

Đây là quy trình NGƯỢC của `/nuc-new-project`. Mục tiêu: gỡ sạch một project mà **không
ảnh hưởng service khác** và **không để lại rác** (volume mồ côi, provider Authentik treo,
dòng registry sai, nuc-monitor báo nhiễu). Làm TUẦN TỰ; mỗi giai đoạn có KIỂM CHỨNG.

Các bất biến trong `D:\Projects\MiniServer\CLAUDE.md` là luật. Nguồn sự thật về app:
[`nuc-platform/INVENTORY.md`](../../../nuc-platform/INVENTORY.md). SSH NUC: `ssh thien25@thienminiserver`.

> ⚠️ **Xóa volume = mất dữ liệu vĩnh viễn.** Trước khi hạ bất cứ thứ gì, NHÌN vào nó
> (volume chứa gì, có cần backup không) và **XÁC NHẬN với user** đúng project + chấp nhận mất
> dữ liệu. Nếu thực tế mâu thuẫn mô tả của user (vd app vẫn đang được service khác gọi) →
> dừng lại, báo user, đừng cứ thế xóa.

## Giai đoạn 0 — Xác nhận & lập bản kê thiệt hại

1. Hỏi/chốt với user: **tên project**, và xác nhận **chấp nhận mất toàn bộ dữ liệu** của nó.
2. Mở `INVENTORY.md` lấy đúng: domain, image, volume(s), mức auth (có provider/group Authentik
   riêng không), repo GitHub. Đây là danh sách những gì phải dọn.
3. Kiểm tra **không có service khác phụ thuộc** project này (vd app khác gọi API của nó,
   share volume). Nghi ngờ → hỏi user.
4. Chụp trạng thái nền để so sánh sau khi gỡ:
   ```bash
   ssh thien25@thienminiserver 'docker ps --format "{{.Names}}\t{{.Status}}"'
   ```
   Ghi nhớ các service khác đang `Up/healthy` — cuối quy trình chúng phải VẪN như vậy.

**KIỂM CHỨNG:** đã liệt kê đầy đủ {dir local, container, volume(s), image, dir NUC,
provider/app/group Authentik (nếu có), domain, repo} cho project này.

## Giai đoạn 1 — Xóa code local

```powershell
Remove-Item -Recurse -Force "D:\Projects\MiniServer\<tên>"
```
(Chỉ xóa thư mục project; KHÔNG đụng `.claude/`, `nuc-platform/`, hay project khác.)

## Giai đoạn 2 — Hạ trên NUC (container → volume → image → dir)

```bash
ssh thien25@thienminiserver
cd /opt/apps/<tên>
docker compose down                 # dừng + gỡ container/network của riêng app
# Xóa volume (LẤY TÊN TỪ INVENTORY — đừng đoán; tên volume có thể khác tên app):
docker volume rm <tên>_data         # lặp cho mọi volume của app
# Xóa image (lấy tên image từ INVENTORY):
docker rmi ghcr.io/thiengthb/<repo>:latest
cd / && rm -rf /opt/apps/<tên>
```

- Nếu `docker volume rm` báo "volume is in use" → còn container (kể cả stopped) tham chiếu;
  `docker ps -a --filter volume=<vol>` để tìm, gỡ nó trước.
- Cẩn thận `docker rmi`: nếu image bị app khác dùng chung (hiếm) thì giữ lại.

**KIỂM CHỨNG:**
```bash
docker ps -a --filter name=<tên>            # rỗng
docker volume ls | grep <tên>               # rỗng (kiểm mọi volume đã liệt kê)
ls /opt/apps/ | grep <tên>                  # rỗng
```

## Giai đoạn 3 — Dọn Authentik (CHỈ nếu app có cấu hình riêng)

Tra `INVENTORY.md` / `auth-apps.md`: app này có **provider/application/group RIÊNG** không?
- **Không** (app chỉ "đi nhờ" provider domain `NUC SSO` pk 1, hoặc app mở) → **bỏ qua giai đoạn này**.
- **Có** → xóa theo thứ tự: policy binding → application → provider → group (và gỡ provider khỏi outpost).

```bash
ssh thien25@thienminiserver
T=$(grep '^AUTHENTIK_BOOTSTRAP_TOKEN=' /opt/apps/authentik/.env | cut -d= -f2-)
B=https://auth.thientnse.site/api/v3
H=(-H "Authorization: Bearer $T" -H "Content-Type: application/json")

# 1) Tìm pk của application + provider + group của app:
curl -s "${H[@]}" "$B/core/applications/?search=<tên>"      | jq -r '.results[]|"\(.pk) \(.slug) provider=\(.provider)"'
curl -s "${H[@]}" "$B/providers/proxy/?search=<tên>"        | jq -r '.results[]|"\(.pk) \(.name)"'
curl -s "${H[@]}" "$B/core/groups/?search=<tên>"            | jq -r '.results[]|"\(.pk) \(.name)"'

# 2) Gỡ provider khỏi embedded outpost (giữ các provider còn lại):
OUTPOST=$(curl -s "${H[@]}" "$B/outposts/instances/?page_size=20" | jq -r '.results[]|select(.name|test("Embedded";"i")).pk')
CUR=$(curl -s "${H[@]}" "$B/outposts/instances/$OUTPOST/")
NEW=$(echo "$CUR" | jq -c --argjson p <PROVIDER_PK> '(.providers//[])|map(select(.!=$p))')
curl -s "${H[@]}" -X PATCH "$B/outposts/instances/$OUTPOST/" -d "{\"providers\":$NEW}" | jq -c '{providers}'

# 3) Xóa application → provider → group (HTTP 204 = OK):
curl -s "${H[@]}" -X DELETE "$B/core/applications/<APP_SLUG>/"   -o /dev/null -w "app:%{http_code}\n"
curl -s "${H[@]}" -X DELETE "$B/providers/proxy/<PROVIDER_PK>/"  -o /dev/null -w "provider:%{http_code}\n"
curl -s "${H[@]}" -X DELETE "$B/core/groups/<GROUP_PK>/"         -o /dev/null -w "group:%{http_code}\n"
```
(Xóa application thường tự gỡ policy binding gắn vào nó; nếu còn binding treo thì
`curl "$B/policies/bindings/?target=<APP_PK>"` rồi DELETE từng cái.)

**KIỂM CHỨNG:** search lại 3 endpoint trên → rỗng; outpost `providers` không còn pk vừa xóa.

## Giai đoạn 4 — Xác minh subdomain đã chết (nếu app public)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<sub>.thientnse.site/   # → 404 (Traefik không còn route)
```
404 là đúng (DNS wildcard vẫn trỏ, nhưng không còn router khớp Host). **Không** cần đụng Cloudflare.

## Giai đoạn 5 — nuc-monitor (thường KHÔNG cần làm gì)

Logic edge-triggered đã sửa (2026-06-11): khi container biến mất, nuc-monitor báo **đúng 1 lần**
mức warning ("Nếu bạn chủ động gỡ thì bỏ qua") rồi tự quên (`forget`). Vậy gỡ project xong là sạch.
- Chỉ cần để ý: nếu app có nhiều container, chúng sẽ lần lượt được "quên".
- Nếu muốn chặn cả cảnh báo 1-lần đó (gỡ có kế hoạch), thêm tên container vào `DOCKER_IGNORE`
  trong `/opt/apps/nuc-monitor/.env` TRƯỚC khi hạ — nhưng thường không cần.

## Giai đoạn 6 — GitHub repo + ghcr package (HƯỚNG DẪN user tự làm)

Việc này **không tự động hóa** (cần PAT scope `delete_repo` — không lưu token xóa repo trên máy
là an toàn hơn). Đưa user đúng các bước:

1. **Xóa ghcr package:** `https://github.com/users/thiengthb/packages/container/<repo>/settings`
   → "Delete this package".
2. **Xóa repo:** `https://github.com/thiengthb/<repo>/settings` → cuối trang → "Delete this repository".
   (Hoặc nếu có `gh` + token đủ quyền: `gh repo delete thiengthb/<repo> --yes`.)

Hỏi user có muốn xóa repo không — có project chỉ gỡ khỏi NUC nhưng vẫn giữ code trên GitHub.

## Giai đoạn 7 — Cập nhật registry (BẮT BUỘC — chống drift)

1. **`nuc-platform/INVENTORY.md`:** xóa hàng app khỏi §1; xóa hàng provider/group khỏi §3
   (nếu có); thêm một dòng vào §6 "App đã khai tử" với ngày + những gì đã xóa.
2. **`authentik/docs/auth-apps.md`** (nếu app có mặt ở đó): xóa mục của app, ghi chú "Removed
   YYYY-MM-DD".
3. Commit + push các repo doc bị sửa — **chỉ khi user yêu cầu** (theo luật git). Message kiểu:
   `docs(inventory): retire <tên> project` / `chore: tear down <tên>`.

## Giai đoạn 8 — Nghiệm thu (bắt buộc — chứng minh "không ảnh hưởng service khác")

```bash
ssh thien25@thienminiserver 'docker ps --format "{{.Names}}\t{{.Status}}"'
```
- ✅ Mọi service KHÁC vẫn `Up`/`healthy` đúng như ảnh chụp ở Giai đoạn 0.
- ✅ Không còn container/volume/dir/image/route/provider của project đã gỡ.
- ✅ (khuyến nghị) Chạy nhanh `/nuc-health-audit` để chắc không để lại orphan.

## Báo cáo cho user

Liệt kê đã xóa: {dir local, container, N volume, image, dir NUC, provider/group Authentik nếu
có}, subdomain → 404, INVENTORY/auth-apps đã cập nhật, và **việc còn lại của user**: xóa GitHub
repo + ghcr package (kèm 2 link ở Giai đoạn 6). Khẳng định các service khác không bị ảnh hưởng.

## Bẫy đã biết

- **Tên volume ≠ tên app.** Luôn lấy tên volume thật từ INVENTORY/`docker volume ls` — vụ
  link-manager để sót `backend_link_data` vì đoán nhầm thành `link-manager_data`.
- **Đừng xóa image dùng chung.** Image bên thứ 3 (postgres, redis…) có thể được app khác dùng.
- **`compose down -v` xóa volume luôn** — chỉ dùng khi chắc chắn; ở đây tách bước cho an toàn/rõ ràng.
- **Authentik không Watchtower** — không liên quan khi gỡ, nhưng đừng nhầm tay restart cả authentik.
