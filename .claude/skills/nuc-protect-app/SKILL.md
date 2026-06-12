---
name: nuc-protect-app
description: Bảo vệ một app trên NUC platform bằng Authentik SSO (yêu cầu đăng nhập qua forward-auth, giới hạn ai được truy cập theo group, hoặc phân quyền trong app). Dùng khi user nói "bảo vệ project/app này", "bắt đăng nhập mới vào được", "chỉ tôi/nhóm X được truy cập", "gắn SSO/Authentik", hoặc thêm một app vào sau IdP.
---

# Skill: Bảo vệ app bằng Authentik (NUC platform)

Authentik là IdP trung tâm tại `https://auth.thientnse.site` (`/opt/apps/authentik`).
Tài liệu sống: repo `authentik/` (đặc biệt `authentik/docs/auth-apps.md` — registry mọi
provider/app, CẬP NHẬT sau mỗi lần dùng skill này) và `authentik/README.md`.
Các bất biến trong `D:\Projects\MiniServer\CLAUDE.md` mục "Authentik" là luật.

SSH NUC: `ssh thien25@thienminiserver`. App ở `/opt/apps/<tên>`.

## Khái niệm (đọc 1 lần)

- **Forward-auth = gác ở BIÊN.** Traefik gọi Authentik trước khi request tới app. Chưa
  đăng nhập → 302 sang `auth.thientnse.site`. Sau khi đăng nhập, Traefik tiêm header
  `X-authentik-email|username|groups|...` vào request. App KHÔNG cần code auth.
- Traefik ở đây **chỉ có docker provider** (không file provider) → middleware forward-auth
  khai báo bằng LABEL trên `authentik-server`, tham chiếu là **`authentik@docker`**.
- **2 tầng bảo vệ, chọn theo nhu cầu:**
  1. **Login gate** (mặc định): chỉ cần gắn middleware `authentik@docker` → bất kỳ user
     Authentik nào đăng nhập đều vào được. Đủ cho hầu hết app nội bộ.
  2. **Giới hạn AI được vào** (chặn cả user đã đăng nhập nếu không thuộc nhóm): app có
     **provider `forward_single` riêng + application riêng + policy gắn group**. Khớp host
     chính xác thắng provider `forward_domain` chung → policy của app này có hiệu lực.
- **Phân quyền TRONG app** (đọc/ghi, role) = app tự đọc header `X-authentik-groups` Traefik tiêm vào
  (trong Next.js: `headers()` ở Server Component / route handler / server action).
- **OIDC (login trong app, không phải gác biên)** chỉ dùng khi app thực sự cần phiên OIDC
  riêng (hiếm) → xem guide §4 (Auth.js + Authentik), tạo OAuth2/OpenID Provider.
- ⛔ **TUYỆT ĐỐI không gắn forward-auth lên endpoint mà client máy (script/cron/ollama/
  webhook) gọi tự động** — sẽ bị redirect HTML và hỏng. Endpoint máy: để router riêng
  KHÔNG middleware, hoặc dùng API token Authentik / client_credentials.

## Giai đoạn 0 — Xác định mức bảo vệ (hỏi user nếu chưa rõ)

1. App đã chạy public trên NUC chưa? (có router `Host(...)` trong `/opt/apps/<tên>/docker-compose.yml`).
   Chưa → chạy skill `nuc-new-project` trước, rồi quay lại.
2. Mức nào?
   - **(A) Chỉ cần đăng nhập** (bất kỳ user Authentik) → Giai đoạn 2.
   - **(B) Chỉ một số người/nhóm** được vào → Giai đoạn 2 + 3.
   - **(C) Phân quyền chi tiết trong app** (đọc/ghi…) → 2 (+3 nếu cần) + 4, và app phải sửa code.
3. Có endpoint nào client MÁY gọi tự động không? → tách router riêng, KHÔNG middleware (xem Khái niệm).

## Chuẩn bị — token + ID (mọi giai đoạn API dùng)

