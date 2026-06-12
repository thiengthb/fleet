---
name: coding-convention
description: Coding convention bắt buộc cho mọi project trong MiniServer — quy ước đặt tên (naming), git commit/push theo Conventional Commits (tiếng Anh), và stack + giao diện frontend bắt buộc (Next.js 16 App Router + React 19 + TS + shadcn radix-nova + Tailwind v4 + Inter/Geist Mono + lucide + sonner + dark/light, Prisma + server actions). Dùng khi tạo/sửa code bất kỳ project nào, scaffold frontend mới, review trước khi commit, hoặc khi user hỏi "code đúng convention chưa".
---

# Skill: Coding Convention của MiniServer

Đây là LUẬT khi viết code trong bất kỳ project nào dưới `D:\Projects\MiniServer\`.
Áp dụng cùng lúc với các bất biến hạ tầng trong `CLAUDE.md` (deploy/NUC) — skill này
lo phần **code & giao diện**, không lo phần deploy.

Mẫu sống cho mọi quy ước dưới đây là repo **`todo`** (Next.js 16 full-stack — `D:\Projects\MiniServer\todo`).
Khi phân vân "viết thế nào", mở file tương ứng trong `todo` ra xem, đừng chế mới.
(Repo `link-manager` — mẫu cũ kiểu Vite+Express — đã khai tử 2026-06-11; mọi tham chiếu nay trỏ `todo`.)

Nếu user yêu cầu mâu thuẫn với một mục BẮT BUỘC bên dưới → chỉ ra mâu thuẫn và hỏi lại
trước khi làm. Đừng âm thầm phá luật.

---

## 1. Git — commit & push

**Commit message = Conventional Commits, viết bằng TIẾNG ANH.**

```
<type>(<scope>): <mô tả ngắn, thể mệnh lệnh, không chấm cuối>

