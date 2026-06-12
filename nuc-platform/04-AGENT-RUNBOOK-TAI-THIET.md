# TÀI LIỆU 4 — RUNBOOK CHO AI AGENT: TÁI THIẾT NUC PLATFORM SAU RESET

> **Người đọc file này là AI agent (Claude Code), không phải con người.**
>
> Khi user (Teruhiro) nói đại loại: *"NUC của tôi bị reset rồi, dựng lại hệ
> thống theo runbook đi"* — hãy đọc TOÀN BỘ file này trước khi chạy lệnh đầu
> tiên, rồi thực hiện tuần tự. File này là phiên bản dành-cho-agent của
> `03-SETUP-FROM-SCRATCH.md`: cùng đích đến, nhưng ghi rõ **cái gì agent tự
> làm được, cái gì phải nhờ user, hỏi user câu gì, và kiểm chứng thế nào**.
>
> Hai tài liệu nền bắt buộc đọc kèm (cùng thư mục):
> - `01-KIEN-TRUC-VA-VAN-HANH.md` — kiến trúc đích cần đạt.
> - `02-MO-XE-LOI-HE-THONG-CU.md` — các bẫy đã từng gây lỗi. KHÔNG lặp lại chúng.

---

## 0. LUẬT LÀM VIỆC (không thương lượng)

1. **Tuần tự từng PHASE, dừng ở mỗi 🛑 CHECKPOINT** chờ user xác nhận/cung cấp
   thông tin. Không nhảy cóc.
2. **Mọi lệnh phá huỷ (`down`, `rm`, `prune`, ghi đè file) phải liệt kê chính
   xác thứ bị ảnh hưởng và hỏi trước** — kể cả khi máy "mới reset" (có thể user
   đã kịp cài thứ gì đó, hoặc reset không sạch như họ nghĩ).
3. **Secrets**: token/PAT/key chỉ được ghi vào `.env` chmod 600 trên NUC.
   Không echo secrets ra log/chat trừ khi user tự dán vào. Mọi thư mục chứa
   `.env` phải có `.gitignore` chứa `.env`.
4. Lệnh lỗi → dừng, đọc log, chẩn đoán, đề xuất — không đoán mò chạy tiếp.
5. Sau mỗi phase: tóm tắt ngắn đã làm gì + phase kế tiếp là gì.
6. Kiểm tra memory của bạn (`MEMORY.md` của project này) — có thể chứa thông
   tin mới hơn file này (token đổi, version đổi…). Mâu thuẫn → tin memory mới
   hơn, và hỏi user khi nghi ngờ.

---

## 1. ĐÁNH GIÁ TÌNH HUỐNG TRƯỚC TIÊN (Phase 0)

Hỏi user / tự kiểm để xác định **mức độ mất mát** — quyết định phải làm phase nào:

| Câu hỏi | Nếu CÒN | Nếu MẤT |
|---|---|---|
| NUC còn SSH được không? (`Test-NetConnection thienminiserver -Port 22`) | Sang kiểm tra tiếp | Nhờ user cài OS + OpenSSH + Tailscale (họ có `03-SETUP-FROM-SCRATCH.md` bước 1–3) |
| SSH key của máy dev còn ăn không? (`ssh -o BatchMode=yes thien25@thienminiserver "echo OK"`) | Bỏ qua mục 2.2 | Làm mục 2.2 (bootstrap SSH) |
| Docker trên NUC? (`docker --version`) | Ghi lại version — **nếu ≥ 29 thì mọi ràng buộc API trong file này áp dụng** | User cài: `curl -fsSL https://get.docker.com \| sudo sh` + `usermod -aG docker thien25` |
| Cloudflare tunnel cũ còn không? (hỏi user, hoặc xem dashboard) | Chỉ cần token, KHÔNG đụng DNS | Phase 4 phải làm thêm phần tạo tunnel + sửa DNS wildcard |
| Repo GitHub + workflow còn không? | (Gần như chắc chắn còn — reset NUC không ảnh hưởng GitHub) Bỏ qua phía repo | Xem `03` Phụ lục B |
| Backup volume dữ liệu có không? (hỏi user) | Restore ở Phase 5 TRƯỚC khi up app | App khởi đầu DB trống — nói rõ cho user biết |

🛑 **CHECKPOINT 0** — Trình bày bảng đánh giá đã điền cho user, chốt danh sách
phase sẽ chạy. Chờ đồng ý.

---

## 2. KẾT NỐI TỪ MÁY DEV (Phase 1)

