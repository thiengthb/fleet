# INVENTORY — Nguồn sự thật DUY NHẤT của NUC `thienminiserver`

> Mọi thay đổi vòng đời (thêm/gỡ/đổi domain/đổi volume/đổi mức auth) **PHẢI** cập nhật
> file này NGAY trong cùng lượt làm. Skill `/nuc-new-project` và `/nuc-remove-project`
> bắt buộc sửa bảng dưới; `/nuc-health-audit` đối chiếu file này với thực tế để bắt drift.
> Nếu bảng và thực tế lệch nhau → coi như có sự cố, điều tra (đừng tin bảng một cách mù quáng).

Cập nhật gần nhất: **2026-06-11** (xác minh trực tiếp từ `docker ps`/`docker volume ls` trên NUC).
Mới nhất (2026-06-12): thêm app **journal** (`journal.thientnse.site`, Next.js + Postgres/pgvector) — đã gắn Authentik forward-auth (group `journal-access`), app đọc `X-authentik-email`.
Mới nhất (2026-06-12): thêm app **yakudoku** (`yakudoku.thientnse.site`, trainer dịch JP↔VI) — monorepo 1 repo → **3 image** (web public sau Authentik group `yakudoku-access`; core FastAPI nội bộ là writer DUY NHẤT của SQLite `yakudoku_data`; bot Discord headless). Provider Authentik pk 4.

---

## 0. Bản đồ project (kind + đường dẫn) — registry phân loại

> Phân loại theo **`kind`** thay vì lồng thư mục: mọi project nằm phẳng ở `D:\Projects\MiniServer\<tên>`,
> quét bảng này là biết bản chất từng cái. `kind` quyết định **archetype** khi tạo mới (skill
> `/nuc-new-project` → "Chọn archetype"). Layout máy dev ≠ layout NUC (`/opt/apps` + `/opt/infra`).

| Project | kind | Mô tả ngắn | Repo GitHub | Path dev | NUC |
|---------|------|-----------|-------------|----------|-----|
| **todo** | `web-app` (Next) | Smart todo + MCP — **implementation tham chiếu** cho web-app | `thiengthb/todo` | `MiniServer/todo` | `/opt/apps/todo` |
| **journal** | `web-app` (Next) | Nhật ký + reflection (Postgres/pgvector) | `thiengthb/journal` | `MiniServer/journal` | `/opt/apps/journal` |
| **yakudoku** | `monorepo` (→3 image) | Trainer dịch JP↔VI (web+core+bot) — tham chiếu monorepo | `thiengthb/yakudoku` | `MiniServer/yakudoku` | `/opt/apps/yakudoku` |
| **jobhunter-bot** | `node-bot` (worker) | Bot Discord gateway tìm việc — tham chiếu node-bot | `thiengthb/jobhunter-bot` | `MiniServer/jobhunter-bot` | `/opt/apps/jobhunter-bot` |
| **nuc-ops-bot** | `python-worker` (bot) | Bot Discord ChatOps điều khiển NUC | `thiengthb/nuc-ops-bot` | `MiniServer/nuc-ops-bot` | `/opt/apps/nuc-ops-bot` |
| **nuc-monitor** | `python-worker` | Giám sát NUC → Discord — tham chiếu python-worker | `thiengthb/nuc-monitor` | `MiniServer/nuc-monitor` | `/opt/apps/nuc-monitor` |
| **authentik** | `infra` (bên thứ 3) | IdP trung tâm (image ghim, update tay) | `thiengthb/authentik` (compose) | `MiniServer/authentik` | `/opt/apps/authentik` |
| **n8n** | `infra` (bên thứ 3) | Workflow automation (image ghim) | `thiengthb/n8n` (workflow) | `MiniServer/n8n` | `/opt/apps/n8n` |
| **ui-kit** | `meta` (không deploy) | shadcn registry frontend dùng chung (copy-in) | `thiengthb/ui-kit` | `MiniServer/ui-kit` | — |
| **nuc-platform** | `meta` (control plane) | Tài liệu nền + **INVENTORY này** + `.claude/skills` | `thiengthb/miniserver-platform` | `MiniServer/` (gốc) | — |

