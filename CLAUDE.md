# MiniServer — Luật chung cho mọi project trong folder này

Mọi project trong `D:\Projects\MiniServer\` được deploy lên NUC `thienminiserver`
theo kiến trúc cố định (dựng 2026-06-07):

```
git push main → GitHub Actions build → ghcr.io/thiengthb/<repo> (:latest + :<sha>)
→ Watchtower trên NUC tự pull (≤60s) → Traefik route → Cloudflare Tunnel → *.thientnse.site
```

Tài liệu đầy đủ: `nuc-platform/01-KIEN-TRUC-VA-VAN-HANH.md` (vận hành),
`02-MO-XE-LOI-HE-THONG-CU.md` (các bẫy đã biết), `03-SETUP-FROM-SCRATCH.md` (dựng lại).
**`nuc-platform/INVENTORY.md` = nguồn sự thật DUY NHẤT** về mọi app/volume/domain/auth/monitor —
đọc nó trước khi đụng vòng đời project; mọi skill thêm/gỡ app PHẢI cập nhật nó (chống drift).
**User báo NUC bị reset / cần tái thiết hệ thống → đọc và làm theo
`nuc-platform/04-AGENT-RUNBOOK-TAI-THIET.md` (runbook dành cho agent).**

## Bất biến — KHÔNG được vi phạm trong bất kỳ project nào

1. **NUC chỉ PULL image.** Không self-hosted runner, không SSH-deploy từ CI,
   không build trên NUC (trừ chữa cháy có chủ đích).
2. **Một network Docker chung `edge`.** Infra (`/opt/infra`) TẠO nó; mọi app
   tham chiếu `external: true`. App KHÔNG publish port ra host — chỉ Traefik
   gọi app qua network.
3. **Public/private = label.** Traefik `exposedbydefault=false`; app public khi
   và chỉ khi có 4 label `traefik.*`. Subdomain mới KHÔNG cần đụng Cloudflare
   (wildcard `*.thientnse.site` đã hứng sẵn).
4. **Secrets chỉ nằm trong `.env`** (chmod 600) + `.env` phải có trong
   `.gitignore`. Không bao giờ hardcode token/key vào compose, Dockerfile, code.
5. **Image tag kép `latest` + git-SHA ngắn.** Rollback = ghim tag SHA trong
   compose trên NUC, không revert git.
6. **TLS do Cloudflare lo.** Không cấu hình Let's Encrypt/certbot ở bất cứ đâu.
7. **Traefik ≥ v3.7, Watchtower phải có `DOCKER_API_VERSION=1.44`** (Docker 29
   trên NUC bỏ API < 1.40 — vi phạm là chết im lặng, xem tài liệu 02).
8. **Xác thực = Authentik** (IdP tại `auth.thientnse.site`, `/opt/apps/authentik`).
   KHÔNG tự code login / hash mật khẩu / ký JWT / mint session trong app. Bảo vệ app =
   forward-auth qua Traefik (middleware `authentik@docker`); phân quyền = app đọc header
   `X-authentik-*`. **KHÔNG bao giờ** gắn forward-auth lên endpoint client máy gọi tự động.
   Authentik là image dựng sẵn — KHÔNG gắn label Watchtower (update thủ công, bump
   `AUTHENTIK_TAG`). Liên kết user qua **email**.

## Quy ước

- Repo GitHub: `thiengthb/<repo>`, nhánh deploy: `main`.
- Mỗi repo phải có: `Dockerfile` (có `EXPOSE <port>` + `HEALTHCHECK` nếu được)
  và `.github/workflows/deploy.yml` (chuẩn: copy từ một ghcr app đang sống — `nuc-monitor` hoặc `todo`).
- Trên NUC: app tại `/opt/apps/<tên>/` gồm `docker-compose.yml` + `.env` +
  `.gitignore`. Compose trong repo (nếu có) CHỈ dùng dev local.
- Dữ liệu app: named volume (vd `<tên>_data`) — không bind-mount, không để trong container.
- SSH NUC: `ssh thien25@thienminiserver` (key đã cài; user thuộc group docker).

## Coding convention — BẮT BUỘC khi viết/sửa code mọi project

Trước khi viết code, scaffold frontend, hay commit ở BẤT KỲ project nào trong folder này,
tuân theo skill **`/coding-convention`** (`.claude/skills/coding-convention/SKILL.md`). Tóm tắt
các luật không thương lượng (chi tiết + checklist trong skill):

- **Git commit = Conventional Commits, tiếng Anh** (`feat(scope): ...`). Chỉ commit/push khi user yêu cầu.
- **Naming:** thư mục & file kebab-case; component React PascalCase named-export với `<Name>Props`;
  hàm/biến camelCase; type/interface PascalCase; hằng & env UPPER_SNAKE; cột DB/field API snake_case.
  Comment tiếng Việt, code tiếng Anh. ESM everywhere, Node ≥ 22.
- **Frontend = skill `/react-ui-craft`** (chuẩn kỹ thuật frontend chung — xem mục riêng ngay bên dưới).
  Stack tham chiếu (đã chạy ở `todo`): Next.js App Router + React 19 + TS + shadcn/ui (style `radix-nova`,
  CSS variables) + Tailwind v4 + **Motion v12** + Inter (sans, có subset vi) + Geist Mono + lucide + sonner +
  next-themes, alias `@/`, helper `cn()`; data = Prisma + server actions, không Express riêng.
- **Giao diện bắt buộc:** chỉ dùng component shadcn/ui (không tự viết thô); dark/light mode dùng CSS
  variables — **không hardcode màu**; responsive mobile-first; toast bằng sonner, icon bằng lucide.
- **React:** function component + hooks (Rules of Hooks, effect đủ dependency + cleanup, `key` ổn định,
  state tối thiểu, đủ loading/error/empty) + quy ước chung (const/===/early-return/async-await, tránh `any`).
- **Format = Prettier** (config chung: `semi:true`, singleQuote, printWidth 100, tabWidth 2, trailingComma all)
  từ `.claude/skills/coding-convention/templates/`. Chạy `prettier --write` trước commit.
- **Mỗi repo cài `commit-msg` hook** từ `.claude/skills/coding-convention/hooks/commit-msg` (ép Conventional
  Commits + mô tả viết thường, tại máy) — cài ở bước khởi tạo repo cho MỌI project (đã cài cho `todo`).

## Frontend — chuẩn kỹ thuật chung BẮT BUỘC khi project có React/Next (skill `/react-ui-craft`)

Mọi project có giao diện **React/Next** trong folder này tuân theo skill **`/react-ui-craft`**
(`.claude/skills/react-ui-craft/` — `SKILL.md` + 5 reference: `architecture` / `components` / `motion` /
`ux` / `security`). Đây là **chuẩn kỹ thuật frontend chung**; nó BỔ TRỢ `/coding-convention` (chia việc rõ:
coding-convention lo naming + commit + Prettier + commit-msg hook; react-ui-craft lo kiến trúc + composition
+ state + motion + UX states + security frontend). Mở việc frontend → đọc `SKILL.md` trước, mở reference khi
cần. Skill này là **engineering** (build sao cho tốt); cảm hứng thị giác thuần (palette/typography/layout)
dùng kèm skill `frontend-design` nếu có.

- **Stack chuẩn:** React 19 (Server Components, Actions, `use`, `useActionState`, `useOptimistic`,
  ref-as-prop — KHÔNG `forwardRef`) + Next.js App Router *hoặc* React+Vite SPA (chốt sớm vì nó định hình
  data layer + security) + Tailwind v4 (token qua `@theme` + OKLCH, KHÔNG `tailwind.config.js` trừ khi
  plugin cần) + shadcn/ui (component bạn SỞ HỮU, theme qua CSS variables) + **Motion v12** (`motion`,
  `import { motion } from "motion/react"`) + TypeScript. Stack khác (CSS Modules, MUI…) → GIỮ NGUYÊN TẮC,
  dịch specifics, KHÔNG ép viết lại.
- **Quy trình 7 bước (đúng thứ tự — bỏ plan là sinh ra component lộn xộn + spacing lệch):** ① khung 1 việc
  của màn + nguồn data → ② plan cấu trúc trước khi code (ranh giới component, server/client) → ③ scaffold
  HỆ THỐNG (token + primitive tái dùng) TRƯỚC màn hình → ④ build bằng composition (component nhỏ, props là
  API, `cn()`) → ⑤ motion CUỐI cùng, có chủ đích → ⑥ xử lý MỌI state (loading/empty/error/optimistic/ideal)
  → ⑦ tự soi theo quality floor + `references/security.md`.
- **Quality floor (ship mặc định, KHÔNG cần ai nhắc):** accessible (semantic HTML, control có nhãn,
  `focus-visible`, contrast ≥4.5:1, `aria-*` khi semantics thiếu) · responsive ≥360px mobile-first ·
  motion-safe (tôn trọng `prefers-reduced-motion` mọi nơi có animation) · type-safe (no `any` ở boundary,
  parse Zod thay vì cast) · performant (chỉ animate `transform`/`opacity`, lazy-load nặng, `LazyMotion` khi
  cần) · secure.
- **Security (đọc `references/security.md` TRƯỚC khi ship):** không secret trong client bundle (chỉ
  `NEXT_PUBLIC_*`/`VITE_*` mới ra client — coi như công khai); không `dangerouslySetInnerHTML` chưa
  sanitize; Server Action/Route Handler PHẢI auth + validate (Zod) phía server (đừng tin client); client
  chỉ nhận DTO tối thiểu; `npm audit` sạch high/critical; không lộ stack trace ở production.
- **Hai thói quen giữ chuẩn cao:** build cái tái dùng MỘT lần (đưa vào vốn component chung, không nhân
  bản — nhất quán đọc ra "có thiết kế"); tự phê bình output như reviewer khó tính trước khi giao.

## Tài liệu & tri thức — BẮT BUỘC cho mọi project (Knowledge OS)

Chuẩn đầy đủ: **`nuc-platform/05-TAI-LIEU-CHUAN.md`** (đọc khi đụng tài liệu). Mục đích: agent **hiểu một
project trong 1 lần đọc rẻ tiền**, và tri thức non-obvious **tích lũy qua các session** thay vì tan biến.

- **Đường nạp context — 3 nấc (bất biến):** `INVENTORY §0` (index) → `<project>/docs/00-map.md` (AI-primer
  1 trang, LUÔN đọc đầu khi vào project) → `docs/` sâu + `docs/decisions.md` (chỉ khi task cần). `CLAUDE.md`
  mỗi project giữ **thin** (rule + bất biến + con trỏ) — KHÔNG nhồi module map/luồng/spec vào (tốn context
  vì auto-nạp mỗi turn); spec dày để ở `docs/`.
- **Hai trụ cột mọi project đều có:** `docs/00-map.md` (bản chất · module map · luồng · điểm sáng · bất
  biến · secrets) + `docs/decisions.md` (sổ tri thức: quyết định + bẫy + **vì sao**, append-only). web-app
  thêm bộ `01-product`/`02-technical`/`03-user-guide` (tiered theo `kind` — xem 05 §3).
- **Skill:** **`/project-docs`** sinh/đồng bộ doc-set (scaffold + audit drift) · **`/session-wrap`** chốt
  phiên → ghi `decisions.md`, cập nhật `00-map`, thêm dòng `06-SO-TRI-THUC.md` nếu xuyên project. Bài học
  **xuyên project** → index `nuc-platform/06-SO-TRI-THUC.md`; bẫy **hạ tầng** → `02-MO-XE-LOI`.
- **Quy ước:** cuối một đợt sửa đáng kể → chạy `/session-wrap`; quyết định non-obvious → `decisions.md`
  (đi cùng commit code). Pre-commit hook nhắc (non-blocking) khi code đổi mà docs không đụng.

## Khi tạo project mới / đưa project lên NUC

Dùng skill **`/nuc-new-project`** — nó chạy đúng quy trình: hỏi thông tin →
Dockerfile → workflow → push & xác minh image → tạo `/opt/apps/<tên>` → nghiệm thu.
Không tự chế quy trình khác.

## Khi gỡ / khai tử một project

Dùng skill **`/nuc-remove-project`** — quy trình ngược của `nuc-new-project`: xóa code local →
hạ container + volume + image + dir trên NUC → dọn Authentik (nếu có provider/group riêng) →
xác minh subdomain 404 → cập nhật `INVENTORY.md` + `auth-apps.md` → hướng dẫn user xóa GitHub
repo + ghcr. An toàn là trên hết: xác nhận mất dữ liệu + không ảnh hưởng service khác trước khi hạ.

## Khi soát sức khỏe / dọn dẹp hệ thống

Dùng skill **`/nuc-health-audit`** — đối chiếu `INVENTORY.md` với thực tế, bắt drift + orphan
(volume mồ côi, dangling image, provider Authentik treo), kiểm mọi subdomain còn sống, Watchtower,
đĩa/RAM, vệ sinh secret. Chỉ đọc & báo cáo; mọi thao tác phá hủy (xóa volume/image) phải hỏi user.

## Khi cần bảo vệ app (đăng nhập / SSO / phân quyền)

Dùng skill **`/nuc-protect-app`** — login gate (forward-auth), giới hạn ai được vào (group
policy), hoặc phân quyền trong app (header `X-authentik-groups`). Registry mọi provider/app
+ các bẫy đã biết: repo `authentik/` (đặc biệt `authentik/docs/auth-apps.md`). Phân quyền in-app =
đọc header `X-authentik-*` qua `headers()` trong Next.js (chưa có mẫu sống — app đầu tiên làm sẽ
thành mẫu). Không tự chế cơ chế auth khác.

## Khi web lỗi

Debug theo tầng DNS → tunnel → traefik → app, dùng bảng triệu chứng trong
`nuc-platform/01-KIEN-TRUC-VA-VAN-HANH.md` mục 7. Không sửa mò khi chưa xác
định request chết ở tầng nào.