[body tuỳ chọn: giải thích WHY, không phải WHAT]
```

- `type` ∈ `feat | fix | refactor | chore | docs | test | perf | style | build | ci`.
- `scope` = tên module/khu vực (`auth`, `api`, `ui`, `deps`, `docker`…). Bỏ được nếu chung chung.
- Mô tả tiếng Anh, viết thường, ≤ ~72 ký tự, không chấm cuối.
- Body (nếu cần) giải thích **lý do**, không liệt kê lại diff.

Ví dụ đúng:
```
feat(auth): add Authentik login via forward-auth
fix(api): handle empty tag returning 500
chore(deps): bump next to 16
refactor(ui): extract link-card into its own component
```

Quy tắc thao tác git (nhắc lại từ harness, đừng quên):
- KHÔNG commit/push nếu user chưa yêu cầu.
- Đang ở nhánh mặc định (`main`) mà cần thay đổi lớn → tạo nhánh trước.
- KHÔNG `--no-verify`, KHÔNG skip hook/sign trừ khi user yêu cầu rõ.
- Một commit = một ý thay đổi mạch lạc; đừng gộp nhiều việc không liên quan.

---

## 2. Naming convention (toàn stack)

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Thư mục | kebab-case | `nuc-monitor/`, `components/ui/` |
| File component React | kebab-case `.tsx` | `link-card.tsx`, `theme-toggle.tsx` |
| File lib/util/logic | kebab/lowercase `.ts` | `api.ts`, `auth.ts`, `utils.ts` |
| Component React | PascalCase, **named export** | `export function LinkCard(...)` |
| Props interface | `<Component>Props`, khai báo NGAY TRÊN component | `interface LinkCardProps { … }` |
| Hàm / biến | camelCase | `faviconUrl`, `getAccessToken` |
| Type / interface | PascalCase | `LinkItem`, `StatsGranularity` |
| Hằng cấu hình module-level | UPPER_SNAKE_CASE | `BASE_URL`, `PORT`, `API_KEY` |
| Cột DB & field JSON của API | snake_case | `created_at`, `last_visited_at` |
| Biến env | UPPER_SNAKE_CASE | `VITE_API_URL`, `CORS_ORIGIN` |

- Comment trong code viết **tiếng Việt**, dùng JSDoc `/** … */` cho field/hàm không hiển nhiên
  (xem `todo/lib/types.ts` làm mẫu). Code (tên hàm/biến) thì tiếng Anh.
- Đặt tên theo ý nghĩa, không viết tắt khó hiểu. Khớp giọng văn & mật độ comment của file xung quanh.

---

## 3. JavaScript / TypeScript

- **ESM everywhere**: `"type": "module"`, `import`/`export`, không `require`. Node ≥ 22.
  Code chạy server (route handler, server action, `lib/*`) dùng prefix `node:` cho built-in (`import fs from 'node:fs'`).
- **TypeScript là bắt buộc.** Không `any` tuỳ tiện — khai báo interface/type trong `lib/types.ts` (xem `todo/lib/types.ts`).
- Format do **Prettier** quyết định, KHÔNG cãi tay: dấu nháy đơn `'…'`, **có dấu chấm phẩy** (`semi: true`),
  `printWidth 100`, `tabWidth 2`, `trailingComma: all`. Config chung ở mục 8. Chạy `prettier --write` trước commit.
- App phải `npm run lint` (eslint-config-next: core-web-vitals + typescript) sạch và `npm run build`
  (`next build`) pass trước khi coi là xong.
- Secrets KHÔNG hardcode — đọc qua `process.env` / `import.meta.env` (nhắc lại bất biến #4 của platform).

---

## 4. Frontend — STACK BẮT BUỘC (y hệt `todo`)

Mọi app mới scaffold giống `todo`. KHÔNG thay framework, UI lib, style, font.

| Thành phần | Bắt buộc dùng |
|---|---|
| Framework | **Next.js 16 (App Router, RSC)** + **React 19** + **TypeScript** |
| Build/run | `next build` / `next start`; `output: 'standalone'` trong `next.config.ts` (để Docker image nhỏ) |
| UI components | **shadcn/ui**, style `radix-nova`, base color `neutral`, CSS variables (`components.json`, `rsc: true`) |
| CSS | **Tailwind v4** (`@tailwindcss/postcss`, `@import "tailwindcss"` trong `app/globals.css`), theme bằng CSS variables |
| Font | **Inter** (`next/font/google`, subset `["latin","vietnamese"]`) cho `--font-sans` + **Geist Mono** cho mono. Lý do: Geist trên Google Fonts KHÔNG có subset tiếng Việt → dùng Inter cho sans |
| Icon | **lucide-react** — KHÔNG dùng bộ icon khác |
| Toast | **sonner** (`<Toaster position="bottom-center" />`, `@/components/ui/sonner`) — KHÔNG `alert()` / lib toast khác |
| Theme | **next-themes** — `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` |
| Data | **Server Actions** (`app/actions.ts`) + **Prisma** (`lib/db.ts`) cho mutation/query; **Route Handlers** (`app/api/<x>/route.ts`) cho endpoint máy/HTTP. KHÔNG dựng Express riêng. |
| Alias | `@/` → root cho mọi import nội bộ (`@/components`, `@/lib/...`, `@/components/ui`) |
| Helper class | `cn()` từ `@/lib/utils` (clsx + tailwind-merge) để gộp className |

Khởi tạo nhanh app mới: copy cấu trúc từ `todo`
(`components.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`,
`lib/utils.ts`, `app/globals.css`, `app/layout.tsx`), rồi `npx shadcn@latest add <component>` để thêm UI.

---

## 5. Frontend — QUY TẮC GIAO DIỆN (bắt buộc, không thương lượng)

1. **Chỉ dùng component shadcn/ui.** Không tự viết `<button>`/`<input>`/dialog thô.
   Cần component chưa có → `npx shadcn@latest add …` rồi extend, đặt trong `components/ui/`.
   Component nghiệp vụ (compose từ ui) đặt ở `components/<tên>.tsx`.

2. **Bắt buộc dark/light mode.** Mọi app có theme toggle (mẫu: `theme-toggle.tsx`).
   Màu LẤY TỪ CSS variables của shadcn (`bg-background`, `text-foreground`, `text-muted-foreground`,
   `border`, `bg-card`…). **KHÔNG hardcode màu** kiểu `bg-white`, `text-black`, `#fff`, `bg-gray-900`
   — sẽ vỡ ở theme còn lại.

3. **Responsive, mobile-first.** Viết base style cho mobile trước, nâng cấp bằng `sm: md: lg:`.
   Mọi màn hình phải dùng tốt trên điện thoại; layout co giãn, không tràn ngang.

4. **Toast = sonner, icon = lucide.** Phản hồi hành động (lưu/xoá/lỗi) qua `toast()` của sonner,
   không `alert()`/`confirm()` thô. Icon chỉ lấy từ `lucide-react`.

5. **A11y & UX cơ bản:** nút có label/aria khi chỉ có icon; dùng `<TooltipProvider>` cho tooltip;
   trạng thái loading/empty/error phải có UI rõ ràng, không để màn hình trắng.

Mẫu `app/layout.tsx` chuẩn (ThemeProvider → TooltipProvider → AppShell → children, rồi `<Toaster>`)
— giữ đúng thứ tự này; xem `todo/app/layout.tsx`.

---

## 6. React best practices (bắt buộc)

Áp dụng cho mọi component. Mẫu sống: `todo/components/*`.

**Server vs Client Component (Next.js App Router)**
- Mặc định là **Server Component** (chạy trên server, fetch/Prisma trực tiếp, không gửi JS xuống client).
  Chỉ thêm `'use client'` ở ĐẦU file khi component cần state/effect/event handler/hook trình duyệt.
- Đẩy ranh giới `'use client'` xuống càng sâu càng tốt (lá, không phải gốc) để giữ bundle nhỏ.
  Data lấy ở Server Component rồi truyền primitive xuống Client Component.

**Component & structure**
- Function component + hooks. KHÔNG class component. Một file = một component nghiệp vụ chính
  (named export); component con nhỏ có thể ở cùng file.
- Component thuần trình bày tách khỏi logic; logic client tái dùng → custom hook `use*` (đặt trong `hooks/`).
- Props khai báo qua interface `<Component>Props`; destructure trong tham số. Truyền primitive/handler,
  hạn chế truyền object lớn xuyên nhiều tầng — cần thì dùng Context.
- File JSX/component giữ ngắn; > ~250 dòng là dấu hiệu nên tách.

**Hooks**
- Tuân thủ Rules of Hooks: chỉ gọi ở top level, không trong vòng lặp/điều kiện. Bật rule
  `eslint-plugin-react-hooks` (đã có trong config) và để nó sạch.
- `useEffect` phải khai báo ĐỦ dependency. Effect chỉ dùng cho side-effect (fetch, subscribe, DOM);
  cái gì tính được từ props/state thì tính trực tiếp khi render, ĐỪNG nhồi vào effect + state.
- Cleanup mọi subscription/timer/listener/AbortController trong return của effect.
- `useMemo`/`useCallback` chỉ khi đo được lợi (list lớn, ref ổn định cho child memo hoá) —
  không bọc bừa.

**State & data**
- State tối thiểu, đặt gần nơi dùng; nâng lên (lift) chỉ khi cần chia sẻ. Không nhân bản dữ liệu
  đã có (derived state) thành state riêng.
- `key` trong list = id ổn định, KHÔNG dùng index khi list có thể đổi thứ tự/thêm/xoá.
- Cập nhật state dạng immutable (spread, map…), không mutate trực tiếp.
- Lấy dữ liệu ưu tiên ở **Server Component** (gọi Prisma qua `lib/db.ts`) hoặc **Server Action**
  (`app/actions.ts`); chỉ fetch phía client khi thật sự cần (realtime, sau tương tác). Logic nghiệp vụ
  để trong `lib/*`, không nhồi vào component.
- Client fetch: quản lý đủ 3 trạng thái loading / error / empty; hiển thị UI cho từng trạng thái (mục 5.5).

**Render & a11y**
- Không tạo component/hàm mới bên trong render path gây remount; định nghĩa ngoài hoặc useCallback.
- Dùng HTML ngữ nghĩa (`<button>`, `<nav>`, `<main>`…); tương tác được bằng bàn phím.
- Không `dangerouslySetInnerHTML` với dữ liệu chưa sanitize.

## 7. Quy ước chung từ các style guide lớn (Airbnb / Google / TS / React)

Chắt lọc những điều phù hợp stack này — coi như mặc định, lệch thì phải có lý do:

- **`const` mặc định, `let` khi cần gán lại, không `var`.** Không gán lại tham số hàm.
- **`===`/`!==`** luôn dùng (trừ `== null` để bắt cả `null` và `undefined` có chủ đích).
- **Early return** thay vì lồng `if` sâu; tránh else sau return. Tránh nesting > 3 tầng.
- **Hàm nhỏ, một nhiệm vụ.** Đặt tên động từ cho hàm (`fetchLinks`, `formatDate`), danh từ cho dữ liệu.
- **Boolean** đặt tên `is/has/should/can` (`isLoading`, `hasError`).
- **Async/await** thay chuỗi `.then()` dài; luôn `try/catch` quanh await có thể lỗi.
- **TS:** ưu tiên `interface` cho shape object, `type` cho union/alias; tránh `any` (dùng `unknown` rồi
  thu hẹp); bật strict (đã có trong `tsconfig`); export type rõ ràng.
- **Import order:** built-in/node → thư viện ngoài → alias nội bộ `@/…` → tương đối `./…`. Không import vòng.
- **Không dead code / `console.log` sót** trong code commit (log có chủ đích thì ok ở backend).
- **Magic number/string** lặp lại → tách hằng đặt tên.
- **Comment giải thích WHY, không WHAT;** xoá code chết thay vì comment lại.

## 8. Setup mỗi repo: Prettier + commit-msg hook

Mọi repo dùng CHUNG một bộ config (nguồn chuẩn trong skill này), không tự chế khác.

**Prettier — format thống nhất mọi repo.** Config: `semi: true`, `singleQuote: true`,
`printWidth: 100`, `tabWidth: 2`, `trailingComma: 'all'`, `arrowParens: 'always'`, `endOfLine: 'lf'`.

```sh
# 1. Copy config + ignore vào ROOT của repo (và mỗi package con frontend/backend nếu tách riêng):
cp ".claude/skills/coding-convention/templates/.prettierrc"     "<repo>/.prettierrc"
cp ".claude/skills/coding-convention/templates/.prettierignore" "<repo>/.prettierignore"
# 2. Cài & thêm script (trong từng package có package.json):
npm i -D prettier
#    package.json scripts: "format": "prettier --write .",  "format:check": "prettier --check ."
```

- Chạy `npm run format` (hoặc `prettier --write`) trước khi commit. CI/lint nên dùng `format:check`.
- ESLint lo logic/bug, Prettier lo style — không bật rule format trong ESLint để khỏi đá nhau.

**Git commit-msg hook — ép Conventional Commits ngay tại máy.** Nguồn:
`.claude/skills/coding-convention/hooks/commit-msg`. Cài sau khi `git init`/clone:

```sh
cp ".claude/skills/coding-convention/hooks/commit-msg" "<repo>/.git/hooks/commit-msg"
cp ".claude/skills/coding-convention/hooks/pre-commit" "<repo>/.git/hooks/pre-commit"
# Git for Windows chạy hook qua sh nên không cần chmod; trên Unix thêm: chmod +x ...
```

- **`commit-msg`** chặn: sai cấu trúc `type(scope): desc`, tiêu đề kết thúc bằng `.`, và **chữ đầu mô tả
  viết hoa** (buộc viết thường, thể mệnh lệnh — trừ acronym toàn hoa như API/JWT/SSO). Bỏ qua merge/revert/fixup.
- **`pre-commit`** (non-blocking) nhắc khi commit đụng CODE mà không đụng `docs/` → cân nhắc cập nhật
  `docs/00-map.md` / `docs/decisions.md` (chuẩn tài liệu: `nuc-platform/05-TAI-LIEU-CHUAN.md`). KHÔNG chặn.

Khi scaffold project mới (skill `/nuc-new-project`), cài CẢ Prettier config lẫn 2 hook ở bước khởi tạo repo.

**Document-as-you-code:** khi quyết định điều **non-obvious** (chọn kiến trúc, né một bẫy, đánh đổi) →
ghi 1 mục vào `<project>/docs/decisions.md` (khung ở `05-TAI-LIEU-CHUAN.md §5`), đi cùng commit code.
Cuối một đợt sửa đáng kể → chạy `/session-wrap` để chốt tri thức + đồng bộ `docs/00-map.md`.

## 9. Backend (Next.js — Route Handlers + Server Actions, KHÔNG Express riêng)

- Logic server nằm trong Next.js: **Server Action** (`app/actions.ts`) cho mutation từ UI;
  **Route Handler** (`app/api/<x>/route.ts`) cho endpoint HTTP/máy. Cấu hình qua `process.env.X || '<fallback>'`.
- **DB qua Prisma** (`lib/db.ts` export 1 instance `prisma` dùng chung — tránh tạo nhiều client khi hot-reload).
  Schema ở `prisma/schema.prisma`. Dữ liệu persist qua named volume; đường dẫn DB/file đọc từ env (`DATABASE_URL`…), không hardcode path tuyệt đối.
- Endpoint health `app/api/health/route.ts` luôn mở (cho Docker HEALTHCHECK + CI) — đừng gắn auth lên nó.
- Auth theo platform: forward-auth qua Authentik (gác ở Traefik) > đọc header `X-authentik-*` trong app để phân
  quyền > API token cho endpoint máy. KHÔNG tự code login (xem bất biến #8 trong `CLAUDE.md`).
- ⛔ Endpoint client MÁY gọi tự động (MCP/OAuth/webhook) KHÔNG được sau forward-auth — tách router riêng, auth ở
  tầng app (mẫu sống: `todo/app/api/[transport]` + `app/api/oauth/*`, bearer/OAuth tự quản; xem `auth-apps.md`).

---

## 10. Checklist trước khi báo "xong" / trước khi commit

- [ ] Tên file/biến/type/commit đúng mục 1–2; quy ước chung mục 7 (const, ===, early return, async/await…).
- [ ] Frontend: đúng stack mục 4, đủ 5 quy tắc giao diện mục 5 (đặc biệt: không hardcode màu, có dark/light, responsive).
- [ ] React đúng mục 6: hooks sạch (dependency đủ, cleanup), `key` ổn định, state tối thiểu, đủ loading/error/empty.
- [ ] `prettier --write` đã chạy; `npm run lint` và `npm run build` của frontend pass (nếu có sửa frontend).
- [ ] Không hardcode secret; không `console.log`/dead code sót; comment tiếng Việt cho chỗ không hiển nhiên.
- [ ] Repo đã có Prettier config + commit-msg + pre-commit hook (mục 8). Commit Conventional Commits tiếng Anh (mô tả viết thường); chỉ commit/push khi user yêu cầu.
- [ ] Tài liệu theo kịp code: quyết định non-obvious đã ghi `docs/decisions.md`; module map/luồng đổi → `docs/00-map.md` cập nhật (chuẩn: `05-TAI-LIEU-CHUAN.md`; cuối đợt sửa lớn → `/session-wrap`).