```bash
ssh thien25@thienminiserver
T=$(grep '^AUTHENTIK_BOOTSTRAP_TOKEN=' /opt/apps/authentik/.env | cut -d= -f2-)  # token admin
B=https://auth.thientnse.site/api/v3
H=(-H "Authorization: Bearer $T" -H "Content-Type: application/json")
# Flow PK (ổn định, nhưng nên fetch lại cho chắc):
AUTHZ=$(curl -s "${H[@]}" "$B/flows/instances/default-provider-authorization-implicit-consent/" | jq -r .pk)
INVAL=$(curl -s "${H[@]}" "$B/flows/instances/default-provider-invalidation-flow/" | jq -r .pk)
OUTPOST=$(curl -s "${H[@]}" "$B/outposts/instances/?page_size=20" | jq -r '.results[]|select(.name|test("Embedded";"i")).pk')
```

## Giai đoạn 2 — Login gate (gắn middleware)

Sửa `/opt/apps/<tên>/docker-compose.yml`, thêm vào router của app (giữ backup `.pre-authentik.bak`):

```yaml
- "traefik.http.routers.<tên>.middlewares=authentik@docker"
```
Rồi `cd /opt/apps/<tên> && docker compose up -d`.

**KIỂM CHỨNG:** `curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<sub>.thientnse.site/`
→ **302** sang `auth.thientnse.site/application/o/authorize/...`. Nếu 404 ngay sau recreate:
chờ container healthy rồi thử lại (Traefik bỏ route trong lúc recreate).

> Nếu chỉ cần mức (A): xong, sang Giai đoạn 6.

## Giai đoạn 3 — Giới hạn ai được vào (app riêng + group policy)

Tạo provider `forward_single` + application + group + policy binding, rồi gắn vào outpost:

```bash
# 1) Provider riêng cho app (khớp host chính xác → thắng provider domain chung)
PPK=$(curl -s "${H[@]}" -X POST "$B/providers/proxy/" -d "$(jq -n --arg a "$AUTHZ" --arg i "$INVAL" \
  '{name:"<tên>",authorization_flow:$a,invalidation_flow:$i,mode:"forward_single",external_host:"https://<sub>.thientnse.site"}')" | jq -r .pk)
# 2) Application
APK=$(curl -s "${H[@]}" -X POST "$B/core/applications/" -d "$(jq -n --argjson p "$PPK" '{name:"<Tên>",slug:"<tên>",provider:$p}')" | jq -r .pk)
# 3) Group + thêm thành viên (lấy user pk: curl "$B/core/users/?username=<email>")
GPK=$(curl -s "${H[@]}" -X POST "$B/core/groups/" -d '{"name":"<tên>-access"}' | jq -r .pk)
for uid in <pk1> <pk2>; do curl -s "${H[@]}" -X POST "$B/core/groups/$GPK/add_user/" -d "{\"pk\":$uid}" -o /dev/null -w "%{http_code}\n"; done
# 4) Policy binding: chỉ group này được mở app
curl -s "${H[@]}" -X POST "$B/policies/bindings/" -d "$(jq -n --arg t "$APK" --arg g "$GPK" '{target:$t,group:$g,order:0,enabled:true,negate:false}')" | jq -c '{pk,enabled}'
# 5) Gắn provider vào embedded outpost (GỘP với providers cũ, đừng ghi đè)
CUR=$(curl -s "${H[@]}" "$B/outposts/instances/$OUTPOST/")
NEW=$(echo "$CUR" | jq -c --argjson p "$PPK" '(.providers//[])+[$p]|unique')
curl -s "${H[@]}" -X PATCH "$B/outposts/instances/$OUTPOST/" -d "{\"providers\":$NEW}" | jq -c '{providers}'
```

