---
name: nuc-health-audit
description: Soát sức khỏe & đồng bộ toàn bộ NUC platform — đối chiếu INVENTORY.md với thực tế (container/volume/route/Authentik), tìm orphan (volume mồ côi, dangling image, provider treo), kiểm mọi subdomain còn sống, Watchtower còn quét, dung lượng đĩa/RAM, vệ sinh secret (.env chmod 600), và baseline nuc-monitor. Dùng khi user nói "soát/kiểm tra/audit hệ thống", "dọn dẹp NUC", "mọi thứ ổn không", "có gì rác không", hoặc chạy định kỳ.
---

# Skill: Soát sức khỏe & đồng bộ NUC platform

Mục tiêu: bắt **drift** (bảng ↔ thực tế lệch) và **rác** (orphan) TRƯỚC khi chúng thành "lỗi
vặt". Skill này **chỉ đọc & báo cáo**; mọi hành động phá hủy (xóa volume/image) phải **hỏi user**
và chỉ làm khi được đồng ý. Nguồn sự thật: [`nuc-platform/INVENTORY.md`](../../../nuc-platform/INVENTORY.md).

SSH NUC: `ssh thien25@thienminiserver`. Chạy lần lượt các nhóm kiểm tra A–K (A–J qua SSH; K chạy local), gom kết quả thành
một báo cáo có mục ✅/⚠️/❌ rồi đề xuất fix.

## A. Drift: INVENTORY ↔ thực tế

```bash
ssh thien25@thienminiserver '
echo "[dirs]"; ls -1 /opt/apps/
echo "[running]"; docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"
echo "[all]"; docker ps -a --format "{{.Names}}\t{{.Status}}"'
```
Đối chiếu với §1 INVENTORY: mỗi app trong bảng phải có dir + container `Up`; mỗi dir/container
phải có hàng trong bảng. Lệch (app trong bảng không chạy, hoặc container lạ không có trong bảng,
hoặc image tag khác bảng) → ⚠️ liệt kê cụ thể.

## B. Volume mồ côi

```bash
ssh thien25@thienminiserver '
for v in $(docker volume ls -q); do
  c=$(docker ps -a --filter volume=$v --format "{{.Names}}" | tr "\n" "," )
  [ -z "$c" ] && echo "ORPHAN: $v" || echo "ok: $v -> $c"
done'
```
Volume `ORPHAN` (0 container) → ⚠️. **Không tự xóa** — đối chiếu INVENTORY §5, NHÌN xem volume
chứa gì (`docker run --rm -v <vol>:/d alpine ls -la /d`), rồi hỏi user trước khi `docker volume rm`.

## C. Dangling images

```bash
ssh thien25@thienminiserver 'docker images -f dangling=true -q | wc -l; docker system df'
```
> 0 → đề xuất `docker image prune` (an toàn, chỉ xóa layer không tag). Hỏi trước khi chạy.

## D. Mọi subdomain public còn sống

Lấy danh sách Host từ compose, curl từng cái:
```bash
ssh thien25@thienminiserver '
for h in $(grep -rhoP "Host\(\`\K[^\`]+" /opt/apps/*/docker-compose.yml | sort -u); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://$h/")
  echo "$h -> $code"
done'
```
Kỳ vọng: app mở → `200`; app gated (forward-auth) → `302` sang auth. `404/502/530/000` → ❌
(404=mất route, 502=app chết, 530=tunnel, 000=DNS) — soi bảng debug `01-KIEN-TRUC...` §7.

## E. Authentik: providers ↔ registry

```bash
ssh thien25@thienminiserver '
T=$(grep "^AUTHENTIK_BOOTSTRAP_TOKEN=" /opt/apps/authentik/.env | cut -d= -f2-)
B=https://auth.thientnse.site/api/v3
curl -s -H "Authorization: Bearer $T" "$B/providers/proxy/?page_size=50" | jq -r ".results[]|\"\(.pk) \(.name) \(.mode) \(.external_host)\""
echo "--- outpost providers ---"
curl -s -H "Authorization: Bearer $T" "$B/outposts/instances/?page_size=20" | jq -r ".results[]|select(.name|test(\"Embedded\";\"i\")).providers"'
```
Đối chiếu §3 INVENTORY + `auth-apps.md`. Provider trỏ tới domain của app **đã gỡ** = treo → ⚠️
(dọn theo `/nuc-remove-project` G3). Mỗi provider phải nằm trong `providers` của outpost.

