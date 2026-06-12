# TÀI LIỆU 3 — DỰNG LẠI TOÀN BỘ TỪ CON SỐ KHÔNG (SETUP FROM SCRATCH)

> Dùng khi: NUC bị cài lại OS, đổi máy mới, hoặc muốn dựng một server thứ hai
> y hệt. Làm **tuần tự từ trên xuống**, mỗi bước đều có lệnh **KIỂM CHỨNG** —
> chưa pass kiểm chứng thì KHÔNG sang bước sau.
>
> Thời gian dự kiến: 45–90 phút (chưa tính cài OS).
> Tham chiếu: kiến trúc & vận hành ở `01-KIEN-TRUC-VA-VAN-HANH.md`,
> các bẫy đã biết ở `02-MO-XE-LOI-HE-THONG-CU.md`.

---

## MỤC LỤC

- [Bước 0 — Checklist những thứ phải có trong tay TRƯỚC khi bắt đầu](#bước-0)
- [Bước 1 — Hệ điều hành & user](#bước-1)
- [Bước 2 — Cài Docker Engine](#bước-2)
- [Bước 3 — Tailscale & SSH từ máy dev](#bước-3)
- [Bước 4 — Khôi phục dữ liệu app (nếu có backup)](#bước-4)
- [Bước 5 — Cloudflare Tunnel (tạo mới hoặc dùng lại)](#bước-5)
- [Bước 6 — Tầng nền tảng /opt/infra (traefik + cloudflared)](#bước-6)
- [Bước 7 — Cấu hình Cloudflare: wildcard hostname + DNS](#bước-7)
- [Bước 8 — Login ghcr.io + Watchtower](#bước-8)
- [Bước 9 — Deploy app (link-manager và mọi app khác)](#bước-9)
- [Bước 10 — Nghiệm thu toàn hệ thống](#bước-10)
- [Phụ lục A — Backup & Restore dữ liệu](#phụ-lục-a)
- [Phụ lục B — Phía GitHub cho repo MỚI tinh](#phụ-lục-b)
- [Phụ lục C — Những bẫy đã biết (đọc trước khi cãi nhau với hệ thống)](#phụ-lục-c)

---

<a id="bước-0"></a>
## BƯỚC 0 — CHECKLIST PHẢI CÓ TRONG TAY TRƯỚC KHI BẮT ĐẦU

| # | Thứ cần | Lấy ở đâu | Ghi chú |
|---|---|---|---|
| 1 | USB cài Ubuntu Server LTS | ubuntu.com | Bản Server, không cần GUI |
| 2 | Tài khoản Cloudflare quản lý domain `thientnse.site` | dash.cloudflare.com | Nameserver đã trỏ Cloudflare |
| 3 | Tài khoản GitHub `thiengthb` | github.com | Billing KHÔNG bị khoá (kiểm tra settings/billing) |
| 4 | GitHub PAT scope `read:packages` | github.com/settings/tokens → classic | Cho NUC pull image. Tạo sẵn, ghi ra giấy/password manager |
| 5 | Backup volume dữ liệu (nếu cứu được từ máy cũ) | Phụ lục A | Không có thì app khởi đầu DB trống |
| 6 | Máy dev (Windows) có SSH key | `%USERPROFILE%\.ssh\id_ed25519` | Nếu mất key thì tạo mới: `ssh-keygen -t ed25519` |

**Quy ước cố định toàn tài liệu** (đổi nếu môi trường bạn khác):
- Hostname NUC: `thienminiserver` — user vận hành: `thien25`
- Domain: `thientnse.site` — registry: `ghcr.io/thiengthb/<repo>`
- Nền tảng tại `/opt/infra`, app tại `/opt/apps/<tên>`
- Network Docker dùng chung: `edge`

---

<a id="bước-1"></a>
## BƯỚC 1 — HỆ ĐIỀU HÀNH & USER

1. Cài Ubuntu Server LTS, đặt hostname `thienminiserver`, tạo user `thien25`
   (tick "Install OpenSSH server" trong installer).
2. Đăng nhập, cập nhật hệ thống:
   ```bash
   sudo apt update && sudo apt -y full-upgrade
   sudo apt -y install curl git ca-certificates
   ```

**✅ KIỂM CHỨNG:** `hostname` ra `thienminiserver`; `id` thấy user thuộc nhóm `sudo`.

---

<a id="bước-2"></a>
## BƯỚC 2 — CÀI DOCKER ENGINE

Cài bản chính chủ (KHÔNG dùng snap/docker.io của Ubuntu — hay lệch version):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker thien25     # cho user dùng docker không cần sudo
# Đăng xuất / đăng nhập lại (hoặc: newgrp docker) để nhóm có hiệu lực
```

**✅ KIỂM CHỨNG:**
```bash
docker --version && docker compose version   # cả hai chạy không sudo
docker run --rm hello-world                  # pull + run OK = mạng & daemon OK
```

> ⚠️ **Ghi nhớ từ vụ án cũ** (Tài liệu 2): Docker Engine ≥ 29 yêu cầu client
> API ≥ 1.40. Mọi version image trong tài liệu này đã chọn để tương thích —
> **đừng tự hạ version traefik xuống dưới v3.7**, đừng xoá
> `DOCKER_API_VERSION` của watchtower.

---

<a id="bước-3"></a>
## BƯỚC 3 — TAILSCALE & SSH TỪ MÁY DEV

### 3.1. Tailscale (để SSH từ xa không mở port)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up        # mở URL hiện ra, đăng nhập tài khoản Tailscale
tailscale ip -4          # ghi lại IP 100.x.y.z
```

### 3.2. Cài SSH key của máy dev lên NUC
Trên **máy Windows dev** (PowerShell):
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh thien25@thienminiserver "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```
(Nhập password lần cuối — từ đó về sau dùng key.)

**✅ KIỂM CHỨNG:** từ máy dev: `ssh thien25@thienminiserver "echo OK; groups"`
→ in `OK` không hỏi password, `groups` có `docker`.

---

<a id="bước-4"></a>
## BƯỚC 4 — KHÔI PHỤC DỮ LIỆU APP (nếu có backup)

> Làm TRƯỚC khi deploy app để app mở mắt là thấy dữ liệu. Không có backup → bỏ
> qua, volume sẽ được tạo trống. Cách tạo backup: Phụ lục A.

```bash
# Tạo volume đúng tên mà compose của app sẽ tham chiếu:
docker volume create link-manager_data
# Đổ backup vào (file backup dạng tar tạo theo Phụ lục A):
docker run --rm -v link-manager_data:/data -v $HOME:/backup alpine \
  sh -c "tar xzf /backup/link-manager_data.tar.gz -C /data"
```

**✅ KIỂM CHỨNG:**
```bash
docker run --rm -v link-manager_data:/data alpine ls -la /data   # thấy links.db
```

---

<a id="bước-5"></a>
## BƯỚC 5 — CLOUDFLARE TUNNEL

### Trường hợp A — tunnel cũ còn (chỉ reset NUC, không đụng Cloudflare)
Không phải tạo gì. Lấy lại token: **Cloudflare One → Networks → Tunnels →
chọn tunnel → Configure** → copy token (chuỗi `eyJ...`). Sang Bước 6.

### Trường hợp B — tạo tunnel mới tinh
1. **Cloudflare One → Networks → Tunnels → Create a tunnel** → chọn
   `Cloudflared` → đặt tên (vd `nuc-platform`).
2. Trang cài đặt hiện lệnh cài — **KHÔNG chạy lệnh đó** (mình chạy cloudflared
   bằng Docker ở Bước 6). Chỉ **copy token** `eyJ...`.
3. **Ghi lại Tunnel ID** (dạng UUID `xxxxxxxx-xxxx-...`, hiện ở danh sách
   tunnel) — Bước 7 cần nó để tạo DNS.

> Token và Tunnel ID là 2 thứ khác nhau: token để cloudflared chạy,
> Tunnel ID để DNS trỏ vào.

---

<a id="bước-6"></a>
## BƯỚC 6 — TẦNG NỀN TẢNG `/opt/infra`

### 6.1. Tạo thư mục
```bash
sudo mkdir -p /opt/infra /opt/apps
sudo chown -R thien25:thien25 /opt/infra /opt/apps
```

### 6.2. Tạo `/opt/infra/docker-compose.yml` — NỘI DUNG CHÍNH XÁC:

```yaml
services:
  traefik:
    image: traefik:v3.7        # >= v3.7 BẮT BUỘC với Docker 29 (xem Tài liệu 2)
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=edge"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.traefik.address=:8080"
      - "--log.level=INFO"
      - "--accesslog=true"
    ports:
      - "127.0.0.1:8080:8080"   # dashboard CHỈ bind localhost
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.localhost`)"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.entrypoints=traefik"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - edge

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - edge
    depends_on:
      - traefik

networks:
  edge:
    name: edge
    driver: bridge        # tầng infra TẠO network; mọi app THAM CHIẾU external
```

### 6.3. Tạo `/opt/infra/.env` (dán token từ Bước 5):
```bash
cat > /opt/infra/.env << 'EOF'
TUNNEL_TOKEN=eyJ...DÁN_TOKEN_THẬT_VÀO_ĐÂY...
EOF
chmod 600 /opt/infra/.env
echo ".env" > /opt/infra/.gitignore
```

### 6.4. Khởi chạy
```bash
cd /opt/infra
docker compose up -d
```

**✅ KIỂM CHỨNG (cả 3 phải pass):**
```bash
docker compose ps           # 2 container Up
docker logs cloudflared 2>&1 | grep -c "Registered tunnel connection"   # >= 1 (thường 4)
docker logs traefik --tail 20    # KHÔNG được có dòng ERR nào
#   → nếu thấy "client version ... is too old": image traefik < v3.7, sửa lại image!
```

---

<a id="bước-7"></a>
## BƯỚC 7 — CẤU HÌNH CLOUDFLARE: WILDCARD HOSTNAME + DNS

> Làm trên web dashboard. Mục tiêu: cấu hình MỘT LẦN, về sau thêm app
> không bao giờ phải quay lại đây.

### 7.1. Public Hostname (định tuyến trong tunnel)
**Cloudflare One → Networks → Tunnels → tunnel của bạn → Public Hostname →
Add a public hostname:**
- Subdomain: `*` — Domain: `thientnse.site`
- Service: Type `HTTP` — URL `traefik:80`
  (cloudflared gọi traefik bằng TÊN CONTAINER vì cùng network `edge`)

Nếu còn entry cũ trỏ thẳng app nào đó → **xoá hết**, chỉ giữ wildcard.

### 7.2. DNS record (Cloudflare KHÔNG tự tạo cho wildcard)
**Dashboard Cloudflare → thientnse.site → DNS → Records:**
- **Xoá** mọi CNAME cũ dạng `<sub> → <uuid-cũ>.cfargotunnel.com` (trỏ tunnel
  đã chết — chính là thủ phạm lỗi 530 ngày xưa, xem Tài liệu 2 mục 3).
- **Thêm:** Type `CNAME` — Name `*` —
  Target `<TUNNEL-ID>.cfargotunnel.com` — Proxy: **BẬT** (mây cam).
  (`<TUNNEL-ID>` lấy từ Bước 5; tunnel hiện tại 2026-06: `f725123c-a055-4119-92ec-32db3c1df4ea`)

**✅ KIỂM CHỨNG (từ máy bất kỳ):**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://abc-xyz-123.thientnse.site
```
- **404** = ĐẠT — chuỗi DNS → tunnel → traefik đã thông (traefik trả 404 vì
  chưa app nào nhận host đó). 
- **530** = DNS trỏ sai tunnel-id → soát lại 7.2.
- **timeout/lỗi SSL** = DNS chưa lan truyền, chờ 1–2 phút thử lại.

---

<a id="bước-8"></a>
## BƯỚC 8 — LOGIN GHCR.IO + WATCHTOWER

### 8.1. Login ghcr trên NUC (PAT `read:packages` từ Bước 0)
```bash
echo '<GITHUB_PAT>' | docker login ghcr.io -u thiengthb --password-stdin
# Phải thấy: Login Succeeded
```

### 8.2. Tạo `/opt/infra/watchtower.yml` — NỘI DUNG CHÍNH XÁC:

```yaml
name: watchtower        # project riêng — KHÔNG được bỏ dòng này
                        # (chung thư mục với compose infra, thiếu name sẽ
                        #  dính chung project -> --remove-orphans xoá nhầm traefik)

services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # Mount CẢ THƯ MỤC, không mount file lẻ:
      # docker login ghi file mới (inode mới) -> mount file lẻ sẽ ôm credential chết
      - /home/thien25/.docker:/config:ro
    environment:
      - DOCKER_CONFIG=/config
      - DOCKER_API_VERSION=1.44      # BẮT BUỘC với Docker 29 — không được xoá
      - WATCHTOWER_POLL_INTERVAL=60  # giây
      - WATCHTOWER_CLEANUP=true      # xoá image cũ sau khi update
      - WATCHTOWER_LABEL_ENABLE=true # CHỈ theo dõi container có label bật
    networks:
      - edge

networks:
  edge:
    external: true
```

### 8.3. Khởi chạy
```bash
cd /opt/infra
docker compose -f watchtower.yml up -d
```

**✅ KIỂM CHỨNG (chờ ~70 giây cho chu kỳ quét đầu):**
```bash
docker logs watchtower 2>&1 | tail -3
# Phải thấy:  Session done Failed=0 Scanned=0 Updated=0
#   Scanned=0 là ĐÚNG lúc này (chưa app nào gắn label).
# Nếu thấy "client version 1.25 is too old": thiếu DOCKER_API_VERSION -> soát 8.2
```

---

<a id="bước-9"></a>
## BƯỚC 9 — DEPLOY APP

> Mẫu dưới là link-manager. **Mọi app khác làm y hệt**, đổi 5 chỗ: tên,
> image, volume, subdomain, port.

### 9.1. Tạo `/opt/apps/link-manager/docker-compose.yml`:

```yaml
name: link-manager

services:
  app:
    image: ghcr.io/thiengthb/linkmanager:latest
    container_name: link-manager
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - edge
    volumes:
      - link_data:/data          # dữ liệu SQLite sống ngoài container
    labels:
      # --- bật auto-update ---
      - "com.centurylinklabs.watchtower.enable=true"
      # --- PUBLIC: xoá 4 dòng dưới nếu muốn app CHỈ chạy nội bộ ---
      - "traefik.enable=true"
      - "traefik.http.routers.link-manager.rule=Host(`link.thientnse.site`)"
      - "traefik.http.routers.link-manager.entrypoints=web"
      - "traefik.http.services.link-manager.loadbalancer.server.port=3001"

networks:
  edge:
    external: true

volumes:
  link_data:
    name: link-manager_data
    external: true        # nếu Bước 4 đã tạo volume (restore). Volume CHƯA
                          # tồn tại? -> đổi thành "external: false" hoặc chạy:
                          # docker volume create link-manager_data
```

### 9.2. Tạo `/opt/apps/link-manager/.env`:
```bash
cat > /opt/apps/link-manager/.env << 'EOF'
DB_PATH=/data/links.db
CORS_ORIGIN=*
# Bật xác thực API: đặt CÙNG giá trị với secret API_KEY trên GitHub
# (để VITE_API_KEY nướng trong frontend khớp). Trống = API mở.
API_KEY=
# AI tìm link (Google Gemini) — trống thì tính năng tự tắt
GEMINI_API_KEY=
AI_MODEL=
EOF
chmod 600 /opt/apps/link-manager/.env
echo ".env" > /opt/apps/link-manager/.gitignore
```

### 9.3. Khởi chạy
```bash
cd /opt/apps/link-manager
docker compose up -d
```

**✅ KIỂM CHỨNG:**
```bash
docker compose ps                          # Up (healthy) sau ~15 giây
docker compose logs --tail 10              # app báo chạy tại :3001
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'
#   -> phải có đủ: cloudflared traefik watchtower link-manager
curl -s https://link.thientnse.site/api/health    # {"ok":true}
```

---

<a id="bước-10"></a>
## BƯỚC 10 — NGHIỆM THU TOÀN HỆ THỐNG

Chạy lần lượt, TẤT CẢ phải pass:

```bash
# ① 4 container hệ thống + app đều Up:
docker ps --format "table {{.Names}}\t{{.Status}}"

# ② Traefik có route của app (ngoài dashboard):
curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers \
  | grep -o '"rule":"[^"]*"'
#   -> thấy Host(`link.thientnse.site`)

# ③ Web public sống:
curl -s -o /dev/null -w "%{http_code}\n" https://link.thientnse.site    # 200

# ④ Subdomain vu vơ ra 404 (chuỗi wildcard thông):
curl -s -o /dev/null -w "%{http_code}\n" https://khong-ton-tai.thientnse.site  # 404

# ⑤ Watchtower nhìn thấy app và xác thực ghcr OK:
docker logs watchtower --since 2m 2>&1 | tail -2
#   -> Session done Failed=0 Scanned=1   (không có dòng 403/auth)

# ⑥ Test chu trình auto-deploy trọn vẹn (từ máy dev):
#    sửa 1 dòng bất kỳ -> git push origin main -> chờ 2-4 phút:
docker logs watchtower -f     # thấy "Found new image ... Stopping ... Started"
```

Pass cả ⑥ = hệ thống tự động khép kín hoàn chỉnh. **DỪNG. XONG.**

---

<a id="phụ-lục-a"></a>
## PHỤ LỤC A — BACKUP & RESTORE DỮ LIỆU

### Backup volume (làm định kỳ, hoặc NGAY TRƯỚC khi reset server)
```bash
# Mỗi volume một file tar (ví dụ link-manager_data):
docker run --rm -v link-manager_data:/data -v $HOME:/backup alpine \
  sh -c "tar czf /backup/link-manager_data.tar.gz -C /data ."
# Kéo file về máy dev cất giữ (chạy từ máy dev):
scp thien25@thienminiserver:~/link-manager_data.tar.gz D:\Backups\
```
Thứ cần backup ngoài volume: `/opt/infra/.env` (token tunnel),
`/opt/apps/*/.env` (secrets app). Chỉ vậy — mọi thứ còn lại dựng lại được
từ tài liệu này + image trên ghcr.

### Restore: xem Bước 4.

### Liệt kê mọi volume đang có dữ liệu
```bash
docker volume ls
docker run --rm -v <tên-volume>:/v alpine du -sh /v
```

---

<a id="phụ-lục-b"></a>
## PHỤ LỤC B — PHÍA GITHUB CHO REPO MỚI TINH

(Repo `linkmanager` đã có sẵn workflow — phần này cho app/repo MỚI.)

1. Repo cần một `Dockerfile` (nhớ `EXPOSE <port>`).
2. Tạo `.github/workflows/deploy.yml` — copy nguyên văn từ repo `linkmanager`
   (`.github/workflows/deploy.yml`), thường KHÔNG phải sửa gì; chỉ sửa nếu:
   - Dockerfile không nằm ở `docker/Dockerfile` → sửa `file:`
   - không cần build-arg → xoá khối `build-args:`
3. Push lên `main` → tab Actions phải xanh → tab Packages của profile có
   package `ghcr.io/thiengthb/<repo>`.
4. Nếu build fail **0 step chạy**: xem annotation — từng dính
   *"account is locked due to a billing issue"* → gỡ tại github.com/settings/billing.
5. Nếu fail ở bước push image: repo Settings → Actions → General →
   Workflow permissions → **Read and write permissions**.

---

<a id="phụ-lục-c"></a>
## PHỤ LỤC C — NHỮNG BẪY ĐÃ BIẾT (đúc kết bằng máu, xem chi tiết Tài liệu 2)

| # | Bẫy | Hậu quả nếu quên | Phòng |
|---|---|---|---|
| 1 | Traefik < v3.7 trên Docker ≥ 29 | Provider chết im lặng, mọi route 404, container vẫn "Up" | Ghim `traefik:v3.7`+; sau nâng cấp Docker phải đọc log traefik |
| 2 | Watchtower thiếu `DOCKER_API_VERSION=1.44` | Chết ngay khi start ("client version 1.25 is too old") | Giữ nguyên env trong watchtower.yml |
| 3 | Mount file `config.json` lẻ vào watchtower | Re-login ghcr xong watchtower mù credential (403) | Mount cả thư mục `~/.docker` + `DOCKER_CONFIG=/config` |
| 4 | `watchtower.yml` thiếu `name:` riêng | `--remove-orphans` xoá nhầm traefik/cloudflared | Giữ dòng `name: watchtower` |
| 5 | DNS record trỏ tunnel-id cũ | 530 toàn tập dù tunnel sống | Chỉ dùng MỘT wildcard record; tạo tunnel mới phải sửa record `*` |
| 6 | Di chuyển thư mục chứa compose đang chạy | Stack mồ côi, sửa config không ăn | Vị trí bất biến: `/opt/infra`, `/opt/apps/<tên>`; muốn dời: down → dời → up |
| 7 | App quên `networks: [edge]` hoặc sai `loadbalancer.server.port` | 502 | Checklist 5 label + network khi thêm app (Bước 9) |
| 8 | Secrets trong compose / quên `.gitignore` | Lộ token khi chia sẻ file | Secrets CHỈ ở `.env` chmod 600 + `.gitignore` |
| 9 | Down stack infra khi app còn chạy | Lỗi xoá network edge đang bận | Trình tự: down app trước, infra sau; up thì ngược lại |
| 10 | Quên backup `.env` trước khi reset | Mất token tunnel + secrets, phải tạo lại từ đầu | Phụ lục A: backup volume + 2 nhóm file `.env` |