**5 `kind` chuẩn** (định hình archetype + bất biến áp dụng):

- `web-app` — Next.js App Router, public sau Traefik+Authentik, có `components.json`+ui-kit. Theo §12/§16 nếu là app phức.
- `worker` — headless (`node-bot` hoặc `python-worker`): KHÔNG Traefik/port, nối `edge` chỉ để egress.
- `monorepo` — 1 repo → nhiều image (CI matrix); 1 image là writer DB duy nhất nếu dùng SQLite.
- `infra` — image bên thứ 3 ghim version: KHÔNG label Watchtower, update = bump tag thủ công.
- `meta` — không deploy lên NUC (lib dùng chung / tài liệu / skill).

---

## 1. Apps (`/opt/apps/<tên>`)

| App | Domain | Image | Auto-update | Volume | Mức auth | Monitor | Repo image |
|-----|--------|-------|-------------|--------|----------|---------|------------|
| **authentik** | `auth.thientnse.site` | `ghcr.io/goauthentik/server:2026.5.2` | ❌ thủ công (bump `AUTHENTIK_TAG`) | `authentik_certs`, `authentik_database`, `authentik_media`, `authentik_templates` | IdP trung tâm (chính nó) | ✅ | bên thứ 3 (goauthentik) |
| **n8n** | `n8n.thientnse.site` | `docker.n8n.io/n8nio/n8n:2.25.7` | ❌ thủ công (image ghim) | `n8n_data` | (auth nội bộ của n8n) | ✅ | bên thứ 3 (n8nio) |
| **todo** | `todo.thientnse.site` | `ghcr.io/thiengthb/todo:latest` | ✅ Watchtower | `todo_data` | forward-auth, giới hạn group `todo-access`; **endpoint MCP/OAuth được miễn** (router `todo-mcp`, auth ở tầng app) | ✅ | `thiengthb/todo` |
| **journal** | `journal.thientnse.site` | `ghcr.io/thiengthb/journal:latest` (private) | ✅ Watchtower | (DB ở `journal-db`) | forward-auth, giới hạn group `journal-access`; app đọc `X-authentik-email` định danh user (mẫu sống đầu tiên); **miễn** `/api/health` + `/api/dev/*` (router `journal-public`, gác `DEV_TRIGGER_SECRET`) | (chưa) | `thiengthb/journal` (private; NUC pull bằng PAT trong `~/.docker/config.json`) |
| ↳ **journal-db** | — (Postgres+pgvector, chỉ network kín `journal_internal`, KHÔNG edge) | `pgvector/pgvector:pg16` | ❌ (bên thứ 3, ghim `pg16`) | `journal_db` | n/a (không expose) | — | bên thứ 3 (pgvector) |
| **yakudoku-web** | `yakudoku.thientnse.site` | `ghcr.io/thiengthb/yakudoku-web:latest` (private) | ✅ Watchtower | (không) | forward-auth, group `yakudoku-access`; web đọc `X-authentik-email`→`X-User-Email` tới core; **miễn** `/api/health` (router `yakudoku-public`) | (chưa) | `thiengthb/yakudoku` (monorepo) |
| ↳ **yakudoku-core** | — (FastAPI; trên `edge` nhưng **không** Traefik = nội bộ; writer DUY NHẤT của DB) | `ghcr.io/thiengthb/yakudoku-core:latest` (private) | ✅ Watchtower | `yakudoku_data` (SQLite, mount `/data`) | n/a (không expose) | (chưa) | `thiengthb/yakudoku` |
| ↳ **yakudoku-bot** | — (worker headless Discord; `edge` để egress + gọi core, **không** Traefik) | `ghcr.io/thiengthb/yakudoku-bot:latest` (private) | ✅ Watchtower | (không) | allowlist qua Discord (chưa cấu hình) | ✅ (qua core) | `thiengthb/yakudoku` |
| **nuc-monitor** | — (nội bộ, **không** Traefik/edge) | `ghcr.io/thiengthb/nuc-monitor:latest` | ✅ Watchtower | (không) | n/a (không expose) | tự nó (giám sát các app khác) | `thiengthb/nuc-monitor` |
| **jobhunter-bot** | — (worker headless, **không** Traefik/port; nối `edge` để egress) | `ghcr.io/thiengthb/jobhunter-bot:latest` | ✅ Watchtower | (không) | n/a (không expose) | ✅ | `thiengthb/jobhunter-bot` |
| **nuc-ops-bot** | — (worker headless, **không** Traefik/port; `edge` egress + `ops-internal` kín tới proxy) | `ghcr.io/thiengthb/nuc-ops-bot:latest` | ✅ Watchtower | (không) | allowlist user-ID + 1 kênh ops (trong bot, không qua Authentik) | ✅ | `thiengthb/nuc-ops-bot` |
| ↳ **ops-proxy** | — (sub-container của nuc-ops-bot, chỉ `ops-internal`) | `lscr.io/linuxserver/socket-proxy:latest` | ❌ (bên thứ 3) | (không) | n/a | — | bên thứ 3 (linuxserver) |
| ↳ **img-proxy** | — (sub-container của nuc-ops-bot, chỉ `ops-internal`) | `lscr.io/linuxserver/socket-proxy:latest` | ❌ (bên thứ 3) | (không) | n/a | — | bên thứ 3 (linuxserver) |