## F. Watchtower còn quét

```bash
ssh thien25@thienminiserver 'docker logs watchtower --since 5m 2>&1 | tail -5'
```
Phải thấy "Scanned=N Updated Failed=0". `Failed>0` → ⚠️ (thường là credential ghcr hết hạn,
xem doc 02 §4.4 / 01 §6.11). Kiểm app có label `watchtower.enable` khớp INVENTORY (authentik/n8n
KHÔNG được có label này).

## G. Đĩa / RAM / tải

```bash
ssh thien25@thienminiserver 'df -h / ; echo; free -h ; echo; uptime'
```
Đĩa `/` > 80% hoặc RAM còn rất ít → ⚠️ (nuc-monitor cũng cảnh báo realtime; đây là điểm chốt thủ công).

## H. Hạ tầng & sức khỏe container

```bash
ssh thien25@thienminiserver 'docker ps -a --format "{{.Names}}\t{{.Status}}" | grep -iE "restart|exited|unhealthy" || echo "all healthy"'
```
Container `Restarting`/`Exited`/`unhealthy` → ❌ điều tra `docker logs <name> --tail 50`.
traefik + cloudflared phải `Up` (nếu chết → web toàn hệ thống sập).

## I. Vệ sinh secret

```bash
ssh thien25@thienminiserver '
for d in /opt/apps/*/ /opt/infra/; do
  f="$d.env"; [ -f "$f" ] && stat -c "%a %n" "$f"
done'
```
`.env` phải là `600`. Khác → ⚠️ `chmod 600`. (Nhắc bất biến #4: secret chỉ trong `.env`,
không hardcode trong compose/Dockerfile/code.)

## J. Baseline nuc-monitor

```bash
ssh thien25@thienminiserver 'docker logs nuc-monitor --tail 20 2>&1 | grep -iE "tracking|container" | tail -3'
```
Số container nuc-monitor đang theo dõi phải khớp số container thật (trừ chính nó nếu nó tự loại).
Lệch → có thể còn `known_containers` cũ; restart nuc-monitor để reset baseline nếu cần.

## K. Doc-set drift (tài liệu ↔ chuẩn) — chạy LOCAL trên máy dev

Đối chiếu mỗi project trong `INVENTORY §0` với bộ file bắt buộc theo `kind`
(`nuc-platform/05-TAI-LIEU-CHUAN.md §3`). Kiểm trên thư mục dev `D:\Projects\MiniServer\<tên>`
(KHÔNG qua SSH — doc-set sống ở repo dev):

```bash
for d in /d/Projects/MiniServer/*/; do
  p=$(basename "$d"); [ -f "$d/docs/00-map.md" ] && m=ok || m=THIẾU
  [ -f "$d/docs/decisions.md" ] && k=ok || k=THIẾU
  echo "$p: 00-map=$m decisions=$k"
done
```

- Project có CODE (`web-app`/`worker`/`monorepo`) mà thiếu `docs/00-map.md` hoặc `docs/decisions.md` → ⚠️
  đề xuất `/project-docs scaffold`.
- web-app/monorepo thiếu `01-product`/`02-technical`/`03-user-guide` → ⚠️.
- `infra`/`meta`: chỉ cần `00-map` (+README) — thiếu deep docs là bình thường.
- Muốn soi sâu một project (map có khớp code không) → `/project-docs audit <project>`.

---

## Báo cáo

Trình bày gọn theo nhóm A–K, mỗi mục ✅/⚠️/❌ + bằng chứng 1 dòng. Cuối báo cáo:
1. **Drift cần sửa** (bảng vs thực tế) — đề xuất cập nhật INVENTORY hay sửa thực tế.
2. **Rác đề xuất dọn** (orphan volume, dangling image, provider treo) — **liệt kê lệnh nhưng
   HỎI user trước khi chạy** thứ phá hủy.
3. **Cảnh báo sức khỏe** (đĩa, container lỗi, secret hở).

Nếu user đồng ý dọn orphan/drift → thực hiện, rồi cập nhật INVENTORY.md cho khớp.
**Không bao giờ** tự xóa volume/image/provider khi chưa được đồng ý.
