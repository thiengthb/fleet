---
name: deliver-in-the-readers-format
description: A deliverable must arrive in the format its actual reader opens — .md is a source format, not a document; he rejects it for anything a person is meant to read
metadata:
  type: feedback
---

**Markdown is not a deliverable when the reader is a person.** 2026-07-29, on a documentation pipeline that produced
eleven correct `.md` files: *"hiện tại file md không thì tôi không khuyến nghị lắm vì đây là tài liệu cho người đọc"* —
and then, unprompted, he named the formats he actually wanted: Google Docs, draw.io, PDF.

**Why.** He judges an artifact by whether its intended reader can open and use it, not by whether it is correct. A
technically-complete `.md` for a thesis examiner is the same failure as a green build nobody ran — right content, wrong
place. Same instinct as [[verify-end-state-not-upload]] (verify the user-facing result, not an intermediate step) and
[[rebuild-container-to-review]] (rebuild so he can SEE it running), applied to documents.

**How to apply.** Before calling a document-shaped deliverable done, ask **who opens this and in what program**, then
produce that: a marker/supervisor ⇒ PDF + DOCX · a spreadsheet-shaped table ⇒ XLSX (drag into Drive, no API needed) · a
diagram he may want to redraw ⇒ the editable source too, not just an image. Keep the markdown as the SOURCE — it diffs
and regenerates — but the exported format is the thing being delivered.

**Two corollaries he confirmed in the same pass.**
① He rejects a format that *looks* right but degrades the content: an SRS forced into a spreadsheet, or `.md` imported
into Google Docs where the diagrams silently arrive as code text.
② **A single bound document, not a folder of files.** Eleven separate PDFs is a directory; the deliverable is one
document with a cover and a contents page.

**And the trait behind it.** He also concedes the *opposite* honestly — that this whole feature may not serve the
platform and *"có thể vứt vào sọt rác"* once the thesis is done. So when something is explicitly a personal deliverable
with an external deadline, say so in the design and make it cheap to delete, rather than quietly letting it grow roots.
See [[practice-first-lean-ceremony]].
