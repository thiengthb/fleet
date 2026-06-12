# TÀI LIỆU 1 — KIẾN TRÚC & VẬN HÀNH NUC AUTO-DEPLOY PLATFORM

> Dựng ngày 2026-06-07. Domain: `thientnse.site`. Máy chủ: NUC `thienminiserver`
> (Ubuntu, Docker Engine 29.5.2, truy cập qua Tailscale `100.126.231.94`).
>
> Tài liệu này mô tả **toàn bộ luồng hoạt động** của hệ thống, từng thành phần,
> từng file cấu hình, và mọi thao tác vận hành bạn sẽ cần. Đọc xong tài liệu này
> bạn phải tự kiểm soát được hệ thống mà không cần hỏi ai.

---

## MỤC LỤC

1. [Bức tranh tổng thể](#1-bức-tranh-tổng-thể)
2. [Luồng deploy: từ `git push` đến web cập nhật](#2-luồng-deploy)
3. [Luồng request: từ trình duyệt đến container](#3-luồng-request)
4. [Giải phẫu từng thành phần](#4-giải-phẫu-từng-thành-phần)
5. [Cây thư mục & từng file cấu hình](#5-cây-thư-mục--từng-file-cấu-hình)
6. [Sổ tay vận hành (cookbook)](#6-sổ-tay-vận-hành)
7. [Bảng debug khi có sự cố](#7-bảng-debug)
8. [Bảo mật — những gì đã làm và những gì cần nhớ](#8-bảo-mật)

---

## 1. BỨC TRANH TỔNG THỂ

```
┌─────────────────────── MÁY DEV (Windows) ───────────────────────┐
│  D:\Projects\MiniServer\link-manager   (clone repo)             │
│                  │                                              │
│                  │ git push origin main                         │
└──────────────────┼──────────────────────────────────────────────┘
                   ▼
┌─────────────────────── GITHUB ──────────────────────────────────┐
│  repo: thiengthb/linkmanager                                    │
│  .github/workflows/deploy.yml                                   │
│       │  (GitHub Actions, runner CỦA GITHUB — không phải NUC)   │
│       │  build Docker image từ docker/Dockerfile                │
│       ▼                                                         │
│  ghcr.io/thiengthb/linkmanager:latest  +  :<git-sha-ngắn>       │
└──────────────────┬──────────────────────────────────────────────┘
                   │ (NUC chủ động PULL — GitHub không hề
                   │  có quyền truy cập vào NUC. An toàn.)
                   ▼
┌─────────────────────── NUC thienminiserver ─────────────────────┐
│                                                                 │
│  Docker network: edge  (bridge, dùng chung cho TẤT CẢ)          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  watchtower ──(poll ghcr.io mỗi 60s)──► thấy image mới    │ │
│  │      │            thì pull về + recreate container app    │ │
│  │      ▼                                                    │ │
│  │  link-manager (app)  ◄── traefik v3.7 ◄── cloudflared     │ │
│  │  /opt/apps/link-manager   /opt/infra      /opt/infra      │ │
│  │  volume: link-manager_data (SQLite — bất tử qua deploy)   │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│  netdata (network host — giám sát máy, độc lập hệ thống này)    │
└──────────────────▲──────────────────────────────────────────────┘
                   │ Cloudflare Tunnel (outbound QUIC,
                   │ KHÔNG mở port nào ra Internet)
┌──────────────────┴──────────────────────────────────────────────┐
│                       CLOUDFLARE                                │
│  DNS:    CNAME  *  →  f725123c-….cfargotunnel.com  (proxied)    │
│  Tunnel: public hostname  *.thientnse.site → http://traefik:80  │
│  TLS:    Cloudflare tự lo HTTPS (không cần Let's Encrypt)       │
└──────────────────▲──────────────────────────────────────────────┘
                   │ https://link.thientnse.site
              NGƯỜI DÙNG
```

### 4 nguyên tắc thiết kế (vi phạm là hỏng)

| # | Nguyên tắc | Lý do |
|---|---|---|
| 1 | **Một network `edge` duy nhất**, infra TẠO, app THAM CHIẾU (`external: true`) | Traefik chỉ forward được tới container cùng network. Khác network = 502. |
| 2 | **`exposedbydefault=false`** — Traefik chỉ public container có `traefik.enable=true` | Đây là công tắc public/private cho từng app. |
| 3 | **TLS do Cloudflare lo** | Tunnel đã mã hoá; trong mạng nội bộ traefik↔app đi HTTP thường. Không cấu hình Let's Encrypt. |
| 4 | **NUC chỉ PULL, không nhận lệnh từ ngoài** | Không GitHub runner trên NUC, không mở port. Bị lộ token GitHub cũng không ai vào được NUC. |

---

## 2. LUỒNG DEPLOY

### Chuyện gì xảy ra khi bạn `git push origin main` — từng bước một

**Bước 1 — GitHub Actions kích hoạt** (file `.github/workflows/deploy.yml`):
- Trigger: push vào `main` (hoặc bấm tay nút *Run workflow* — `workflow_dispatch`).
- Chạy trên `ubuntu-latest` — máy ảo CỦA GITHUB, dùng xong vứt. NUC không liên quan gì đến bước build.
- `concurrency: group: build-and-push` — 2 push liên tiếp không build chồng nhau, cái sau xếp hàng.

**Bước 2 — Build image:**
- `docker/login-action` đăng nhập ghcr.io bằng `GITHUB_TOKEN` — token này GitHub tự phát cho mỗi lần chạy workflow, không phải cấu hình gì. Quyền `packages: write` được khai báo ngay trong file workflow.
- `docker/metadata-action` sinh ra 2 tag:
  - `ghcr.io/thiengthb/linkmanager:latest` — luôn là bản mới nhất.
  - `ghcr.io/thiengthb/linkmanager:<sha>` (vd `25e663c`) — đóng băng vĩnh viễn theo commit. **Đây là phao cứu sinh để rollback.**
- `docker/build-push-action` build theo `docker/Dockerfile` (context = root repo để with được cả `backend/` lẫn `frontend/`), truyền build-arg `VITE_API_KEY` từ secret `API_KEY` của repo (nướng vào bundle frontend), rồi push cả 2 tag lên ghcr.io.
- `cache-from/to: type=gha` — layer cache lưu trên GitHub, build lần sau nhanh hơn nhiều.

**Bước 3 — Watchtower trên NUC phát hiện** (chậm nhất 60 giây sau):
- Watchtower poll ghcr.io mỗi `WATCHTOWER_POLL_INTERVAL=60` giây.
- Nó CHỈ ngó các container có label `com.centurylinklabs.watchtower.enable=true` (vì bật `WATCHTOWER_LABEL_ENABLE=true`). Container nào không gắn label — kể cả traefik, cloudflared — watchtower mặc kệ, không bao giờ tự ý update.
- So sánh digest của image local với digest trên registry (HEAD request, có xác thực bằng credential mount từ `~/.docker` của user `thien25`).

**Bước 4 — Tự thay máu:**
- Digest khác → watchtower pull image mới → stop container cũ → tạo container mới **với đúng nguyên cấu hình cũ** (network, volume, label, env giữ nguyên) → start.
- `WATCHTOWER_CLEANUP=true` → image cũ không còn ai dùng bị xoá luôn, đỡ đầy ổ.
- Volume `link-manager_data` (SQLite) là **named volume nằm ngoài container** → dữ liệu không suy chuyển.

**Bước 5 — Traefik tự thấy:**
- Traefik lắng nghe Docker events qua `/var/run/docker.sock`. Container mới lên (mang label `traefik.*`) → route tự đăng ký lại trong vài giây. Không cần restart traefik, không cần làm gì cả.

**Tổng thời gian: push → web cập nhật ≈ 2–4 phút.** Không SSH, không thao tác tay.

### Dữ liệu nào sống, dữ liệu nào chết qua mỗi lần deploy?

| Thứ | Số phận |
|---|---|
| Code, file tĩnh trong image | **Thay mới hoàn toàn** theo image |
| `/data/links.db` (SQLite) | **Sống** — nằm trong volume `link-manager_data` |
| Biến môi trường | **Sống** — đọc lại từ `/opt/apps/link-manager/.env` |
| Container ID, log container cũ | Mất (log cũ bị xoá theo container) |

---

## 3. LUỒNG REQUEST

### Chuyện gì xảy ra khi ai đó mở `https://link.thientnse.site`

```
Trình duyệt
  │ ① DNS: link.thientnse.site = CNAME * → f725123c-….cfargotunnel.com
  │    (proxied — trả về IP của Cloudflare, KHÔNG lộ IP nhà bạn)
  ▼
Cloudflare edge (TLS terminate tại đây — HTTPS do Cloudflare lo)
  │ ② Khớp public hostname wildcard *.thientnse.site
  │    → đẩy request xuống tunnel f725123c
  ▼
cloudflared (container trên NUC — kết nối outbound sẵn 4 đường QUIC)
  │ ③ Theo cấu hình ingress: service = http://traefik:80
  │    "traefik" phân giải được vì cloudflared và traefik CÙNG network edge
  │    (Docker DNS nội bộ phân giải tên container)
  ▼
traefik :80 (entrypoint "web")
  │ ④ So Host header với các router đã đăng ký từ label:
  │    Host(`link.thientnse.site`) → service link-manager, port 3001
  │    Không khớp router nào → trả 404 trang trắng của traefik
  ▼
link-manager :3001 (Express serve API + frontend tĩnh)
  │ ⑤ Trả response, đi ngược lại đúng đường cũ
  ▼
Trình duyệt nhận HTML/JSON, có HTTPS + CDN Cloudflare
```

**Điểm mấu chốt cần khắc cốt:**
- **Không có port nào của NUC mở ra Internet.** Tunnel là kết nối NUC chủ động gọi ra Cloudflare. Router nhà bạn không cần port-forward gì hết.
- Một request "đi xuyên" 3 lớp tên: DNS wildcard (Cloudflare) → hostname wildcard (tunnel) → Host rule (traefik). **Thêm app mới chỉ cần đụng lớp thứ 3** (label trong compose của app) — 2 lớp trên là wildcard, ăn sẵn.
- Traefik dashboard: KHÔNG ra Internet, chỉ bind `127.0.0.1:8080` trên NUC. Xem bằng SSH tunnel (xem mục 6.7).

---

## 4. GIẢI PHẪU TỪNG THÀNH PHẦN

### 4.1. Traefik v3.7 — bộ định tuyến (reverse proxy)

- **Nhiệm vụ:** nhận mọi request từ cloudflared, nhìn Host header, chuyển đến đúng container.
- **Cách nó biết route:** đọc Docker socket (`/var/run/docker.sock`, mount read-only). Mỗi container có label `traefik.*` là một "lời khai báo route". Container lên/xuống → route tự thêm/xoá. **Không có file cấu hình route nào cả** — toàn bộ route nằm trong label của từng app.
- **Vì sao phải v3.7+:** Docker Engine 29 yêu cầu client API ≥ 1.40, traefik ≤ v3.5 pin cứng API 1.24 → chết provider (xem Tài liệu 2). **KHÔNG hạ version traefik xuống dưới 3.7.**
- Flags quan trọng:
  - `--providers.docker.exposedbydefault=false` — mặc định KHÔNG public ai.
  - `--providers.docker.network=edge` — luôn nói chuyện với app qua network edge (kể cả khi app lỡ join nhiều network).
  - `--entrypoints.web.address=:80` — cổng nhận traffic từ cloudflared.

### 4.2. cloudflared — đường hầm ra Internet

- **Nhiệm vụ:** giữ 4 kết nối QUIC outbound thường trực tới Cloudflare. Request từ Internet đổ vào tunnel này thay vì vào IP nhà bạn.
- **Cấu hình nằm ở đâu:** phần "chạy" (token) nằm trong `/opt/infra/.env`; phần "định tuyến" (public hostname → service) nằm **trên Cloudflare dashboard** (tunnel `f725123c`, tab Public Hostname), được đẩy xuống cloudflared tự động — đổi trên web là ăn ngay, không cần restart.
- Cấu hình hiện tại: 1 dòng duy nhất `*.thientnse.site → http://traefik:80`.
- **Token = chìa khoá tunnel.** Ai có token là giả danh được tunnel của bạn. Token chỉ nằm trong `/opt/infra/.env` (chmod 600, có `.gitignore`).

### 4.3. Watchtower — người gác tự động cập nhật

- **Nhiệm vụ:** poll registry 60s/lần, thấy image mới → pull, recreate container.
- **Phạm vi:** CHỈ container có label `com.centurylinklabs.watchtower.enable=true`. Hiện tại: chỉ `link-manager`.
- **Credential:** mount **cả thư mục** `/home/thien25/.docker` (không phải file lẻ) + env `DOCKER_CONFIG=/config`. Lý do: `docker login` ghi file mới (inode mới) — nếu mount file lẻ, watchtower sẽ ôm file cũ vĩnh viễn và mất xác thực sau mỗi lần re-login (đã dính một lần, xem Tài liệu 2 mục 3.4).
- **`DOCKER_API_VERSION=1.44`** trong env — bắt buộc với Docker 29, thiếu là watchtower chết ngay khi start.
- Chạy thành **project compose riêng** (`name: watchtower`) dù file nằm chung `/opt/infra` — để lệnh `docker compose down` của stack infra không vạ lây và ngược lại.

### 4.4. link-manager — app mẫu (mọi app sau này theo đúng khuôn)

- Image: `ghcr.io/thiengthb/linkmanager:latest` — build sẵn trên GitHub, NUC chỉ pull.
- Nghe cổng **3001** (KHÔNG publish ra host — traefik gọi qua network edge).
- Healthcheck nằm sẵn trong Dockerfile (`wget /api/health`) — `docker ps` hiện `(healthy)`.
- Env đọc từ `/opt/apps/link-manager/.env`: `DB_PATH`, `API_KEY`, `CORS_ORIGIN`, `GEMINI_API_KEY`, `AI_MODEL`.
- 5 label = toàn bộ "thân phận" của app:
  ```yaml
  - "com.centurylinklabs.watchtower.enable=true"                          # cho phép auto-update
  - "traefik.enable=true"                                                 # cho phép public
  - "traefik.http.routers.link-manager.rule=Host(`link.thientnse.site`)"  # subdomain nào
  - "traefik.http.routers.link-manager.entrypoints=web"                   # vào cổng 80 traefik
  - "traefik.http.services.link-manager.loadbalancer.server.port=3001"    # app nghe cổng nào
  ```

### 4.5. netdata — ngoài hệ thống

Chạy network `host`, không liên quan gì đến edge/traefik/watchtower. Giám sát tài nguyên máy. Để nguyên.

---

## 5. CÂY THƯ MỤC & TỪNG FILE CẤU HÌNH

### Trên NUC

```
/opt/infra/                       ← TẦNG NỀN TẢNG (động vào phải cẩn thận)
├── docker-compose.yml            ← traefik + cloudflared + TẠO network edge
├── watchtower.yml                ← watchtower (project compose riêng tên "watchtower")
├── .env                          ← TUNNEL_TOKEN (chmod 600, TUYỆT ĐỐI không commit)
└── .gitignore                    ← chứa ".env"

/opt/apps/                        ← TẦNG ỨNG DỤNG (mỗi app một thư mục)
└── link-manager/
    ├── docker-compose.yml        ← image ghcr + labels + tham chiếu edge (external)
    ├── .env                      ← API_KEY, GEMINI_API_KEY… (chmod 600)
    └── .gitignore                ← chứa ".env"

/home/thien25/.docker/config.json ← credential ghcr.io (PAT write:packages)
/home/thien25/actions-runner/     ← runner CŨ, không còn dùng, có thể xoá
```

### Trong repo GitHub (mỗi project)

```
linkmanager/
├── .github/workflows/deploy.yml  ← build & push lên ghcr (chạy trên runner GitHub)
├── docker/Dockerfile             ← multi-stage: build frontend Vite → backend Node
├── docker/docker-compose.yml     ← chỉ dùng dev local, KHÔNG phải bản deploy
├── backend/  frontend/
```

> **Nguồn chân lý khi deploy là `/opt/apps/<tên>/docker-compose.yml` trên NUC**,
> không phải compose trong repo. Compose trong repo chỉ để dev máy local.

### Ai tạo network `edge`, ai tham chiếu?

- `/opt/infra/docker-compose.yml` **TẠO**:
  ```yaml
  networks:
    edge:
      name: edge
      driver: bridge
  ```
- Mọi file khác (watchtower.yml, app compose) **THAM CHIẾU**:
  ```yaml
  networks:
    edge:
      external: true
  ```
- Hệ quả vận hành: **`docker compose down` stack infra sẽ cố xoá network edge** và fail nếu app còn chạy. Trình tự đúng khi cần hạ toàn bộ: down các app trước → down infra sau. Khi dựng lại: up infra trước → up app sau.

---

## 6. SỔ TAY VẬN HÀNH

> SSH vào NUC: `ssh thien25@thienminiserver` (đã cài key từ máy Windows này).

### 6.1. Deploy bản code mới (việc hằng ngày)

```bash
git push origin main
# Hết. Chờ 2-4 phút. Không cần SSH.
```
Theo dõi nếu muốn:
- Tab **Actions** trên GitHub — xem build.
- `ssh thien25@thienminiserver "docker logs watchtower --since 5m"` — xem watchtower pull.

### 6.2. Thêm một project MỚI (public)

**Phía repo GitHub (1 lần):**
1. Viết `Dockerfile` (nhớ `EXPOSE <port>`).
2. Copy nguyên `.github/workflows/deploy.yml` từ repo linkmanager sang. Chỉ cần sửa nếu Dockerfile nằm chỗ khác (`file:`) hoặc cần build-arg khác.
3. Push → có image `ghcr.io/thiengthb/<repo>:latest`.

**Phía NUC (1 lần):**
```bash
mkdir -p /opt/apps/<tên>
# Copy docker-compose.yml từ /opt/apps/link-manager làm mẫu, sửa 5 chỗ:
#   name: <tên>             image: ghcr.io/thiengthb/<repo>:latest
#   container_name: <tên>   volume (nếu app có dữ liệu)
#   3 label traefik: tên router/service, Host(`<sub>.thientnse.site`), port
# Tạo .env + .gitignore
cd /opt/apps/<tên> && docker compose up -d
```
**KHÔNG cần đụng Cloudflare** — wildcard `*.thientnse.site` hứng hết mọi subdomain.

### 6.3. Thêm project chạy NỘI BỘ (không public)

Như 6.2 nhưng **xoá 4 dòng label `traefik.*`** (giữ label watchtower nếu vẫn muốn auto-update). Container vẫn nằm trong network edge, các app khác gọi được bằng tên container (`http://<tên>:<port>`), nhưng Internet không thấy nó — vì traefik `exposedbydefault=false` và không có route.

### 6.4. ROLLBACK khi bản mới có bug

```bash
ssh thien25@thienminiserver
cd /opt/apps/link-manager
nano docker-compose.yml      # đổi:  image: ghcr.io/thiengthb/linkmanager:latest
                             # thành: image: ghcr.io/thiengthb/linkmanager:<sha-tốt>
docker compose up -d         # ăn ngay trong vài giây
```
- Tìm `<sha-tốt>`: GitHub → repo → Packages → linkmanager → danh sách tag; hoặc `git log --oneline`.
- ⚠️ Khi đang ghim SHA, watchtower vẫn poll nhưng tag SHA không bao giờ đổi → **auto-update tạm đóng băng**. Sửa xong bug, đổi lại `:latest` + `docker compose up -d` để nối lại auto-update.

### 6.5. Tắt / bật public cho app đang chạy

```bash
cd /opt/apps/<tên>
# Sửa docker-compose.yml: thêm/xoá 4 dòng traefik.*
docker compose up -d    # traefik tự cập nhật route trong vài giây
```

### 6.6. Xem log

```bash
docker logs link-manager --tail 50 -f     # app
docker logs traefik --tail 50             # định tuyến + access log
docker logs cloudflared --tail 50         # tunnel
docker logs watchtower --since 10m        # auto-update gần đây
```

### 6.7. Mở Traefik dashboard (an toàn, qua SSH tunnel)

```powershell
ssh -L 8080:localhost:8080 thien25@thienminiserver
# giữ phiên SSH, mở trình duyệt: http://localhost:8080/dashboard/
# (set Host header không cần — router dashboard nhận Host(`traefik.localhost`),
#  nếu 404 thì thêm "127.0.0.1 traefik.localhost" vào hosts và mở http://traefik.localhost:8080)
```
Dashboard cho thấy: router nào đang sống, trỏ service nào, port nào — **chỗ đầu tiên cần nhìn khi route không ăn**.

### 6.8. Khởi động lại từng tầng

```bash
# Chỉ app:
cd /opt/apps/link-manager && docker compose restart
# Cả tầng infra (app sẽ mất mạng vài giây nhưng không chết):
cd /opt/infra && docker compose restart
# Watchtower:
cd /opt/infra && docker compose -f watchtower.yml restart
```

### 6.9. Sau khi NUC reboot

Không phải làm gì. Mọi container đều `restart: unless-stopped` — Docker tự kéo dậy theo đúng thứ tự phụ thuộc. Kiểm tra cho yên tâm: `docker ps` (đủ 5: traefik, cloudflared, watchtower, link-manager, netdata).

### 6.10. Đổi/thêm secret cho app

```bash
nano /opt/apps/link-manager/.env     # sửa giá trị
cd /opt/apps/link-manager && docker compose up -d   # recreate để ăn env mới
```
⚠️ Riêng `API_KEY` của link-manager: giá trị này còn được **nướng vào frontend lúc build** (build-arg `VITE_API_KEY` từ secret `API_KEY` trên GitHub). Muốn bật xác thực phải đặt **cả hai nơi** trùng nhau: GitHub repo → Settings → Secrets → `API_KEY`, và `.env` trên NUC → rồi chạy lại workflow để build bản frontend mới.

### 6.11. Khi re-login ghcr trên NUC (PAT hết hạn)

```bash
echo '<PAT-mới>' | docker login ghcr.io -u thiengthb --password-stdin
# Watchtower mount cả thư mục ~/.docker nên TỰ ăn credential mới, không cần restart.
```

### 6.12. Lấy lại quyền build tự động (việc còn nợ)

Account GitHub đang **khoá billing** → Actions chưa chạy được (image đầu tiên là build tay trên NUC). Sau khi gỡ khoá tại `github.com/settings/billing`: vào repo → Actions → chọn run fail → **Re-run all jobs** (hoặc push commit bất kỳ). Build xanh + watchtower pull về là chu trình tự động khép kín từ đó về sau.

---

## 7. BẢNG DEBUG

> Quy tắc vàng: lần theo luồng request mục 3 — DNS → tunnel → traefik → app — và xác định request CHẾT Ở LỚP NÀO bằng các dấu hiệu dưới.

| Triệu chứng | Nghĩa là chết ở lớp | Kiểm tra | Cách sửa thường gặp |
|---|---|---|---|
| Lỗi 1033/530 từ Cloudflare | Tunnel | `docker logs cloudflared` có "Registered tunnel connection"? DNS record có trỏ đúng `f725123c-….cfargotunnel.com`? | Restart cloudflared; sửa DNS record trỏ đúng tunnel ID |
| 404 trang trắng (response từ traefik) | Traefik không có route | Dashboard (mục 6.7) có router của app không? Label `traefik.enable=true` có chưa? `Host()` đúng chính tả? | Sửa label, `docker compose up -d` lại app |
| 502 Bad Gateway | Traefik thấy route nhưng không gọi được app | `docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'` — app có trong danh sách? Port trong label = port app nghe? | App thiếu `networks: [edge]`; hoặc `loadbalancer.server.port` sai |
| App chạy local OK mà không cập nhật bản mới | Watchtower | `docker logs watchtower --since 5m` — có "403"/"auth not present"? `Scanned=0`? | 403: re-login ghcr (mục 6.11). Scanned=0: app thiếu label watchtower.enable |
| Build GitHub fail toàn bộ, 0 step chạy | GitHub Actions | Annotation của job (tab Actions) | "billing issue" → gỡ khoá billing; "permissions" → Settings → Actions → Workflow permissions |
| Traefik log: "client version X is too old" | Traefik vs Docker API | `docker logs traefik` | Image traefik < v3.7 — nâng lên (xem Tài liệu 2) |
| Mọi thứ chết sau khi nghịch compose | Network edge bị xoá/tạo lại | `docker network ls` | Up theo trình tự: infra trước, app sau (mục 5) |

**Lệnh chẩn đoán nhanh toàn hệ thống (chạy đầu tiên khi có sự cố):**
```bash
ssh thien25@thienminiserver '
docker ps --format "table {{.Names}}\t{{.Status}}";
echo "--- edge:"; docker network inspect edge --format "{{range .Containers}}{{.Name}} {{end}}";
echo "--- routers:"; curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers | grep -o "\"rule\":\"[^\"]*\"";
echo "--- tunnel:"; docker logs cloudflared --tail 3 2>&1'
```

---

## 8. BẢO MẬT

**Đã làm:**
- NUC không mở port nào ra Internet (tunnel outbound-only). Router không port-forward.
- Traefik dashboard chỉ bind `127.0.0.1` — muốn xem phải SSH.
- `exposedbydefault=false` — container mới mặc định KHÔNG public.
- Secrets (`TUNNEL_TOKEN`, `API_KEY`…) chỉ nằm trong `.env` chmod 600 + `.gitignore`; không có trong compose, không trên GitHub.
- GitHub không có credential gì của NUC (pull-based). Watchtower chỉ có PAT scope packages.
- Docker socket mount cho traefik là **read-only**.

**Cần nhớ:**
- ⚠️ API của link-manager đang **mở** (API_KEY trống — log app tự cảnh báo). Muốn khoá: mục 6.10.
- ⚠️ Token tunnel trong `/opt/infra/.env` — lộ là người khác giả danh tunnel. Nếu nghi lộ: Cloudflare One → tunnel → rotate token, dán lại vào `.env`, `docker compose up -d`.
- PAT ghcr trên NUC nên chỉ giữ scope `read:packages` về lâu dài (scope `write` hiện tại chỉ cần cho lần build tay; có thể thay bằng PAT read-only khi CI đã chạy).
- Image ghcr đang gắn với repo public. Nếu chuyển repo private, package private theo — watchtower vẫn pull được nhờ PAT.