Ghi chú:
- **nuc-monitor cố tình KHÔNG có Traefik/edge/Watchtower-route web** — nó dùng bridge để gửi
  Discord và mount `docker.sock` + `/:/host:ro` để đọc trạng thái. Đừng "sửa cho giống app web".
- **n8n** và **authentik** dùng image bên thứ 3 đã ghim phiên bản → **không** gắn label
  `com.centurylinklabs.watchtower.enable=true`; nâng cấp = bump tag thủ công rồi `docker compose up -d`.
- **jobhunter-bot** = bot Discord (gateway) cho hệ tìm việc; chat tự do → gọi webhook n8n
  `Job Search Agent` (`/webhook/job-search`, header `x-bot-secret`). Cặp workflow n8n: **Job Digest**
  (bản tin việc làm 08:00 → Discord) + **Job Search Agent**. LLM = Groq free tier; search = Tavily.
  Secrets trong `/opt/apps/jobhunter-bot/.env` + credential n8n (không commit). Repo: `thiengthb/n8n` (workflow) + `thiengthb/jobhunter-bot` (bot).
- **nuc-ops-bot** = bot Discord ChatOps điều khiển NUC (slash command + nút xác nhận + `/ask` LLM).
  **Quyền root-equiv được bó nhiều lớp**: KHÔNG chạm `docker.sock` thật — qua 2 socket-proxy bó verb
  (`ops-proxy`: CONTAINERS đọc + ALLOW_START/STOP/RESTARTS, KHÔNG create/exec/build; `img-proxy`: chỉ
  IMAGES prune). Allowlist user-ID + 1 kênh ops; container hạ tầng (traefik/cloudflared/watchtower/authentik*/
  proxy/bot/nuc-monitor) bị chặn thao tác. Lệnh: `/ps /top /logs /health` (đọc) + `/restart /stop /start
  /prune` (ghi, có nút xác nhận) + `/ask` (LLM đề xuất). **KHÔNG có `/redeploy`** — chủ ý bỏ vì Watchtower
  đã auto-update ≤60s; không bật Watchtower HTTP API (giữ infra tối giản). LLM = Groq
  (action-selector, chỉ đề xuất, không tự thực thi). Secrets `/opt/apps/nuc-ops-bot/.env`. Repo: `thiengthb/nuc-ops-bot`.

