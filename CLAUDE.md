# report-builder-buddy

PWA สำหรับสร้างรายงานรูปภาพ PM (ก่อน/หลังซ่อม) เป็น PDF — React + Vite + TypeScript + Tailwind + shadcn/ui

## Dev

```
npm run dev       # vite dev server (default port 5173, แต่บางเครื่อง dev อาจ bind 8080 ถ้า 5173 ถูกใช้)
npm run build
npm run lint
npm test          # vitest
```

Deploy: GitHub `main` → auto-deploy ผ่าน Vercel (https://report-builder-buddy.vercel.app)
**Vercel build อาจดีเลย์กว่าที่ GitHub Deployments API รายงานว่า "completed"** — ก่อนบอกผู้ใช้ว่า deploy เสร็จ ให้ fetch JS bundle จริงจากเว็บ (`/assets/index-*.js`, cache: 'no-store') แล้ว grep หา string literal ภาษาไทยที่เพิ่ม/ลบไป (ห้าม grep ชื่อตัวแปร เพราะ minify เปลี่ยนชื่อหมด)

## สถาปัตยกรรมข้อมูล

`src/types/report.ts` — `ReportData = { jobInfo, categories, conclusion }`

`Category` มี 2 ชนิด:
- **`unit-based`** (เช่น แอร์, ตู้แช่) — มี `units[]` แต่ละยูนิตมี `beforePhotos[]` / `afterPhotos[]` แยกกัน → PDF แสดง ก่อนทำ (ซ้าย) | หลังทำ (ขวา) คู่กันในแถวเดียว
- **`fixed-sub`** (เช่น ระบบ Hood, ระบบอาคาร, เอกสาร/บันทึก) — มี `subSections[]` แต่ละอันมี `photos[]` รวมชุดเดียว ไม่มีก่อน/หลัง แสดงเป็น 2-col grid

`DEFAULT_CATEGORIES` คือ template หมวดมาตรฐาน — ถ้าจะเพิ่ม/ลบ/เปลี่ยนชื่อหมวด default แก้ที่นี่

ลำดับของ `categories[]` ในหน้าแอป **กำหนดลำดับการแสดงผลใน PDF โดยตรง** มีปุ่มเลื่อนขึ้น/ลงระดับหมวดใหญ่ใน `CategorySection.tsx`/`Index.tsx` และปุ่มเลื่อน subSection ภายในหมวดได้ใน `FixedSubSection`

หมวด `cat-docs` → subSection id `doc-1` ("รูปเข้า-ออกพื้นที่") เป็นกรณีพิเศษ: รูปในนี้จะถูกดึงไปแสดงที่ **หน้าปก** แทนที่จะอยู่ในเนื้อหา (ดู `ENTRY_EXIT_SUB_ID` ใน `pdfGenerator.ts`)

## UI — CategorySection.tsx

- **แก้ชื่อหมวด (Category)**: ดับเบิลคลิกที่ชื่อ → inline input
- **แก้ชื่อยูนิต (Unit)**: ดับเบิลคลิกที่ชื่อ → inline input
- **แก้ชื่อหัวข้อย่อย (SubSection)**: คลิกปุ่ม ✏️ หรือดับเบิลคลิกที่ชื่อ
- **เลื่อนหัวข้อย่อย**: ปุ่ม ↑/↓ ใน `FixedSubSection` — disabled อัตโนมัติที่ขอบบน/ล่าง
- **Lightbox**: คลิกรูปใน `PhotoGrid` / `PairedPhotoGrid` → เปิดรูปขยายเต็มจอ

## PairedPhotoGrid (`src/components/PairedPhotoGrid.tsx`)

ใช้กับ **unit-based** sections แทน 2 PhotoGrids แยกกัน — แสดงรูป ก่อนทำ | หลังทำ เป็นตารางซ้าย-ขวา ให้เห็นการจับคู่ชัดเจนก่อน export PDF:

```
┌─────────────────┬─────────────────┐
│   📷 ก่อนทำ    │   ✅ หลังทำ    │
├─────────────────┼─────────────────┤
│   [รูปที่ 1]   │   [รูปที่ 1]   │  ← คู่ที่ 1
├─────────────────┼─────────────────┤
│   [รูปที่ 2]   │     —           │  ← ก่อนทำมีแต่หลังทำไม่มี → แสดง "—"
├─────────────────┼─────────────────┤
│ + เพิ่มรูปก่อน │ + เพิ่มรูปหลัง │
└─────────────────┴─────────────────┘
```

- การจับคู่ด้วย index: row i = `beforePhotos[i]` + `afterPhotos[i]`
- ถ้าจำนวนไม่เท่ากัน → ช่องที่ไม่มีรูปแสดง "—" (ตรงกับ PDF ที่แสดง dash)
- Props: `beforePhotos`, `afterPhotos`, `onChange(before, after)`
- Lightbox และ caption edit built-in (ไม่ต้องพึ่ง PhotoGrid)

## การจัดเก็บ

ไม่มี backend — บันทึกลง `localStorage` key `"pro-site-reports"` (array ของ `SavedReport`) ผ่าน `useReportStorage.ts` auto-save ทุก 30 วินาที

`SavedReport` format: `{ id, name, createdAt, updatedAt, data: { jobInfo, categories, conclusion } }` — ต้องมี field `data` ห่ออีกชั้น ห้ามใส่ jobInfo/categories ตรงๆ ที่ root

## PDF Generator (`src/utils/pdfGenerator.ts`) — จุดที่ละเอียดอ่อนที่สุดของโปรเจกต์

ใช้ jsPDF วาดเองทั้งหมด (ไม่ใช่ html2canvas) แบ่งเป็น **2 passes**:
1. **Pass 1** — วางแผนหน้า (`pages: PDFPage[]`) เป็น block ๆ คำนวณว่าอะไรพอดีหน้าไหนจาก `fits(height)`
2. **Pass 2** — เดิน `pages[]` วาดจริงทีละหน้า

### Block types (Pass 1)

| block | ความสูง | ใช้ทำอะไร |
|-------|---------|-----------|
| `cover` | 0 (วาด freeform) | หน้าปก — ต้องอยู่หน้าแรกคนเดียวเสมอ |
| `unit-hdr` | `UNIT_HDR_H` = 12mm | แถบ navy "🧊 แอร์ › ยูนิต 1 \| วันที่" |
| `col-lbl` | `COL_LBL_H` = 8mm | แถว "ก่อนทำ \| หลังทำ" |
| `pair` | `PAIR_H` = 47mm | รูปคู่ before(ซ้าย) / after(ขวา) |
| `sub-lbl` | `SUB_LBL_H` = 10mm | header หัวข้อย่อย fixed-sub |
| `photo-row` | `PAIR_H` = 47mm | 2-col grid สำหรับ fixed-sub |
| `gap` | กำหนดเอง | ช่องว่างระหว่างกลุ่ม |
| `conclusion` | 0 (วาด freeform) | สรุปผลการทำงาน |
| `closing` | 0 (วาด freeform) | ข้อความท้ายรายงาน |

### Page packing rules
- **หน้าปกต้องอยู่คนเดียวเสมอ** — ใช้ `newPage()` ก่อนเริ่ม categories เสมอ (ห้ามปล่อยให้ content ต่อท้าย cover โดยอัตโนมัติ)
- Unit group ใหม่: ถ้า `!fits(UNIT_MIN)` → `newPage()` ก่อน
- Sub group ใหม่: ถ้า `!fits(SUB_MIN)` → `newPage()` ก่อน
- แต่ละ pair ตามด้วย `gap(PAIR_GAP=3mm)` — ทำให้รูปไม่ชนกัน และ gap หลังคู่สุดท้ายทำหน้าที่เป็น buffer ก่อน footer
- **CONTENT_TOP = HDR_H + 5mm** (ไม่ใช่ HDR_H + MARGIN) — ลดช่องว่างระหว่าง info bar กับเนื้อหาให้แน่นขึ้น
- **ห้ามเพิ่ม extra buffer ที่ CONTENT_BOTTOM** — เคยเพิ่ม 5mm แล้วทำให้ใส่ได้แค่ 3 คู่ต่อหน้าแทนที่จะเป็น 4 คู่
- `conclusion` / `closing`: เช็ค `fits()` ก่อน — ถ้าพื้นที่พอให้ pack ต่อท้ายหน้าปัจจุบัน ไม่บังคับ `newPage()`
- ถ้า unit มีรูปมากกว่าพอดีหน้า → `newPage()` + repeat unit-hdr + col-lbl

### Cover/crop image clipping
`drawCellImage()` วาดรูปแบบ cover/crop (เต็มกรอบ ตัดส่วนเกิน) โดยใช้ PDF raw operators ผ่าน `pdf.internal.write()`:
```
${pt(x)} ${pt(PH - y - cellH)} ${pt(cellW)} ${pt(cellH)} re W n
```
พิกัด jsPDF เป็น mm top-left → แปลงเป็น pt bottom-left สำหรับ PDF: `v * 72 / 25.4` และ flip Y ด้วย `PH - y - cellH`

### Gotcha ที่เคยพังจริง

**XObject collision** — `pdf.addImage()` ต้องใส่ `photo.id` เป็น alias parameter ที่ 6 ทุกครั้ง ไม่งั้นรูปเดียวกันจะ dedupe เป็น XObject เดียวทำให้รูปซ้ำ/หาย

**Cover + content อยู่หน้าเดียวกัน** — เกิดจาก `push({ t: "cover" }, 0)` push height=0 ทำให้ `py` ยังเป็น 15mm แล้ว `fits()` คิดว่าหน้ายังว่าง ต้องเรียก `newPage()` หลัง push cover เสมอ

**Header/footer วาดครั้งเดียวต่อหน้า** — `drawHeader()`/`drawFooter()` ถูกเรียกจาก loop หลักของ Pass 2 เท่านั้น ห้ามเรียกซ้ำใน block handler ใดๆ

### ไม่มี TOC และไม่มีโลโก้ลูกค้า
- เคยมีสารบัญแล้วถูกขอเอาออก — อย่าใส่กลับโดยไม่ถาม
- โลโก้ใช้ Handyman + DIF (2 ตัวที่มีอยู่แล้วใน public/) เท่านั้น — ไม่มี field โลโก้ลูกค้า

## Vercel CDN Cache

`vercel.json` ตั้งค่า:
- `index.html` → `no-cache, no-store, must-revalidate` (ทุกเครื่องได้ version ใหม่เสมอ)
- `/assets/*` → `public, max-age=31536000, immutable` (cache ตลอดไป เพราะ filename hash เปลี่ยนทุก build)

## Testing PDF generator ด้วยมือ

`public/test-inject.js` — script ฉีดข้อมูลทดสอบลง localStorage รันใน browser console:
```js
const blob = await fetch('/test-inject.js?v=' + Date.now(), {cache:'no-store'}).then(r=>r.blob());
const { inject } = await import(URL.createObjectURL(blob));
await inject();
```
แล้วไปที่ `/?reportId=report-test-inject` — **ต้อง cache-bust ทุกครั้ง**

เช็คโครงสร้าง PDF ด้วย `pdfplumber` (Python) — `pdftoppm` ไม่มีในเครื่องนี้
