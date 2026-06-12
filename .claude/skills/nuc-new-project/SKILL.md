---
name: nuc-new-project
description: Đưa một project mới (hoặc project có sẵn trong MiniServer) lên NUC platform theo đúng quỹ đạo chuẩn - GitHub Actions build ghcr.io, Watchtower auto-pull, Traefik route, Cloudflare wildcard. Dùng khi user muốn tạo project mới, deploy project lên NUC/miniserver, thêm subdomain, hoặc "đưa app này lên server".
---

# Skill: Đưa project lên NUC platform

Bạn sẽ đưa một project vào quỹ đạo deploy chuẩn của MiniServer. Làm TUẦN TỰ
6 giai đoạn dưới, mỗi giai đoạn có mục KIỂM CHỨNG — chưa pass thì không đi tiếp.
Các bất biến trong `D:\Projects\MiniServer\CLAUDE.md` là luật; nếu yêu cầu của
user mâu thuẫn với bất biến, chỉ ra mâu thuẫn và hỏi lại trước khi làm.

SSH NUC: `ssh thien25@thienminiserver` (key đã cài). App đặt tại `/opt/apps/<tên>`.

## Giai đoạn 0 — Thu thập thông tin (hỏi user nếu chưa rõ)

Bắt buộc biết đủ 6 thứ trước khi tạo file:

1. **Tên project** (kebab-case, vd `todo-app`) — dùng làm tên thư mục
   `/opt/apps/<tên>`, container_name, tên router/service traefik.
2. **Repo GitHub** — `thiengthb/<repo>`. Chưa có repo → tạo (hỏi public/private).
3. **Framework & cổng nội bộ** app lắng nghe (Next.js=3000, Express thường
   3000/3001, Vite static→nginx=80…). Đọc code để tự xác định trước, chỉ hỏi
   khi không chắc.
4. **Public hay nội bộ?** Public → subdomain nào (`<sub>.thientnse.site`)?
   Kiểm tra subdomain chưa bị app khác dùng: grep `Host(` trong các
   `/opt/apps/*/docker-compose.yml` trên NUC.
5. **Có dữ liệu cần persist không?** (DB file, uploads…) → named volume
   `<tên>_data` mount vào đâu trong container.
6. **Biến môi trường runtime** nào cần (DB_URL, API key…)? Biến nào cần
   **lúc build** (kiểu `VITE_*`, `NEXT_PUBLIC_*`)? → biến build phải đi qua
   GitHub secret + build-arg, KHÔNG để được trong .env trên NUC.

## Giai đoạn 0.5 — Chọn archetype (giảm boilerplate)

Từ mục đích + framework ở Giai đoạn 0, gắn project vào **một `kind`** (xem
`nuc-platform/INVENTORY.md` §0). Mỗi `kind` có **implementation tham chiếu đang
sống** — COPY từ nó thay vì viết lại; chỉ sửa chỗ khác biệt. (Không nhân bản
template tĩnh trong skill → tránh drift; nguồn sự thật là app tham chiếu.)

| archetype | Tham chiếu (copy từ) | Lấy gì | Đặc thù |
|-----------|----------------------|--------|---------|
| `web-app` (Next) | `todo/` | `Dockerfile` (standalone multi-stage), `.github/workflows/deploy.yml`, `components.json` + khai báo registry `@thiengthb` (ui-kit), `.dockerignore`, `next.config` (`output:'standalone'`) | Public: 4 label Traefik. Theo `/coding-convention` + `/react-ui-craft`. Bảo vệ = Authentik forward-auth (`/nuc-protect-app`). |
| `python-worker` | `nuc-monitor/` | `Dockerfile` (python slim), `deploy.yml`, `requirements.txt` mẫu | Headless: **KHÔNG** Traefik/port. Nối `edge` chỉ nếu cần egress. |
| `node-bot` | `jobhunter-bot/` | `Dockerfile` (node), `deploy.yml`, `package.json` (ESM, Node ≥22) | Headless worker Discord: KHÔNG Traefik. Secrets trong `.env` NUC. |
| `monorepo` (→N image) | `yakudoku/` | CI **matrix** build N image từ 1 repo, layout `web/ core/ bot/`, compose nhiều service | 1 image là **writer DB duy nhất** nếu dùng SQLite; image nội bộ KHÔNG gắn label Traefik. |
| `infra` (bên thứ 3) | `n8n/` hoặc `authentik/` | `docker-compose.yml` + `.env` | Image ghim version, **KHÔNG** label Watchtower; update = bump tag thủ công. Không CI build. |

**Bắt buộc cho mọi archetype có CODE** (`web-app`/`worker`/`monorepo`): cài convention repo ngay
(Giai đoạn 3 mục 0 — Prettier + commit-msg hook). Sau khi tạo project, **cập nhật `INVENTORY.md` §0**
(thêm dòng kind/path) — chống drift.

## Giai đoạn 1 — Dockerfile trong repo

Nếu repo đã có Dockerfile: kiểm tra nó build được và `EXPOSE` đúng cổng, rồi
sang giai đoạn 2. Chưa có → viết theo nguyên tắc:

- Multi-stage (deps → build → runner), image cuối nhỏ nhất có thể, `NODE_ENV=production`.
- Chạy bằng user không-root nếu được (`USER node`).
- `EXPOSE <port>` đúng cổng app nghe.
- Nên có `HEALTHCHECK` (wget/curl endpoint health) — `docker ps` sẽ hiện (healthy).
- Next.js: cần `output: 'standalone'` trong next.config; **mẫu sống: `todo/Dockerfile`**
  (Next.js standalone multi-stage). App Python/khác: `nuc-monitor/Dockerfile`.