## 2. Infra (`/opt/infra`) + ngoài hệ thống

| Thành phần | Vai trò | Image | Volume | Ghi chú |
|-----------|---------|-------|--------|---------|
| **traefik** | Reverse proxy / router | `traefik:v3.7` | (không) | Chỉ docker provider; `exposedbydefault=false`. Tạo network `edge`. |
| **cloudflared** | Cloudflare Tunnel ra Internet | `cloudflare/cloudflared:latest` | (không) | TLS do Cloudflare lo (không Let's Encrypt). |
| **watchtower** | Tự pull image mới (≤60s) | `containrrr/watchtower:latest` | (không) | `DOCKER_API_VERSION=1.44` (bắt buộc — Docker 29). Chỉ động vào container có label enable. |
| **netdata** | Giám sát hệ thống (ngoài quy trình) | `netdata/netdata` | `netdatacache`, `netdataconfig`, `netdatalib` | "Ngoài hệ thống" (doc 01 §4.5). |

## 3. Authentik — providers / applications / groups

Chi tiết đầy đủ: [`../authentik/docs/auth-apps.md`](../authentik/docs/auth-apps.md) (registry chính).
Tóm tắt để đối chiếu nhanh:

| pk | Provider | Mode | external_host | Application | Group hạn chế |
|----|----------|------|---------------|-------------|---------------|
| 1 | `NUC SSO (forward-auth domain)` | `forward_domain` | `https://auth.thientnse.site` | `NUC SSO` (slug `nuc-sso`) | — (toàn cookie-domain) |
| 2 | `todo` | `forward_single` | `https://todo.thientnse.site` | `Todo` (slug `todo`) | `todo-access` |
| 3 | `journal` | `forward_single` | `https://journal.thientnse.site` | `Journal` (slug `journal`) | `journal-access` |
| 4 | `yakudoku` | `forward_single` | `https://yakudoku.thientnse.site` | `Yakudoku` (slug `yakudoku`) | `yakudoku-access` |

## 4. Network `edge`

Do infra tạo (`external: true` ở mọi app). Container đang nối `edge`: traefik, cloudflared,
authentik-server, n8n, todo, journal, jobhunter-bot, nuc-ops-bot, watchtower,
yakudoku-web, yakudoku-core, yakudoku-bot (cả 3 nối edge; core+bot KHÔNG có Traefik label = nội bộ). (nuc-monitor KHÔNG nối edge — chủ đích;
jobhunter-bot & nuc-ops-bot nối edge chỉ để egress, KHÔNG có Traefik label. `ops-proxy`/`img-proxy`
KHÔNG nối edge — chỉ ở mạng kín `ops-internal` cùng nuc-ops-bot. `journal-db` KHÔNG nối edge — chỉ ở mạng
kín `journal_internal` cùng app journal.)

---

## 5. 🧹 Nợ kỹ thuật / orphan

**Sạch tính tới 2026-06-11.** Đã dọn trong đợt soát: volume `backend_link_data` (link-manager),
`open-webui` (1 GB), `portainer_data` (Portainer cũ) + dangling images — tổng thu hồi ~2.6 GB.
Mọi volume còn lại đều thuộc app đang sống. Khi `/nuc-health-audit` tìm thấy orphan mới → ghi vào đây.

---

## 6. App đã khai tử (lịch sử — để khỏi nhầm)

| App | Domain cũ | Khai tử | Ghi chú |
|-----|-----------|---------|---------|
| `link-manager` | `link.thientnse.site` | 2026-06-11 | Container/image/dir + cả volume (`link-manager_data` và `backend_link_data`) đã xóa; group Authentik `link-manager:read|write` đã xóa. Sạch. |
| `anki-jp-tool` | `anki.thientnse.site` | 2026-06-11 | Container/image/volume/dir đã xóa; không có provider/group Authentik riêng (app mở). |