### 2.1. Thông tin chuẩn (xác nhận lại với user nếu khác)
- Host: `thienminiserver` (Tailscale, từng là `100.126.231.94`)
- User: `thien25` (thuộc group `docker`, có sudo; password sudo = password user — user sẽ cung cấp nếu cần)
- Máy dev: Windows, làm việc tại `D:\Projects\MiniServer\`

### 2.2. Bootstrap SSH key (chỉ khi key chưa ăn)
Máy dev là Windows PowerShell 5.1, **không có sshpass**. Cách đã kiểm chứng
hoạt động (phiên 2026-06-07):

```powershell
# 1. Tạo key nếu chưa có:
ssh-keygen -t ed25519 -N '""' -f "$env:USERPROFILE\.ssh\id_ed25519" -C "claude-code@windows"
# 2. Cài Posh-SSH để xác thực password MỘT lần (hỏi user lấy password):
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser
Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
# 3. Dùng New-SSHSession + Invoke-SSHCommand append pubkey vào ~/.ssh/authorized_keys
#    (mkdir -p ~/.ssh; chmod 700; chmod 600 authorized_keys)
```
Hoặc đơn giản hơn: nhờ user chạy `! type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh thien25@thienminiserver "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"` và nhập password.

**✅ KIỂM CHỨNG:** `ssh -o BatchMode=yes thien25@thienminiserver "echo OK; groups"`
→ `OK` + group có `docker`.

> Lưu ý vận hành: chạy lệnh dài trên NUC qua `ssh thien25@thienminiserver '<lệnh>'`
> bằng tool Bash (Git Bash) sẽ đỡ lỗi quoting hơn PowerShell. Tránh template Go
> có `$` trong PowerShell — nó nuốt biến.

---

## 3. KHẢO SÁT & DỌN NỀN (Phase 2 — chỉ khi NUC không sạch hoàn toàn)

Chạy bộ lệnh CHỈ ĐỌC, báo cáo cho user:
```bash
docker ps -a ; docker network ls ; docker compose ls -a ; docker volume ls
docker network inspect edge 2>/dev/null || echo "edge chưa có"
```
Có rác cũ → liệt kê chính xác thứ định xoá, **🛑 hỏi xác nhận**, rồi mới
`down`/`rm`/`prune -f` (KHÔNG `-a`, KHÔNG `--volumes` trừ khi user duyệt).
**Volume nào tên `*_data` tuyệt đối giữ** trừ khi user nói bỏ.

---

## 4. DỰNG HẠ TẦNG (Phase 3–4)

Nội dung file **nguyên văn** lấy ở `03-SETUP-FROM-SCRATCH.md` Bước 6 và 8 —
KHÔNG chế lại từ trí nhớ. Trình tự và những điểm agent hay sai:

### 4.1. `/opt/infra` (traefik + cloudflared)
```bash
sudo mkdir -p /opt/infra /opt/apps && sudo chown -R thien25:thien25 /opt/infra /opt/apps
# (sudo qua SSH không tty: dùng `echo <password> | sudo -S ...` — xin password từ user)
```
- Viết `docker-compose.yml` theo `03` Bước 6.2. **Traefik PHẢI ≥ v3.7** —
  đây là bài học xương máu số 1 (tài liệu 02 mục 2): bản cũ pin Docker API 1.24,
  Docker ≥ 29 từ chối → provider chết im lặng, route 404 toàn tập, env
  `DOCKER_API_VERSION` KHÔNG cứu được traefik (đã thử, thất bại).
- 🛑 **CHECKPOINT token**: hỏi user lấy `TUNNEL_TOKEN` (Cloudflare One →
  Tunnels → Configure). Ghi vào `/opt/infra/.env` chmod 600. Nếu user còn
  `.env` backup thì dùng lại.
- `docker compose up -d` rồi **✅ KIỂM CHỨNG**:
  - `docker logs cloudflared | grep -c "Registered tunnel connection"` ≥ 1
  - `docker logs traefik --tail 20` **không có ERR** (có "client version ... too old" = image sai)
  - `curl -s -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers` trả JSON có router dashboard → provider sống.

### 4.2. Cloudflare (chỉ khi tunnel/DNS thay đổi)
Agent không tự làm được dashboard (trừ khi user đưa API token có quyền
Zone.DNS:Edit + Tunnel:Edit). Hướng dẫn user theo `03` Bước 7:
wildcard hostname `*.thientnse.site → http://traefik:80` + DNS
`CNAME * → <TUNNEL-ID>.cfargotunnel.com` (proxied), xoá record lẻ trỏ tunnel cũ.

**✅ KIỂM CHỨNG (quan trọng — phân biệt được 3 trạng thái):**
`curl -s -o /dev/null -w "%{http_code}" https://vu-vo-bat-ky.thientnse.site`
- `404` = ĐẠT (chuỗi thông, traefik trả 404 vì chưa có app)
- `530` = DNS trỏ tunnel-id sai (bài học số 2, tài liệu 02 mục 3)
- timeout = DNS chưa lan / tunnel chưa chạy