**KIỂM CHỨNG:** chờ ~8s (outpost reload config) → `curl` app vẫn 302; rồi xem log để chắc
ĐÚNG provider của app đang xử lý (không phải provider domain chung):
```bash
curl -s -o /dev/null https://<sub>.thientnse.site/
docker logs authentik-server --since 30s 2>&1 | grep "<sub>.thientnse" | tail -1 \
  | jq -r '"provider="+.name+" status="+(.status|tostring)'   # phải là provider="<tên>"
```
Deny user-không-thuộc-group chỉ kiểm chứng trọn vẹn được khi đăng nhập bằng trình duyệt
(báo user test); cấu trúc đúng là đủ điều kiện.

## Giai đoạn 4 — Phân quyền trong app (chỉ khi cần mức C)

App đọc header Traefik tiêm vào (fail-closed nếu thiếu `X-authentik-email`):
- `X-authentik-email` = khóa user ổn định (dùng làm khóa liên kết user, theo bất biến #8).
- `X-authentik-groups` = chuỗi ngăn bằng `|` → map sang quyền của app.

Trong **Next.js** (stack chuẩn hiện tại): đọc bằng `headers()` trong Server Component / route
handler / server action; tập trung logic ở `lib/auth.ts` (hàm `getUser()` đọc email + groups,
trả về `null` → fail-closed). Map group → quyền (vd `<tên>:write` ⇒ đọc+ghi, `:read` ⇒ chỉ đọc).
Nút đăng xuất: redirect tới `/outpost.goauthentik.io/sign_out` (đường dẫn trên CHÍNH domain app,
outpost xử lý). KHÔNG hardcode URL IdP cũ; cần thì đọc từ env `AUTHENTIK_URL=https://auth.thientnse.site`.
> Chưa có app nào đang đọc header để phân quyền (mẫu cũ `link-manager` đã gỡ; `todo` chỉ gác ở
> proxy theo group `todo-access`, không phân quyền in-app). App đầu tiên làm mức C → tạo `lib/auth.ts`
> theo mô tả trên và cập nhật làm mẫu sống mới ở đây.

Đổi code app → commit + push → CI build → trên NUC `docker compose pull && up -d` (đồng bộ
1 nhịp: image mới + env + middleware).

## Giai đoạn 5 — Báo cáo + cập nhật registry

1. Cập nhật `authentik/docs/auth-apps.md` (bảng app + chi tiết provider/group), commit & push
   repo `authentik`.
2. Báo user: app được bảo vệ mức nào, group nào được vào, cách cấp quyền thêm (add user vào
   group trong Authentik admin), và nhắc test đăng nhập trình duyệt 1 lần.

## Bẫy đã biết (đừng vấp lại)

- **Network dùng chung là `edge`** (đã xác minh; `infrastructure` trong compose dev-local là
  rác). Authentik server phải ở `edge` để Traefik gọi được + thấy middleware.
- **Embedded outpost redirect về `localhost`** nếu thiếu `authentik_host` + `authentik_host_browser`
  = `https://auth.thientnse.site` (đã set sẵn; nếu dựng lại Authentik phải set lại).
- **OAuth/redirect URL ra `http://`** do Cloudflare cắt TLS rồi Traefik ghi đè
  `X-Forwarded-Proto=http`. Đã fix bằng label trên router authentik:
  `traefik.http.middlewares.authentik-xfp.headers.customrequestheaders.X-Forwarded-Proto=https`
  + `routers.authentik.middlewares=authentik-xfp@docker`. Provider Google cần thêm redirect URI
  `https://auth.thientnse.site/source/oauth/callback/<slug>/` ở Google Cloud Console.
- **Outpost cần ~5–10s** nạp provider/config mới sau khi tạo qua API — chờ rồi mới kiểm chứng.
- **404 ngay sau `docker compose up -d`** = cửa sổ recreate, Traefik chưa đăng ký lại route;
  chờ healthy.
- **Authentik KHÔNG để Watchtower tự nâng** (no label) — update là thủ công, bump `AUTHENTIK_TAG`.
- Liên kết user theo **email** (`user_matching_mode=email_link` cho source) để không tạo trùng.