- Tạo/kiểm tra `.dockerignore` (node_modules, .git, .env…).

**KIỂM CHỨNG:** build thử local nếu máy dev có Docker; không có thì để CI
build ở giai đoạn 3 làm bước kiểm.

## Giai đoạn 2 — Workflow CI trong repo

Tạo `.github/workflows/deploy.yml` — chuẩn vàng là file cùng tên trong **mọi ghcr app còn
sống**: `D:\Projects\MiniServer\nuc-monitor\.github\workflows\deploy.yml` (bản gọn, không
build-arg) hoặc `todo\.github\workflows\deploy.yml`. Copy nguyên văn rồi chỉnh đúng 2 chỗ nếu cần:

- `file:` — đường dẫn Dockerfile (bỏ nếu Dockerfile ở root).
- `build-args:` — chỉ giữ nếu có biến build-time (giai đoạn 0 mục 6); nhớ
  tạo secret tương ứng trên GitHub: repo → Settings → Secrets → Actions.

Khung bắt buộc phải giữ nguyên: trigger `push: main` + `workflow_dispatch`,
`permissions: packages: write`, login ghcr bằng `GITHUB_TOKEN`,
metadata-action tag `latest` + `type=sha,prefix=,format=short`, cache `type=gha`,
`concurrency` chống build chồng.

**KIỂM CHỨNG:** YAML hợp lệ (đọc lại file), không có secret hardcode.

## Giai đoạn 3 — Push & xác minh image

0. **Setup convention cho repo** (nếu chưa): copy `.prettierrc` + `.prettierignore` từ
   `.claude/skills/coding-convention/templates/` vào repo (`npm i -D prettier`, thêm script `format`),
   và copy `hooks/commit-msg` vào `<repo>/.git/hooks/commit-msg` để ép Conventional Commits tại máy.
   Mọi code phải theo skill `/coding-convention`.
1. Commit (message tiếng Anh, kiểu `ci: build & push image to ghcr`) — **hỏi
   user trước khi push** nếu đây là lần đầu đụng repo này trong phiên.
2. `git push origin main`.
3. Theo dõi build: poll `https://api.github.com/repos/thiengthb/<repo>/actions/runs?per_page=1`
   (status/conclusion) hoặc poll image từ NUC:
   `docker manifest inspect ghcr.io/thiengthb/<repo>:latest`.
4. Build fail → đọc annotation qua API check-runs. Các lỗi đã biết:
   - "account is locked due to a billing issue" → user phải gỡ ở
     github.com/settings/billing; tạm thời build tay trên NUC (xem tài liệu 02 mục 4.5).
   - fail ở bước push image → repo Settings → Actions → Workflow permissions
     → Read and write.

**KIỂM CHỨNG:** `docker manifest inspect ghcr.io/thiengthb/<repo>:latest`
chạy từ NUC trả về OK.

## Giai đoạn 4 — Khai báo app trên NUC

Tạo `/opt/apps/<tên>/` với 3 file. Mẫu compose (điền các chỗ `<...>`):

```yaml
name: <tên>

services:
  app:
    image: ghcr.io/thiengthb/<repo>:latest
    container_name: <tên>
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - edge
    # CHỈ thêm volumes nếu app có dữ liệu persist:
    volumes:
      - app_data:/<đường-dẫn-data-trong-container>
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
      # --- 4 dòng PUBLIC: xoá hết nếu app chỉ chạy nội bộ ---
      - "traefik.enable=true"
      - "traefik.http.routers.<tên>.rule=Host(`<sub>.thientnse.site`)"
      - "traefik.http.routers.<tên>.entrypoints=web"
      - "traefik.http.services.<tên>.loadbalancer.server.port=<PORT>"

networks:
  edge:
    external: true

# CHỈ khi có volume:
volumes:
  app_data:
    name: <tên>_data
```

- `.env`: các biến runtime thật (chmod 600). `.gitignore`: chứa `.env`.
- App KHÔNG có khối `ports:` — vi phạm bất biến #2.
- Tên router/service traefik phải duy nhất toàn NUC (trùng là route đè nhau
  im lặng) — đã kiểm ở giai đoạn 0 mục 4.

Rồi: `cd /opt/apps/<tên> && docker compose up -d`.

**KIỂM CHỨNG:** `docker compose ps` Up (healthy nếu có HEALTHCHECK);
logs không lỗi.

## Giai đoạn 5 — Nghiệm thu (bắt buộc đủ 4, app public thì đủ 5)

```bash
# ① App nằm trong edge cùng traefik:
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'
# ② Traefik đã nhận route (app public):
curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers | grep <tên>
# ③ URL public sống:
curl -s -o /dev/null -w "%{http_code}" https://<sub>.thientnse.site   # → 200
# ④ Watchtower nhìn thấy app (chờ ≤70s):
docker logs watchtower --since 2m | tail -2    # Scanned tăng, Failed=0
# ⑤ (khuyến nghị) Chu trình tự động trọn vẹn: push 1 commit nhỏ,
#    xác nhận watchtower log "Found new image ... Stopping ... Started"
```

Lỗi ở bước nào → bảng debug `nuc-platform/01-KIEN-TRUC-VA-VAN-HANH.md` mục 7.
Không pass nghiệm thu thì KHÔNG báo hoàn thành với user.

## Giai đoạn 6 — Báo cáo

Tóm tắt cho user: URL (nếu public), vị trí file trên NUC, image+tag hiện tại,
cách rollback (ghim tag SHA), biến env nào đang trống cần user điền. Nhắc:
từ giờ chỉ cần `git push origin main`.