### 4.3. Watchtower
- 🛑 Nhờ user login ghcr trên NUC: `echo '<PAT read:packages>' | docker login ghcr.io -u thiengthb --password-stdin` (hoặc user dán PAT cho agent chạy).
- Viết `/opt/infra/watchtower.yml` theo `03` Bước 8.2. **3 chi tiết sống còn**
  (mỗi cái là một lỗi đã dính thật, tài liệu 02 mục 4):
  1. `name: watchtower` ở đầu file (thiếu → chung project với infra → `--remove-orphans` xoá nhầm traefik).
  2. `DOCKER_API_VERSION=1.44` trong env (thiếu → watchtower chết: "client version 1.25 is too old").
  3. Mount **thư mục** `/home/thien25/.docker:/config:ro` + `DOCKER_CONFIG=/config` (mount file lẻ → re-login là watchtower mù credential, lỗi 403 "auth not present").
- **✅ KIỂM CHỨNG:** chờ ~70s, `docker logs watchtower | tail -3` →
  `Session done Failed=0 Scanned=0` (Scanned=0 đúng vì chưa có app gắn label).

---

## 5. KHÔI PHỤC & DEPLOY APP (Phase 5)

1. **Restore volume TRƯỚC** (nếu có backup): `03` Bước 4. Volume chuẩn của
   link-manager: `link-manager_data` (SQLite tại `/data/links.db`).
2. Image trên ghcr.io **vẫn còn sau khi reset NUC** (nó nằm trên GitHub) —
   không cần build lại gì. Kiểm: `docker manifest inspect ghcr.io/thiengthb/linkmanager:latest`.
3. Dựng `/opt/apps/link-manager/` theo `03` Bước 9 (compose + `.env` + `.gitignore`).
   `.env` từ backup của user; không có backup → dùng template trong `03` 9.2
   và **báo rõ user** biến nào đang trống (`API_KEY`, `GEMINI_API_KEY`).
4. Các app khác (nếu đã có thêm sau 2026-06): hỏi user danh sách, hoặc xem
   memory; mỗi app làm đúng khuôn skill `/nuc-new-project`.
5. `docker compose up -d` từng app.

---

## 6. NGHIỆM THU TOÀN HỆ THỐNG (Phase 6 — bắt buộc trước khi báo xong)

Chạy đủ 6 kiểm tra ở `03` Bước 10. Tóm tắt ngưỡng đạt:
1. `docker ps` — đủ container, không restart-loop.
2. Traefik API có route của từng app public.
3. `curl https://<app>.thientnse.site` → 200 (và dữ liệu cũ hiện ra nếu có restore).
4. Subdomain vu vơ → 404.
5. Watchtower: `Failed=0 Scanned=<số app>`, không 403.
6. (Nếu user đồng ý) push 1 commit nhỏ → xác nhận watchtower tự pull trong ≤60s+build time.

**Không pass đủ → không được báo hoàn thành.** Pass đủ → tóm tắt: cái gì đã
dựng, secrets nào user còn nợ, và cập nhật memory của bạn (file
`nuc-platform-setup` — sửa những gì đã đổi: tunnel ID mới? version mới? app mới?).

---

## 7. TRA CỨU NHANH KHI GẶP LỖI TRONG LÚC TÁI THIẾT

| Thấy gì | Nghĩa là | Làm gì |
|---|---|---|
| traefik log "client version 1.24 too old" | Image traefik < v3.7 | Đổi image, KHÔNG thử env workaround (vô dụng với traefik) |
| watchtower "client version 1.25 too old" | Thiếu `DOCKER_API_VERSION=1.44` | Thêm env |
| watchtower 403 "auth not present" | Credential stale (mount file lẻ) hoặc chưa login | Mount thư mục + re-login |
| curl wildcard ra 530 | DNS trỏ tunnel-id cũ/chết | So tunnel-id trong DNS record với tunnel đang chạy |
| curl app ra 404 | Traefik chưa có route | Label app: enable/Host/port; app có trong network edge? |
| curl app ra 502 | Route có, gọi app fail | App thiếu `networks: [edge]` hoặc sai `loadbalancer.server.port` |
| Actions fail 0 step | Billing lock GitHub | User gỡ ở github.com/settings/billing; tạm: build tay trên NUC, push bằng PAT write:packages |
| compose báo orphan ở /opt/infra | watchtower.yml thiếu `name:` | Thêm `name: watchtower` |
| `docker compose ls` trỏ path không tồn tại | Stack mồ côi (file bị di chuyển) | down bằng `docker rm` trực tiếp, dựng lại đúng chỗ |

---

*File này được viết bởi Claude (Opus 4.8) ngay sau lần dựng đầu tiên 2026-06-07,
khi mọi vết thương còn mới. Nếu bạn-phiên-bản-tương-lai thấy thực tế khác file
này (version mới, lỗi mới), hãy cập nhật file này và memory sau khi xong việc.*
