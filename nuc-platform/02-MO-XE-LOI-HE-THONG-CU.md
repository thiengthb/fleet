# TÀI LIỆU 2 — MỔ XẺ: VÌ SAO HỆ THỐNG CŨ LỖI & ĐÃ SỬA NHƯ THẾ NÀO

> Đây là biên bản "khám nghiệm" kiến trúc cũ trên NUC `thienminiserver`,
> thực hiện ngày 2026-06-07 TRƯỚC khi xoá bất cứ thứ gì — để hiểu tận gốc
> nguyên nhân, không sửa mò. Mỗi mục gồm: **triệu chứng → bằng chứng →
> cơ chế gây lỗi → cách sửa → bài học**.

---

## MỤC LỤC

1. [Hiện trường trước khi dọn](#1-hiện-trường-trước-khi-dọn)
2. [Lỗi gốc #1 — Traefik v3.5 chết Docker provider trên Docker 29 (lỗi chính)](#2-lỗi-gốc-1)
3. [Lỗi gốc #2 — DNS trỏ tunnel "ma" → toàn bộ web 530](#3-lỗi-gốc-2)
4. [Các lỗi trong lúc dựng lại (và đã xử lý ngay)](#4-lỗi-phát-sinh-khi-dựng-lại)
5. [Các vấn đề kiến trúc nền của hệ thống cũ](#5-vấn-đề-kiến-trúc-nền)
6. [Tổng kết: chuỗi sự kiện dẫn đến "lỗi không rõ nguyên nhân"](#6-tổng-kết-chuỗi-sự-kiện)
7. [Bài học rút ra](#7-bài-học-rút-ra)

---

## 1. HIỆN TRƯỜNG TRƯỚC KHI DỌN

Kết quả các lệnh chẩn đoán **chỉ-đọc** (`docker ps -a`, `docker network ls`,
`docker compose ls`, `docker logs`, `docker network inspect`):

| Container | Image | Network | Tình trạng lúc khám |
|---|---|---|---|
| traefik | traefik:v3.5 | `infrastructure` | Up — nhưng provider Docker **chết hoàn toàn** |
| cloudflared | cloudflared:latest | `infrastructure` | Up — tunnel registered 4 kết nối (khoẻ!) |
| link-manager-api | build local trên NUC | `infrastructure` | Up, healthy, publish 3001 ra host |
| portainer | portainer-ce | `infrastructure` | Up |
| netdata | netdata | `host` | Up (không liên quan) |

Các quan sát quan trọng:
- Network `edge` **chưa từng tồn tại**. Nhưng mọi container đều cùng network
  `infrastructure` → **lỗi "khác network gây 502" KHÔNG phải thủ phạm lần này**
  (đây là điều bất ngờ đầu tiên — kịch bản lỗi phổ biến nhất lại không xảy ra).
- `https://link.thientnse.site` và `https://portainer.thientnse.site` đều trả
  **HTTP 530** (lỗi origin của Cloudflare) — dù tunnel trên NUC báo connected.
- `docker compose ls` trỏ vào những đường dẫn **không còn tồn tại** (chi tiết mục 5.1).

---

## 2. LỖI GỐC #1 — TRAEFIK v3.5 CHẾT DOCKER PROVIDER TRÊN DOCKER 29
### (Đây chính là cái "lỗi không rõ nguyên nhân" của bạn)

### Triệu chứng
Mọi route qua traefik trả 404. Gắn label đúng đến mấy cũng vô dụng. Không có
thông báo lỗi nào hiện ra phía người dùng web ngoài trang 404 trống.

### Bằng chứng (log traefik, lặp vô hạn mỗi vài giây)
```
ERR Failed to retrieve information of the docker client and server host
    error="Error response from daemon: client version 1.24 is too old.
           Minimum supported API version is 1.40, please upgrade your client
           to a newer version" providerName=docker
ERR Provider error, retrying in 954.33254ms ...
```

### Cơ chế gây lỗi — giải thích tận gốc

1. Mọi tool nói chuyện với Docker (traefik, watchtower, portainer, chính lệnh
   `docker`) đều dùng **Docker Engine API** qua socket `/var/run/docker.sock`,
   và phải khai "tôi nói API phiên bản X".
2. **NUC cài Docker Engine 29.5.2** — phiên bản này **đã loại bỏ hỗ trợ mọi
   API < 1.40** (chính sách cắt API cũ của Docker).
3. **Traefik v3.5 (và mọi bản trước đó) ghim cứng API version `1.24` trong
   source code** — con số rất cũ, chọn từ xưa để tương thích rộng. Không có
   flag cấu hình nào đổi được; kể cả biến môi trường chuẩn `DOCKER_API_VERSION`
   cũng **bị giá trị ghim cứng đè lên** (đã thử thực tế khi dựng lại — xem mục 4.1).
4. Kết quả: daemon từ chối ngay ở bước bắt tay → **provider Docker không bao giờ
   khởi động được** → traefik không đọc được bất kỳ container/label nào →
   **bảng route trống rỗng vĩnh viễn** → mọi request khớp rule nào cũng không có → 404.
5. Traefik vẫn "Up" bình thường trong `docker ps`, web 80/443 vẫn nhận kết nối
   — nên nhìn từ ngoài **không hề có dấu hiệu nó đang hỏng**. Lỗi chỉ hiện trong
   log. Đây là lý do nó thành "lỗi không rõ nguyên nhân": thành phần hỏng
   nhưng không chết, không crash, không restart loop.

### Vì sao trước đó từng chạy được?
Gần như chắc chắn hệ thống từng chạy trên Docker phiên bản cũ hơn (API min
thấp hơn). Một lần **nâng cấp Docker Engine lên 29** (hoặc cài lại máy) đã
âm thầm rút thảm dưới chân traefik. Không ai đổi cấu hình traefik cả — nên
cảm giác "tự nhiên lỗi" là chính xác: thứ thay đổi là Docker, không phải config.

### Bằng chứng bạn đã từng vật lộn với hậu quả của nó
Lịch sử cấu hình ingress của cloudflared (đọc từ log) cho thấy quá trình thử-sai:
```
v1: *.thientnse.site         → http://traefik:80          (kiến trúc chuẩn, wildcard)
v2: api.thientnse.site       → http://traefik:80
v3: linkmgt.thientnse.site   → http://traefik:80
v4: portainer.thientnse.site → http://traefik:80
v5: + link.thientnse.site    → http://traefik:80
v6: link.thientnse.site      → http://link-manager-api:3001   ← BỎ traefik, trỏ thẳng app!
```
Bước v6 là "chữa cháy" kinh điển: vì traefik không bao giờ route được (do lỗi
trên), bạn đã trỏ tunnel **thẳng vào container app**, bypass traefik. Nó chạy
được — nhưng phá vỡ kiến trúc: mỗi app mới lại phải sửa Cloudflare, cơ chế
public/private bằng label trở nên vô nghĩa, và wildcard bị bỏ.

### Cách sửa (đã làm)
- **Nâng traefik lên v3.7.4** (build 2026-06-05). Từ v3.7, traefik dùng API
  version mới/thương lượng được với daemon hiện đại → provider sống lại ngay:
  log sạch lỗi, router từ label xuất hiện trong API của traefik trong vài giây.
- Quá trình xác minh: sau khi đổi image, gọi
  `curl -H "Host: traefik.localhost" http://127.0.0.1:8080/api/http/routers`
  thấy router đăng ký từ label Docker → kết luận provider hoạt động.

### Bài học
- `docker ps` thấy "Up" **không có nghĩa là khoẻ**. Phải đọc log từng thành
  phần infra sau mỗi lần nâng cấp bất kỳ thứ gì.
- Nâng cấp Docker Engine là thay đổi **có khả năng phá vỡ mọi tool bám socket**
  (traefik, watchtower, portainer…). Sau này nâng Docker → check log cả cụm ngay.

---

## 3. LỖI GỐC #2 — DNS TRỎ TUNNEL "MA" → TOÀN BỘ WEB 530

### Triệu chứng
`link.thientnse.site`, `portainer.thientnse.site` trả **HTTP 530** (Cloudflare
error 1033: origin unreachable) — trong khi `docker logs cloudflared` trên NUC
hiện rõ "Registered tunnel connection" × 4, tức tunnel đang sống khoẻ.

### Cơ chế gây lỗi
Một public hostname hoạt động cần **2 mảnh khớp nhau**:
1. **DNS record**: `<sub>.thientnse.site` → CNAME `<tunnel-id>.cfargotunnel.com`
2. **Cấu hình tunnel**: tunnel `<tunnel-id>` có ingress rule cho hostname đó.

Lỗi 530/1033 = mảnh (1) trỏ vào một tunnel-id **không có kết nối nào đang sống**.
Trên máy bạn từng tồn tại nhiều tunnel qua các lần thử (có tunnel tên
`nuc-server` cũ). Các DNS record cũ được tạo theo tunnel cũ; tunnel cũ chết/bị
thay → record thành "trỏ vào ma". Tunnel mới (`f725123c-…`) sống tốt nhưng
**không record nào trỏ vào nó** → Cloudflare không biết đường xuống NUC.

Đây là lỗi tầng "trên trời" (Cloudflare) — mọi debug trên NUC đều bế tắc vì
trên NUC thật sự **không có gì sai cả**. Triệu chứng đánh lừa: "tunnel connected
mà web chết".

### Cách sửa (đã làm — bạn thao tác trên dashboard theo hướng dẫn)
1. Xoá các public hostname lẻ cũ (`portainer.…`, `link.…` trỏ thẳng app).
2. Thêm **một wildcard duy nhất**: `*.thientnse.site → http://traefik:80`.
3. Xoá DNS record lẻ cũ (trỏ tunnel ma), thêm **một record wildcard**:
   `CNAME * → f725123c-a055-4119-92ec-32db3c1df4ea.cfargotunnel.com` (proxied).
4. Xác minh: `curl https://test-wildcard.thientnse.site` trả **404 của traefik**
   — 404 ở đây là TIN VUI: chứng minh chuỗi DNS → tunnel → traefik đã thông
   suốt (chỉ là chưa có app nào nhận host đó). Lỗi 530 biến mất.

### Bài học
- Wildcard một lần, sống mãi: từ nay **thêm app mới không bao giờ phải đụng
  Cloudflare** → không còn cơ hội tạo record lệch tunnel-id lần nào nữa.
- Khi gặp 530/1033: so sánh **tunnel-id trong DNS record** với **tunnel-id
  đang chạy** (`docker logs cloudflared` hoặc dashboard) — đó là phép kiểm tra
  một phát ăn ngay.

---

## 4. LỖI PHÁT SINH KHI DỰNG LẠI (đã xử lý ngay trong quá trình)

Phần này ghi lại để bạn hiểu vì sao cấu hình mới có những chi tiết "lạ".

### 4.1. Thử `DOCKER_API_VERSION=1.44` cho traefik v3.5 — THẤT BẠI (cố ý ghi lại)
Kế hoạch ban đầu dùng `traefik:v3.3` (theo template) + env `DOCKER_API_VERSION`.
Thực tế: **traefik bỏ qua env này** (giá trị ghim cứng trong code đè lên), lỗi
y nguyên. Kết luận bằng thực nghiệm: với traefik, **chỉ có nâng version** mới
sửa được → chốt v3.7. Đây là lý do compose của infra KHÔNG có env đó cho traefik.

### 4.2. Watchtower 1.7.1 cũng chết vì đúng bệnh API (pin 1.25)
```
level=error msg="Error response from daemon: client version 1.25 is too old.
                 Minimum supported API version is 1.40..."
```
Khác traefik, watchtower **CÓ** đọc env `DOCKER_API_VERSION` → thêm
`DOCKER_API_VERSION=1.44` vào environment là chạy. Vì vậy trong
`/opt/infra/watchtower.yml` có dòng env này — **không được xoá nó**.

### 4.3. Hai file compose chung thư mục = chung project → cảnh báo "orphan"
`watchtower.yml` nằm cùng `/opt/infra` với compose chính → compose coi là cùng
project `infra`, dọa "Found orphan containers ([traefik cloudflared])". Nguy
hiểm tiềm ẩn: ai đó chạy `docker compose -f watchtower.yml down --remove-orphans`
sẽ **xoá nhầm traefik + cloudflared**. Fix: thêm `name: watchtower` vào đầu
`watchtower.yml` — thành project riêng, hết va chạm.

### 4.4. Watchtower mù credential sau khi re-login ghcr (lỗi tinh vi nhất)
Triệu chứng: watchtower báo `403 Forbidden, auth: "not present"` khi check
image — dù `docker pull` bằng tay trên NUC chạy ngon.

Cơ chế: cấu hình ban đầu mount **file lẻ**
`/home/thien25/.docker/config.json:/config.json:ro`. Bind-mount file bám theo
**inode**. Khi bạn chạy `docker login` lần nữa (đổi PAT), docker **ghi file
mới** (inode mới) thay vì sửa file cũ → watchtower vẫn ôm inode cũ → nhìn thấy
nội dung credential đã chết.

Fix: mount **cả thư mục** + chỉ định nơi đọc config:
```yaml
volumes:
  - /home/thien25/.docker:/config:ro
environment:
  - DOCKER_CONFIG=/config
```
Từ giờ re-login thoải mái, watchtower luôn đọc bản mới. Đã xác minh: chu kỳ
quét sau đó `Session done Failed=0 Scanned=1` — sạch lỗi.

### 4.5. GitHub Actions fail với 0 step chạy — account khoá billing
Run đầu tiên của workflow mới fail mà **không step nào chạy**. Annotation:
> "The job was not started because your account is locked due to a billing issue."

Tức: workflow đúng, nhưng account `thiengthb` bị khoá billing → GitHub không
cấp máy ảo `ubuntu-latest`. (Nhiều khả năng đây cũng là lý do lịch sử khiến bạn
phải dùng **self-hosted runner trên NUC** trước đây!)

Xử lý tạm (đã làm): build image **một lần bằng tay trên NUC** từ clone sẵn có,
tag `latest` + `25e663c`, push lên ghcr bằng PAT `write:packages` → Phase 5
tiến tiếp được. Việc còn nợ: bạn gỡ khoá tại `github.com/settings/billing` →
re-run workflow → từ đó CI tự động hoàn toàn.

---

## 5. VẤN ĐỀ KIẾN TRÚC NỀN CỦA HỆ THỐNG CŨ
### (Chưa "gây cháy" ngay nhưng là bom hẹn giờ — đều đã loại bỏ trong bản mới)

### 5.1. Compose project "mồ côi" — mất khả năng quản lý stack
`docker compose ls` cũ trỏ vào:
```
cloudflared   /home/thien25/homelab/cloudflared/docker-compose.yml      ← KHÔNG TỒN TẠI
traefik       /home/thien25/homelab/traefik/docker-compose.yml          ← KHÔNG TỒN TẠI
```
File thật đã được dọn sang `~/homelab/infrastructure/...` **sau khi** container
được tạo — container vẫn chạy nhưng "mất giấy khai sinh": không
`docker compose down/up/restart` theo project được nữa, sửa file mới cũng không
ảnh hưởng container đang chạy (nó sinh ra từ file ở đường dẫn cũ). Hệ thống rơi
vào trạng thái "sửa config mãi không thấy đổi gì".
**Bản mới:** vị trí file là bất biến: `/opt/infra` và `/opt/apps/<tên>`. Muốn
di chuyển phải `down` ở chỗ cũ → chuyển → `up` ở chỗ mới.

### 5.2. TUNNEL_TOKEN nằm trần trụi trong docker-compose.yml
Token tunnel hardcode plaintext ngay trong file compose cũ — file dạng này rất
dễ bị commit lên git/chia sẻ khi hỏi bài. Lộ token = người khác chạy tunnel giả
danh bạn. **Bản mới:** token trong `/opt/infra/.env` (chmod 600) + `.gitignore`;
compose chỉ tham chiếu `${TUNNEL_TOKEN}`.

### 5.3. Traefik dashboard phơi `0.0.0.0:8080` + `api.insecure: true`
Bất kỳ ai trong LAN/Tailnet mở `http://<ip-nuc>:8080` là thấy toàn bộ sơ đồ
route, tên container, port nội bộ. **Bản mới:** bind `127.0.0.1:8080` — chỉ xem
được qua SSH tunnel.

### 5.4. Build image ngay trên NUC qua self-hosted runner
Workflow cũ `deploy-backend.yml` chạy `runs-on: self-hosted` — build + deploy
ngay trên NUC. Hệ quả: NUC gánh tải build (RAM/CPU/ổ cứng — prune ra 1.3GB rác
build cache), GitHub có "cửa" chạy lệnh trên máy nhà (rủi ro bảo mật), và máy
build = máy chạy nên hỏng một là hỏng cả hai. **Bản mới:** build 100% trên
runner GitHub; NUC chỉ pull image — một chiều, sạch, an toàn.

### 5.5. App publish port thẳng ra host
`link-manager-api` cũ publish `0.0.0.0:3001` → ai trong LAN/Tailnet gọi thẳng
API không qua traefik. **Bản mới:** app KHÔNG publish port nào; chỉ traefik với
tới nó qua network `edge`.

### 5.6. Cấu hình traefik vừa file vừa flag — nửa nạc nửa mỡ
Traefik cũ có `traefik.yml` (file) lẫn flags trong compose, hai nơi định nghĩa
chồng nhau (file khai entrypoint web/websecure, flags khai providers…). Khó
biết cái nào đang ăn. **Bản mới:** 100% flags trong compose — một nguồn chân lý.

---

## 6. TỔNG KẾT: CHUỖI SỰ KIỆN DẪN ĐẾN "LỖI KHÔNG RÕ NGUYÊN NHÂN"

Ghép tất cả bằng chứng, câu chuyện gần như chắc chắn đã diễn ra thế này:

1. Hệ thống ban đầu chạy ổn: traefik (Docker đời cũ) + tunnel cũ + record lẻ.
2. **Docker Engine được nâng lên 29** (hoặc máy cài lại) → traefik v3.x ghim
   API 1.24 lập tức **mù Docker** → mọi route chết → web 404. Không có gì
   "crash" nên không lần ra được.
3. Bạn thử gỡ: đổi cấu hình tunnel nhiều lần (6 version ingress), tạo
   tunnel/record mới, cuối cùng **bypass traefik** trỏ thẳng app — chạy tạm được.
4. Trong quá trình thử-sai, DNS record và tunnel-id **lệch nhau** → thêm lỗi
   530 đè lên lỗi 404 — hai lỗi ở hai tầng khác nhau chồng nhau khiến mọi
   chẩn đoán đơn lẻ đều ra kết quả mâu thuẫn ("tunnel connected mà web chết",
   "label đúng mà 404").
5. Việc dọn thư mục (`homelab/traefik` → `homelab/infrastructure/traefik`)
   làm container mồ côi compose project → sửa config không còn tác dụng →
   cảm giác "làm gì cũng không ăn thua".

**Một câu:** *thứ giết hệ thống cũ không phải config sai, mà là một lần nâng cấp
Docker âm thầm + chuỗi chữa cháy sau đó làm DNS/tunnel/file cấu hình lệch pha
nhau ở ba tầng khác nhau.*

---

## 7. BÀI HỌC RÚT RA

1. **Chẩn đoán trước, xoá sau.** Toàn bộ nguyên nhân trên tìm ra bằng lệnh
   chỉ-đọc trước khi gỡ bất cứ thứ gì. Nếu xoá ngay từ đầu, bài học "Docker 29
   vs traefik cũ" sẽ quay lại cắn tiếp ở bản mới (template gốc dùng v3.3 —
   sẽ dính y chang).
2. **"Up" ≠ "khoẻ".** Sau mọi thay đổi hạ tầng, đọc log từng container infra:
   `docker logs traefik|cloudflared|watchtower --tail 30`.
3. **Mỗi lỗi một tầng — debug theo luồng.** DNS → tunnel → traefik → app.
   Xác định request chết ở tầng nào trước khi sửa bất kỳ cái gì
   (bảng debug ở Tài liệu 1 mục 7).
4. **Wildcard hoá những gì có thể.** Một record `*` + một ingress `*` = cả lớp
   lỗi "record lệch tunnel" biến mất vĩnh viễn.
5. **Đường dẫn file compose là danh tính của stack.** Đừng di chuyển thư mục
   chứa compose của container đang chạy.
6. **Secrets vào `.env` + `.gitignore`, không ngoại lệ.** Kể cả "chỉ là máy nhà".
7. **Mount thư mục credential, không mount file lẻ** — `docker login` thay
   inode, bind-mount file sẽ thành ảnh chụp quá khứ.
8. **Ghim version có chủ đích.** `traefik:v3.7` (đủ mới để sống với Docker 29,
   ghim minor để không tự nhảy major). Tag `latest` chỉ dành cho thứ có người
   gác (app do watchtower quản, rollback được bằng tag SHA).
