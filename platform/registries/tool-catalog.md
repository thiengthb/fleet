# Danh mục công cụ của agent — 32 công cụ

> **SINH TỰ ĐỘNG** bởi `node .claude/scripts/tool-catalog.mjs --write`. **Đừng sửa tay** — lần sinh sau ghi đè.
> Muốn đổi phần chữ tiếng Việt: sửa dòng `@vi WHAT/WHEN/WHY` **ngay trong file công cụ đó**, rồi sinh lại.
> Phần "nổ khi nào" và "chặn được" **không phải chữ ai viết** — máy đọc thẳng từ `.claude/settings.json`
> và từ chính mã nguồn, nên nó không thể nói sai về thực tế.

Ba loại, phân biệt bằng **ai gọi nó**: hook thì tự chạy không cần anh làm gì; script thì anh (hoặc tôi) gõ lệnh;
thư viện thì không tự chạy, chỉ được các file khác dùng lại.

| Loại | Số lượng | Ai gọi |
| --- | --- | --- |
| Hook | 13 | tự động, theo sự kiện |
| Script | 17 | anh tự gọi khi cần |
| Thư viện | 2 | các file khác import |

## 1. Hook — tự chạy, anh không phải gọi

| Công cụ | Nổ khi nào | Nó làm gì | Quyền | Test |
| --- | --- | --- | --- | --- |
| [`autonomy-gate.mjs`](#autonomy-gatemjs) | TRƯỚC mỗi lệnh Bash hoặc mỗi lần ghi file | Khi phiên chạy mà không có người ngồi trước máy, nó CHẶN mọi hành động khó thu hồi: push lên main, deploy, xoá dữ liệu, cài thêm thư viện, mở PR, ssh — và chặn cả việc agent tự sửa luật của chính nó. | **CHẶN được** | ✓ |
| [`compact-recap.mjs`](#compact-recapmjs) | đầu mỗi phiên làm việc | Ngay sau mỗi lần nén ngữ cảnh (compact), nó nói lại cho tôi trạng thái thật của cây làm việc: đang ở nhánh nào, còn bao nhiêu file sửa chưa commit, kế hoạch nào đang mở, và phiên này đã ghi lại tri thức chưa. | chỉ nhắc | ✓ |
| [`git-sync-check.mjs`](#git-sync-checkmjs) | đầu mỗi phiên làm việc | Đầu phiên, nó tự fetch mọi repo trong fleet rồi báo: repo nào đang cũ hơn bản trên mạng, repo nào có việc chưa push, repo nào đang dở dang. | chỉ nhắc | ✓ |
| [`guide-coverage-reminder.mjs`](#guide-coverage-remindermjs) | TRƯỚC mỗi lần ghi/sửa file | Lần đầu trong phiên mà tôi sửa một trang giao diện hoặc danh mục MCP của sakubun, nó chặn lại một nhịp để nhắc: thêm màn hình mới thì phải cập nhật trang /guide trong cùng lần sửa đó. | **CHẶN được** | ✓ |
| [`harness-drift-check.mjs`](#harness-drift-checkmjs) | đầu mỗi phiên làm việc | Khi Claude Code lên phiên bản mới, nó hỏi MỘT câu duy nhất: bản mới có vừa ra tính năng nào mà mình đã tự làm tay không? | chỉ nhắc | ✓ |
| [`invariant-warn.mjs`](#invariant-warnmjs) | NGAY SAU mỗi lần ghi/sửa file | Sau mỗi lần ghi file, nó đọc lại file và nhắc (không chặn) nếu thấy chạm vào ba bất biến của NUC: tự xin chứng chỉ SSL, dùng runner tự dựng trong CI, hoặc mở cổng ra host trong compose của một app. | góp ý (không chặn) | ✓ |
| [`legibility-lint.mjs`](#legibility-lintmjs) | TRƯỚC mỗi lần tôi hỏi anh một câu có lựa chọn · khi tôi kết thúc một lượt trả lời | Nó kiểm chính cách tôi nói với anh: danh sách lựa chọn phải có cái được khuyến nghị, và thuật ngữ phải có một câu giải thích thường ngày đi kèm. | **CHẶN được** | ✓ |
| [`memory-wiring-check.mjs`](#memory-wiring-checkmjs) | đầu mỗi phiên làm việc | Đầu phiên, nó kiểm tôi có thật sự nạp được ký ức về anh không: đường dẫn ký ức có trỏ đúng, MEMORY.md có nằm trong giới hạn nạp, có file ký ức nào chưa được ghi vào mục lục. | chỉ nhắc | ✓ |
| [`plan-checkin.mjs`](#plan-checkinmjs) | đầu mỗi phiên làm việc | Đầu phiên, nó xem mọi kế hoạch trong repo và nhắc: cái nào đã đến ngày hẹn xem lại, cái nào đang mở mà 10 ngày không ai chạm, cái nào ghi ngày hẹn nhưng thiếu phần việc-cần-làm-hôm-đó. | chỉ nhắc | ✓ |
| [`prettier-on-edit.mjs`](#prettier-on-editmjs) | NGAY SAU mỗi lần ghi/sửa file | Sau mỗi lần ghi file, nó chạy prettier CỦA CHÍNH project đó để định dạng lại file vừa ghi. Không tìm thấy prettier gần đó thì im lặng bỏ qua. | **SỬA lại file vừa ghi** | ✓ |
| [`reuse-guard.mjs`](#reuse-guardmjs) | TRƯỚC mỗi lần ghi/sửa file | Khi tôi tạo một file mới mà tên trùng với thứ commons đã có sẵn, nó chặn lần đầu và nói nên `shadcn add` cái nào. Lần thứ hai thì cho qua. | **CHẶN được** | ✓ |
| [`secret-guard.mjs`](#secret-guardmjs) | TRƯỚC mỗi lần ghi/sửa file | Nó CHẶN việc viết một khoá hay token thật vào bất cứ file nào không phải .env. | **CHẶN được** | ✓ |
| [`suggest-session-wrap.mjs`](#suggest-session-wrapmjs) | khi tôi kết thúc một lượt trả lời | Khi tôi kết thúc một lượt trả lời, nếu phiên này đã làm nhiều việc mà chưa ghi lại gì, nó nhắc một lần duy nhất: nên chạy /session-wrap. | chỉ nhắc | ✓ |

## 2. Script — anh tự gọi khi cần

| Công cụ | Khi nào anh cần nó | Lệnh | Cắm làm hook? | Test |
| --- | --- | --- | --- | --- |
| [`attic.mjs`](#atticmjs) | Khi định bỏ một skill, script hay tài liệu mà chưa chắc chắn. | `node .claude/scripts/attic.mjs` | không | ✓ |
| [`decisions-split.mjs`](#decisions-splitmjs) | Khi một file decisions.md quá lớn — health-sweep hoặc memory-audit sẽ báo trước. | `node .claude/scripts/decisions-split.mjs` | không | ✓ |
| [`eval-ledger-rule.mjs`](#eval-ledger-rulemjs) | Hầu như không chạy lại — nó tốn tiền thật và kết quả đã được ghi lại. | `node .claude/scripts/eval-ledger-rule.mjs` | không | ✗ |
| [`health-sweep.mjs`](#health-sweepmjs) | Mỗi tuần một lần. Chỉ cần đọc dòng VERDICT. | `node .claude/scripts/health-sweep.mjs` | không | ✓ |
| [`ledger-split.mjs`](#ledger-splitmjs) | Khi mục lục phình ra — memory-audit sẽ báo. | `node .claude/scripts/ledger-split.mjs` | không | ✓ |
| [`link-check.mjs`](#link-checkmjs) | Tự động trong health-sweep hằng tuần. | `node .claude/scripts/link-check.mjs` | không | ✓ |
| [`memory-audit.mjs`](#memory-auditmjs) | Khi nghi ký ức đang phình hoặc trùng lặp; và tự động trong health-sweep. | `node .claude/scripts/memory-audit.mjs` | không | ✓ |
| [`plan-audit.mjs`](#plan-auditmjs) | Nó vừa TỰ CHẠY mỗi lần ghi một file kế hoạch, vừa chạy tay được để soát cả repo một lượt. | `node .claude/scripts/plan-audit.mjs` | NGAY SAU mỗi lần ghi/sửa file | ✓ |
| [`platform-report.mjs`](#platform-reportmjs) | Mỗi tháng một lần — kế hoạch standing-cadence sẽ nhắc đúng ngày. | `node .claude/scripts/platform-report.mjs` | không | ✓ |
| [`recurrence-check.mjs`](#recurrence-checkmjs) | Tự động trong health-sweep; và trước khi đóng một phiên vừa ghi thêm bài học mới. | `node .claude/scripts/recurrence-check.mjs` | không | ✓ |
| [`reuse-scan.mjs`](#reuse-scanmjs) | Trước khi xây một tính năng mới; và tự động trong health-sweep. | `node .claude/scripts/reuse-scan.mjs` | không | ✓ |
| [`rule-classify.mjs`](#rule-classifymjs) | Nó đã trả lời xong câu hỏi của nó. Chạy lại chỉ để xác nhận con số cũ còn đúng. | `node .claude/scripts/rule-classify.mjs` | không | ✓ |
| [`skill-audit.mjs`](#skill-auditmjs) | Khi số skill phình lên, hoặc khi nghi có skill đã chết. | `node .claude/scripts/skill-audit.mjs` | không | ✓ |
| [`sprawl-check.mjs`](#sprawl-checkmjs) | Trước khi định thêm một skill/script/hook/tài liệu mới. Và tự động hằng tuần trong health-sweep. | `node .claude/scripts/sprawl-check.mjs` | không | ✓ |
| [`tool-catalog.mjs`](#tool-catalogmjs) | Sau khi thêm/xoá/sửa một hook hay script, chạy `--write` để cập nhật trang. Muốn kiểm trang còn khớp với thực tế không thì `--check` (health-sweep gọi cái này). | `node .claude/scripts/tool-catalog.mjs` | không | ✓ |
| [`tool-check.mjs`](#tool-checkmjs) | Sau khi thêm hoặc sửa một hook/script. | `node .claude/scripts/tool-check.mjs` | không | ✓ |
| [`usage-census.mjs`](#usage-censusmjs) | Trước khi quyết định bỏ bất cứ thứ gì. | `node .claude/scripts/usage-census.mjs` | không | ✓ |

## 3. Thư viện dùng chung — không tự chạy

| File | Nó giữ cái gì | Test |
| --- | --- | --- |
| [`_layout.mjs`](#_layoutmjs) | Nơi DUY NHẤT biết các project nằm ở đâu trong repo này. Các hook và script khác hỏi nó thay vì tự đoán. | ✓ |
| [`_util.mjs`](#_utilmjs) | Bộ hàm dùng chung của các hook: đọc dữ liệu Claude Code gửi vào, và ghi lại mỗi lần một hook chạy. | ✓ |

## 4. Chi tiết từng công cụ

Mỗi mục dưới đây: nổ khi nào · nó làm gì · vì sao nó tồn tại · chạy tay thế nào · file test ở đâu. Phần giải
thích dài bằng tiếng Anh (kèm số đo và ngày tháng) nằm ở đầu chính file đó.

### autonomy-gate.mjs

`.claude/hooks/autonomy-gate.mjs` · hook · test: `autonomy-gate.test.mjs`

**Nổ khi nào:** TRƯỚC mỗi lệnh Bash hoặc mỗi lần ghi file

**Quyền:** **CHẶN được**

**Nó làm gì:** Khi phiên chạy mà không có người ngồi trước máy, nó CHẶN mọi hành động khó thu hồi: push lên main, deploy, xoá dữ liệu, cài thêm thư viện, mở PR, ssh — và chặn cả việc agent tự sửa luật của chính nó.

**Vì sao có nó:** Đây là cái gác DUY NHẤT cho phiên tự chạy. Riêng khoản "không cho agent sửa luật của chính nó" là bài học từ lỗ bảo mật CVE-2025-53773: một agent sửa được file luật của nó thì mọi luật còn lại thành vô nghĩa. Nó fail-closed — không đọc được dữ liệu vào thì coi như chặn, vì một cái gác không đọc được thì cũng không kiểm được.

### compact-recap.mjs

`.claude/hooks/compact-recap.mjs` · hook · test: `compact-recap.test.mjs`

**Nổ khi nào:** đầu mỗi phiên làm việc

**Quyền:** chỉ nhắc

**Nó làm gì:** Ngay sau mỗi lần nén ngữ cảnh (compact), nó nói lại cho tôi trạng thái thật của cây làm việc: đang ở nhánh nào, còn bao nhiêu file sửa chưa commit, kế hoạch nào đang mở, và phiên này đã ghi lại tri thức chưa.

**Vì sao có nó:** Nén ngữ cảnh là lúc tôi mất chi tiết và chỉ còn bản tóm tắt — đúng lúc dễ quên rằng còn việc chưa commit hoặc đang làm dở theo một kế hoạch nào. Bốn hook đầu-phiên hiện có đều CỐ Ý bỏ qua lần khởi động do nén, nên trước đây khoảnh khắc đó hoàn toàn im lặng. Nó không mang thông tin mới — mọi thứ đều tra lại được — nó mang thông tin ĐÚNG LÚC, và chỉ lên tiếng với anh khi có việc chưa được ghi lại.

### git-sync-check.mjs

`.claude/hooks/git-sync-check.mjs` · hook · test: `git-sync-check.test.mjs`

**Nổ khi nào:** đầu mỗi phiên làm việc

**Quyền:** chỉ nhắc

**Nó làm gì:** Đầu phiên, nó tự fetch mọi repo trong fleet rồi báo: repo nào đang cũ hơn bản trên mạng, repo nào có việc chưa push, repo nào đang dở dang.

**Vì sao có nó:** Anh làm trên nhiều máy. Không có nó thì rất dễ sửa lại một thứ đã sửa xong ở máy khác, hoặc để quên việc chưa push ở máy này. Im lặng hoàn toàn khi mọi thứ đã đồng bộ và sạch.

### guide-coverage-reminder.mjs

`.claude/hooks/guide-coverage-reminder.mjs` · hook · test: `guide-coverage-reminder.test.mjs`

**Nổ khi nào:** TRƯỚC mỗi lần ghi/sửa file

**Quyền:** **CHẶN được**

**Nó làm gì:** Lần đầu trong phiên mà tôi sửa một trang giao diện hoặc danh mục MCP của sakubun, nó chặn lại một nhịp để nhắc: thêm màn hình mới thì phải cập nhật trang /guide trong cùng lần sửa đó.

**Vì sao có nó:** Anh chọn phương án nghiêm nhất (2026-07-23). Lần thử thứ hai thì cho qua — nên nó tốn một nhịp, không phải một cuộc chiến. Phần cưỡng chế thật nằm ở test của sakubun; đây là lời nhắc ngay trong lúc làm.

### harness-drift-check.mjs

`.claude/hooks/harness-drift-check.mjs` · hook · test: `harness-drift-check.test.mjs`

**Nổ khi nào:** đầu mỗi phiên làm việc

**Quyền:** chỉ nhắc

**Nó làm gì:** Khi Claude Code lên phiên bản mới, nó hỏi MỘT câu duy nhất: bản mới có vừa ra tính năng nào mà mình đã tự làm tay không?

**Vì sao có nó:** Tháng 6 platform này bỏ khoảng 6 phiên xây "auto-pilot", rồi Claude Code ra sẵn tính năng chạy hẹn giờ và toàn bộ phần đó bị xoá ngày 2026-07-28. Không có bước nào trong quy trình cũ đi kiểm lại tiền đề — hook này chính là bước đó.

### invariant-warn.mjs

`.claude/hooks/invariant-warn.mjs` · hook · test: `invariant-warn.test.mjs`

**Nổ khi nào:** NGAY SAU mỗi lần ghi/sửa file

**Quyền:** góp ý (không chặn)

**Nó làm gì:** Sau mỗi lần ghi file, nó đọc lại file và nhắc (không chặn) nếu thấy chạm vào ba bất biến của NUC: tự xin chứng chỉ SSL, dùng runner tự dựng trong CI, hoặc mở cổng ra host trong compose của một app.

**Vì sao có nó:** Ba thứ này đều có trường hợp ngoại lệ hợp lệ, nên chặn cứng sẽ chặn oan việc đúng. Nhắc thì đúng liều: lỗi vẫn được thấy ngay trong lúc làm.

### legibility-lint.mjs

`.claude/hooks/legibility-lint.mjs` · hook · test: `legibility-lint.test.mjs`

**Nổ khi nào:** TRƯỚC mỗi lần tôi hỏi anh một câu có lựa chọn · khi tôi kết thúc một lượt trả lời

**Quyền:** **CHẶN được**

**Nó làm gì:** Nó kiểm chính cách tôi nói với anh: danh sách lựa chọn phải có cái được khuyến nghị, và thuật ngữ phải có một câu giải thích thường ngày đi kèm.

**Vì sao có nó:** Luật này đã tồn tại ở hai chỗ (CLAUDE.md và một file ký ức) mà vẫn bị vi phạm — vì anh không phản đối, anh chỉ lặng lẽ ngừng đọc theo. Nên nó thành cái gác, thay vì thành một lời nhắc thứ ba.

### memory-wiring-check.mjs

`.claude/hooks/memory-wiring-check.mjs` · hook · test: `memory-wiring-check.test.mjs`

**Nổ khi nào:** đầu mỗi phiên làm việc

**Quyền:** chỉ nhắc

**Nó làm gì:** Đầu phiên, nó kiểm tôi có thật sự nạp được ký ức về anh không: đường dẫn ký ức có trỏ đúng, MEMORY.md có nằm trong giới hạn nạp, có file ký ức nào chưa được ghi vào mục lục.

**Vì sao có nó:** Kiểu hỏng này vô hình. Một ký ức viết ngày 2026-07-24 đến 2026-07-28 mới phát hiện là chưa bao giờ được nạp. Không có nó thì tôi vào phiên mà không nhớ gì về anh, và cũng không biết là mình đang không nhớ.

### plan-checkin.mjs

`.claude/hooks/plan-checkin.mjs` · hook · test: `plan-checkin.test.mjs`

**Nổ khi nào:** đầu mỗi phiên làm việc

**Quyền:** chỉ nhắc

**Nó làm gì:** Đầu phiên, nó xem mọi kế hoạch trong repo và nhắc: cái nào đã đến ngày hẹn xem lại, cái nào đang mở mà 10 ngày không ai chạm, cái nào ghi ngày hẹn nhưng thiếu phần việc-cần-làm-hôm-đó.

**Vì sao có nó:** Có loại việc chỉ trả lời được bằng cách để thời gian đi qua. Trước khi có nó, ngày hẹn nằm giữa một file kế hoạch — anh phải tự nhớ ngày VÀ tự hỏi lại các bước. Đây cũng là đường ray mà cái đồng hồ health-sweep/platform-report đang chạy trên đó.

### prettier-on-edit.mjs

`.claude/hooks/prettier-on-edit.mjs` · hook · test: `prettier-on-edit.test.mjs`

**Nổ khi nào:** NGAY SAU mỗi lần ghi/sửa file

**Quyền:** **SỬA lại file vừa ghi**

**Nó làm gì:** Sau mỗi lần ghi file, nó chạy prettier CỦA CHÍNH project đó để định dạng lại file vừa ghi. Không tìm thấy prettier gần đó thì im lặng bỏ qua.

**Vì sao có nó:** Định dạng là tiện lợi, không phải cổng — nên nó không bao giờ chặn và luôn thoát 0. Lưu ý đo được 2026-07-30: gốc fleet KHÔNG có file cấu hình prettier, nên các file .md trong platform/ không thuộc phạm vi nó — chạy prettier tay lên đó là tạo nhiễu, không phải chuẩn hoá.

### reuse-guard.mjs

`.claude/hooks/reuse-guard.mjs` · hook · test: `reuse-guard.test.mjs`

**Nổ khi nào:** TRƯỚC mỗi lần ghi/sửa file

**Quyền:** **CHẶN được**

**Nó làm gì:** Khi tôi tạo một file mới mà tên trùng với thứ commons đã có sẵn, nó chặn lần đầu và nói nên `shadcn add` cái nào. Lần thứ hai thì cho qua.

**Vì sao có nó:** /code-reuse đã dặn "xem trước khi xây" từ tháng 6 mà bốn app vẫn mọc ra bốn cái theme toggle khác nhau. Một công cụ chỉ chạy khi tôi chọn gọi nó thì không đáng tin; hook thì luôn chạy. Nó chỉ đọc một bảng có sẵn nên nhanh — bản quét đầy đủ mất ~1.9 giây, quá chậm để đứng trước mỗi lần ghi file.

### secret-guard.mjs

`.claude/hooks/secret-guard.mjs` · hook · test: `secret-guard.test.mjs`

**Nổ khi nào:** TRƯỚC mỗi lần ghi/sửa file

**Quyền:** **CHẶN được**

**Nó làm gì:** Nó CHẶN việc viết một khoá hay token thật vào bất cứ file nào không phải .env.

**Vì sao có nó:** Bất biến số 1 của platform. Nó dùng bộ mẫu hẹp, có danh sách tha cho các giá trị mẫu, và luôn tha .env — để gần như không báo oan, vì một cái gác báo oan nhiều thì sẽ bị tắt và khi đó nó không gác gì cả.

### suggest-session-wrap.mjs

`.claude/hooks/suggest-session-wrap.mjs` · hook · test: `suggest-session-wrap.test.mjs`

**Nổ khi nào:** khi tôi kết thúc một lượt trả lời

**Quyền:** chỉ nhắc

**Nó làm gì:** Khi tôi kết thúc một lượt trả lời, nếu phiên này đã làm nhiều việc mà chưa ghi lại gì, nó nhắc một lần duy nhất: nên chạy /session-wrap.

**Vì sao có nó:** Tối đa một lần mỗi phiên, và chỉ khi có bằng chứng đã làm thật (từ 3 file hoặc 5 lần sửa trở lên) mà chưa có file tri thức nào được cập nhật. Không bao giờ chặn việc kết thúc.

### attic.mjs

`.claude/scripts/attic.mjs` · script · test: `attic.test.mjs`

**Chạy tay:** `node .claude/scripts/attic.mjs`

**Khi nào cần:** Khi định bỏ một skill, script hay tài liệu mà chưa chắc chắn.

**Nó làm gì:** Cơ chế cho một thứ nghỉ hưu có bằng chứng: nó chuyển thứ định bỏ vào phòng chờ và KHÔNG BAO GIỜ tự xoá — người mới được xoá.

**Vì sao có nó:** Xoá sai file trong repo này là mất việc không dựng lại được từ đâu cả. Và nguy hiểm không phải sự bất cẩn mà là sự TỰ TIN: ngày 2026-07-30 một công cụ tuyên bố 14 skill đang sống là đã chết. Nó cũng từ chối lý do "không dùng nữa" — phải viết được lý do thật.

### decisions-split.mjs

`.claude/scripts/decisions-split.mjs` · script · test: `decisions-split.test.mjs`

**Chạy tay:** `node .claude/scripts/decisions-split.mjs`

**Khi nào cần:** Khi một file decisions.md quá lớn — health-sweep hoặc memory-audit sẽ báo trước.

**Nó làm gì:** Biến file decisions.md đã phình to của một project trở lại thành mục lục + các file theo tháng.

**Vì sao có nó:** Cùng bệnh cùng thuốc với ledger-split. Bản sửa cho sổ chung áp dụng 2026-07-28 nhưng không ai đi kiểm các sổ theo từng project; đo lại 2026-07-29 thì chúng phình đúng như vậy.

### eval-ledger-rule.mjs

`.claude/scripts/eval-ledger-rule.mjs` · script · test: **chưa có**

**Chạy tay:** `node .claude/scripts/eval-ledger-rule.mjs`

**Khi nào cần:** Hầu như không chạy lại — nó tốn tiền thật và kết quả đã được ghi lại.

**Nó làm gì:** Một phép thử có model tham gia: nó gọi Claude thật hai lần để xem một phiên mới có ghi sổ tri thức đúng luật hay không (một dòng mục lục ngắn + một entry chi tiết ở file riêng).

**Vì sao có nó:** Đây là công cụ DUY NHẤT được miễn test, và lý do đó được in ra mỗi lần tool-check chạy: kết quả của nó không tất định VÀ có phí. Nửa tất định của nó (đếm dòng trong file mà model đã sửa) chưa được tách ra nên chưa test được.

### health-sweep.mjs

`.claude/scripts/health-sweep.mjs` · script · test: `health-sweep.test.mjs`

**Chạy tay:** `node .claude/scripts/health-sweep.mjs`

**Khi nào cần:** Mỗi tuần một lần. Chỉ cần đọc dòng VERDICT.

**Nó làm gì:** MỘT lệnh gọi hết mọi công cụ kiểm và trả về một dòng kết luận duy nhất: có gì vỡ không.

**Vì sao có nó:** Platform có 8 công cụ kiểm mà không có cách hỏi tất cả một lượt, nên thực tế chúng chỉ được chạy khi người ta đã nghi ngờ — đúng lúc một kết quả xanh nói được ít nhất. Phần "drift" là danh sách ứng viên để xem, KHÔNG phải danh sách việc phải làm.

### ledger-split.mjs

`.claude/scripts/ledger-split.mjs` · script · test: `ledger-split.test.mjs`

**Chạy tay:** `node .claude/scripts/ledger-split.mjs`

**Khi nào cần:** Khi mục lục phình ra — memory-audit sẽ báo.

**Nó làm gì:** Biến sổ tri thức chung trở lại thành mục lục + các file theo tháng.

**Vì sao có nó:** Luật của sổ ghi từ ngày đầu là "mục lục chỉ một dòng mỗi bài học". Qua khoảng 200 bài thì luật đó bị bào mòn: có dòng dài hơn 2500 ký tự và file đạt 421KB (~105 nghìn token) — mục lục chỉ có ích khi còn quét mắt được.

### link-check.mjs

`.claude/scripts/link-check.mjs` · script · test: `link-check.test.mjs`

**Chạy tay:** `node .claude/scripts/link-check.mjs`

**Khi nào cần:** Tự động trong health-sweep hằng tuần.

**Nó làm gì:** Kiểm các ĐƯỜNG NỐI giữa các file tri thức còn đúng không: file A trỏ sang file B thì B có thật tồn tại không.

**Vì sao có nó:** Mọi công cụ kiểm khác chấm điểm một file. Không cái nào kiểm dây nối giữa các file — mà repo này vỡ đúng ở đó: im lặng, và vẫn được tuân theo vì một chỉ dẫn sai vẫn đọc như một chỉ dẫn.

### memory-audit.mjs

`.claude/scripts/memory-audit.mjs` · script · test: `memory-audit.test.mjs`

**Chạy tay:** `node .claude/scripts/memory-audit.mjs`

**Khi nào cần:** Khi nghi ký ức đang phình hoặc trùng lặp; và tự động trong health-sweep.

**Nó làm gì:** Báo cáo sức khoẻ ký ức của tôi: có vượt giới hạn nạp không, có file mồ côi nằm ngoài mục lục không, có hai ký ức trùng nội dung không.

**Vì sao có nó:** CHỈ báo cáo — không bao giờ tự sửa, tự chuyển hay tự xoá. Đo kích thước và tìm trùng lặp là việc của máy; quyết định bỏ cái nào là việc của người.

### plan-audit.mjs

`.claude/scripts/plan-audit.mjs` · script · test: `plan-audit.test.mjs`

**Nổ khi nào:** NGAY SAU mỗi lần ghi/sửa file (`--hook`)

**Quyền:** góp ý (không chặn)

**Nó làm gì:** Kiểm một file kế hoạch có đúng chuẩn không: thiếu kind, kế hoạch tính năng mà không có 2 nguồn tham khảo bên ngoài, không có tiêu chí chấp nhận, còn chỗ trống của template, thiếu khối "yêu cầu nguyên văn của anh".

**Vì sao có nó:** Platform có ba nơi dạy cách viết kế hoạch nhưng chỉ có một cách kiểm kết quả. Nó thay thế prior-art-check.mjs từ tháng 6 — và 5 tài liệu vẫn gọi tên cũ cho đến khi bị phát hiện 2026-07-30, nên nó cũng là ví dụ cho chính bài học đó.

### platform-report.mjs

`.claude/scripts/platform-report.mjs` · script · test: `platform-report.test.mjs`

**Chạy tay:** `node .claude/scripts/platform-report.mjs`

**Khi nào cần:** Mỗi tháng một lần — kế hoạch standing-cadence sẽ nhắc đúng ngày.

**Nó làm gì:** Xuất MỌI số đo của platform theo từng file ra một báo cáo markdown, để anh mở, sắp xếp và phản đối được.

**Vì sao có nó:** Anh phải kiểm được phán đoán của tôi, không chỉ nhận kết luận. Muốn vậy thì cần số thô trong một file anh mở được, không phải một đoạn tóm tắt trong chat rồi trôi mất. Sáu trong mười lăm lỗi đã biết của đợt test nằm ở chính file này.

### recurrence-check.mjs

`.claude/scripts/recurrence-check.mjs` · script · test: `recurrence-check.test.mjs`

**Chạy tay:** `node .claude/scripts/recurrence-check.mjs`

**Khi nào cần:** Tự động trong health-sweep; và trước khi đóng một phiên vừa ghi thêm bài học mới.

**Nó làm gì:** Hỏi một câu: một lỗi đã học rồi có đang xảy ra LẠI không? Hiện có 5 phép dò tự động, mỗi phép dò gắn với một bài học có thật.

**Vì sao có nó:** Đo 2026-07-30: sổ có 224 bài học và chỉ 29 (13%) nêu được một cách kiểm tự động; known-traps có 41 bài và không nêu cái nào. Nghĩa là câu trả lời cho "làm sao đừng lặp lại" gần như luôn là "ghi xuống và nhớ kỹ hơn" — trong khi chính 224 bài đó là bằng chứng cách ấy không đủ.

### reuse-scan.mjs

`.claude/scripts/reuse-scan.mjs` · script · test: `reuse-scan.test.mjs`

**Chạy tay:** `node .claude/scripts/reuse-scan.mjs`

**Khi nào cần:** Trước khi xây một tính năng mới; và tự động trong health-sweep.

**Nó làm gì:** Tìm cùng một thứ được xây ở nhiều project khác nhau, rồi áp luật-ba-lần.

**Vì sao có nó:** /code-reuse đã dặn grep các project bên cạnh, nhưng tôi phải tự nghĩ ra từ khoá nên chẳng lần nào đếm được thật. Kết quả đo được: sáu dòng trong shared-assets nằm ở trạng thái "đã lặp 2 lần, lần thứ 3 không bao giờ tới".

### rule-classify.mjs

`.claude/scripts/rule-classify.mjs` · script · test: `rule-classify.test.mjs`

**Chạy tay:** `node .claude/scripts/rule-classify.mjs`

**Khi nào cần:** Nó đã trả lời xong câu hỏi của nó. Chạy lại chỉ để xác nhận con số cũ còn đúng.

**Nó làm gì:** Một phép đo một lần: bao nhiêu phần của rulebook chỉ KIỂM một thứ đã tồn tại, thay vì phải gửi luật đi cho model đọc.

**Vì sao có nó:** Nó được viết kèm một hậu quả cam kết TRƯỚC khi có code: nếu dưới 40% thì phương án A của đề xuất MCP bị BỎ, không phải thu nhỏ lại. Đó là cách làm một phép đo mà kết quả không thể bị uốn theo điều mình mong.

### skill-audit.mjs

`.claude/scripts/skill-audit.mjs` · script · test: `skill-audit.test.mjs`

**Chạy tay:** `node .claude/scripts/skill-audit.mjs`

**Khi nào cần:** Khi số skill phình lên, hoặc khi nghi có skill đã chết.

**Nó làm gì:** Xem từng skill đã cài có còn đáng chỗ của nó không.

**Vì sao có nó:** Tên và mô tả của MỌI skill đã cài được nhồi vào đầu mỗi phiên dù có gọi hay không — phần thân mới nạp theo yêu cầu, phần danh mục thì không. CHỈ báo cáo: gỡ một skill là thay đổi luật, và đó là việc của người.

### sprawl-check.mjs

`.claude/scripts/sprawl-check.mjs` · script · test: `sprawl-check.test.mjs`

**Chạy tay:** `node .claude/scripts/sprawl-check.mjs`

**Khi nào cần:** Trước khi định thêm một skill/script/hook/tài liệu mới. Và tự động hằng tuần trong health-sweep.

**Nó làm gì:** Cái phanh chống phình. Nó KHÔNG đo lại gì — nó đọc số của `usage-census` rồi áp một luật có ngưỡng: số món "chưa ai dùng" trong mỗi tầng CHỈ được phép giảm, không được tăng. Và nó liệt kê món nào đã đủ điều kiện nghỉ hưu theo hai con số (không ai dùng VÀ gần như không file nào trỏ tới).

**Vì sao có nó:** Đo 2026-07-31: 17/38 skill và 66/134 file tri thức chưa ai dùng lần nào, `commons` có 27 món và 0 lần được cài. Thêm máy móc vào lúc một nửa máy móc đang nằm không chính là định nghĩa của over-engineering. Nhưng một cổng đỏ ngay ngày đầu thì sẽ bị tắt — nên nó chốt mức HÔM NAY làm mốc và chỉ nổ khi con số TĂNG. Nó không bao giờ tự xoá: xoá là việc của người, qua `attic.mjs`.

### tool-catalog.mjs

`.claude/scripts/tool-catalog.mjs` · script · test: `tool-catalog.test.mjs`

**Chạy tay:** `node .claude/scripts/tool-catalog.mjs`

**Khi nào cần:** Sau khi thêm/xoá/sửa một hook hay script, chạy `--write` để cập nhật trang. Muốn kiểm trang còn khớp với thực tế không thì `--check` (health-sweep gọi cái này).

**Nó làm gì:** Sinh ra một trang duy nhất giải thích cả 29 hook + script: cái nào tự chạy, cái nào anh tự gọi, nổ vào lúc nào, chặn được hay chỉ nhắc, đã có test chưa.

**Vì sao có nó:** Bảng viết tay không sống được. `.claude/hooks/README.md` có đúng cái bảng này và đã thiếu 3/13 hook trong vòng một ngày — hai trong ba cái thiếu là loại CHẶN được lệnh ghi file. Trang này sinh từ chính các file + settings.json, nên nó không thể lệch; và một công cụ chưa tự giới thiệu thì lệnh này thất bại.

### tool-check.mjs

`.claude/scripts/tool-check.mjs` · script · test: `tool-check.test.mjs`

**Chạy tay:** `node .claude/scripts/tool-check.mjs`

**Khi nào cần:** Sau khi thêm hoặc sửa một hook/script.

**Nó làm gì:** MỘT lệnh chạy hết test của mọi hook và script, rồi gọi tên công cụ nào chưa có test.

**Vì sao có nó:** Chủ trương của platform là "dùng công cụ để chính xác, nhưng đừng tin một công cụ mình chưa kiểm". Nửa sau đó không làm được cho đến 2026-07-30. Một công cụ muốn được miễn test thì phải khai báo công khai kèm lý do, và một lý do ngắn hơn một câu sẽ làm lệnh này thất bại — vì một ngoại lệ không ai đọc được thì không khác gì một lỗ hổng không ai thấy.

### usage-census.mjs

`.claude/scripts/usage-census.mjs` · script · test: `usage-census.test.mjs`

**Chạy tay:** `node .claude/scripts/usage-census.mjs`

**Khi nào cần:** Trước khi quyết định bỏ bất cứ thứ gì.

**Nó làm gì:** Đo từng phần của agent OS thực sự được dùng bao nhiêu, bằng HAI con số: số lần được mở/chạy, và số file khác trỏ tới nó.

**Vì sao có nó:** Hai con số, vì một con số đã sai hai lần trong cùng một ngày: tầng day-log trông như chết với grep (không script nào đọc nó) mà thực tế được đọc 93 lần; 30 file kế hoạch đã đóng trông như rác mà được 63 file khác gọi tên. Con số nó đưa ra là SÀN, không phải trần.

### _layout.mjs

`.claude/scripts/_layout.mjs` · thư viện · test: `_layout.test.mjs`

**Nó làm gì:** Nơi DUY NHẤT biết các project nằm ở đâu trong repo này. Các hook và script khác hỏi nó thay vì tự đoán.

**Vì sao có nó:** Trước 2026-07-30 mỗi công cụ tự đoán chỗ. Rồi chín repo app dồn vào folder projects/ và bốn công cụ hỏng IM LẶNG theo cùng một kiểu — chúng vẫn chạy, vẫn báo xanh, chỉ là không còn thấy project nào. File này sinh ra từ đúng vụ đó, và nó cũng là lý do một lần dồn folder nữa phải sửa chỗ tìm kiếm TRƯỚC khi di chuyển file.

### _util.mjs

`.claude/hooks/_util.mjs` · thư viện · test: `_util.test.mjs`

**Nó làm gì:** Bộ hàm dùng chung của các hook: đọc dữ liệu Claude Code gửi vào, và ghi lại mỗi lần một hook chạy.

**Vì sao có nó:** Việc ghi log đó là bằng chứng DUY NHẤT cho biết hook có chạy hay không — hook không phải một lệnh gọi công cụ nên nó không xuất hiện trong bản ghi phiên. Nguyên tắc bất di bất dịch của file này: việc ghi chép không bao giờ được làm thay đổi kết quả của hook, vì kết quả đó là toàn bộ hợp đồng giữa hook và Claude Code.

## 5. Cái trang này tự kiểm được

- `--check` báo lỗi nếu trang này khác với thực tế trên đĩa, hoặc có công cụ chưa có `@vi WHAT`.
- Một file hook **không được cắm** vào `settings.json` là mã chết trông như đang sống — `--check` gọi tên nó.
- Số lần chạy/nổ thật **không nằm trong trang này** (nó là log cục bộ của từng máy, đưa vào sẽ khác nhau mỗi
  máy). Xem bằng: `node .claude/scripts/tool-catalog.mjs --counts`.

