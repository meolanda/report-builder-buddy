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
- **`unit-based`** (เช่น แอร์, ตู้แช่) — มี `units[]` แต่ละยูนิตมี `beforePhotos[]` / `afterPhotos[]` แยกกัน → ในรายงานจะแยกหน้า "ก่อน" กับ "หลัง" เสมอ
- **`fixed-sub`** (เช่น ระบบ Hood, ระบบอาคาร, เอกสาร/บันทึก) — มี `subSections[]` แต่ละอันมี `photos[]` รวมชุดเดียว ไม่มีก่อน/หลัง

`DEFAULT_CATEGORIES` คือ template หมวดมาตรฐาน — ถ้าจะเพิ่ม/ลบ/เปลี่ยนชื่อหมวด default แก้ที่นี่

ลำดับของ `categories[]` ในหน้าแอป **กำหนดลำดับการแสดงผลใน PDF โดยตรง** (มีปุ่มเลื่อนขึ้น/ลงระดับหมวดใหญ่ใน `CategorySection.tsx`/`Index.tsx` แต่ยังเลื่อน subSection ภายในหมวดไม่ได้)

หมวด `cat-docs` → subSection id `doc-1` ("รูปเข้า-ออกพื้นที่") เป็นกรณีพิเศษ: รูปในนี้จะถูกดึงไปแสดงที่ **หน้าปก** แทนที่จะอยู่ในเนื้อหา (ดู `ENTRY_EXIT_SUB_ID` ใน `pdfGenerator.ts`)

## การจัดเก็บ

ไม่มี backend — บันทึกลง `localStorage` key `"pro-site-reports"` (array ของ `SavedReport`) ผ่าน `useReportStorage.ts` auto-save ทุก 30 วินาที

## PDF Generator (`src/utils/pdfGenerator.ts`) — จุดที่ละเอียดอ่อนที่สุดของโปรเจกต์

ใช้ jsPDF วาดเองทั้งหมด (ไม่ใช่ html2canvas) แบ่งเป็น **2 passes**:
1. **Pass 1** — วางแผนหน้า (`pages: PDFPage[]`) เป็น block ๆ (`cover` / `ctx` / `row` / `gap` / `conclusion` / `closing`) คำนวณว่าอะไรพอดีหน้าไหนจาก `fits(height)`
2. **Pass 2** — เดิน `pages[]` วาดจริงทีละหน้า

Layout grid: **6 รูปต่อหน้า เสมอ** (3 แถว × 2 คอลัมน์) — ห้ามแก้ให้เกิน เพราะผู้ใช้ยืนยัน requirement นี้ชัดเจน

### Gotcha ที่เคยพังจริง — XObject collision
`pdf.addImage()` ถ้าเรียกซ้ำด้วย data URL เดียวกันหลายครั้งโดยไม่ใส่ alias มันจะ dedupe เป็น XObject เดียว ทำให้เห็นรูปซ้ำ/หาย ต้องใส่ `photo.id` เป็น alias parameter ที่ 6 ของ `addImage()` ทุกครั้ง (ดู `drawPhotoRow`)

### Caption-aware row height
ถ้าแถวรูปไม่มี caption เลย รูปจะขยายเต็มแถว (`IMG_H_FULL` = 70mm) แทนที่จะเผื่อที่ไว้ (`IMG_H_CAP` = 63mm) — เช็คทุกแถว ไม่ใช่ global setting

### Header/footer วาดครั้งเดียวต่อหน้า
`drawHeader()`/`drawFooter()` ถูกเรียกครั้งเดียวจาก loop หลักของ Pass 2 (ไม่ใช่ใน block handler) — **ห้ามเรียกซ้ำใน block handler ของ `conclusion`/`closing`** เคยมีบั๊กที่ `closing` วาด navy bar ทับโลโก้เพราะเรียกซ้ำ

### Navy info bar แบบมีเงื่อนไข
`drawHeader()` จะไม่วาดแถบ navy (ลูกค้า/วันที่/สถานที่/ผู้รายงาน) เลยถ้าไม่มีข้อมูลกรอกไว้ (`hasInfo` check) — ป้องกันแถบทึบว่างเปล่า เช่นเดียวกับ info card บนหน้าปก (`rows.length` check)

### ไม่มี TOC
เคยมีสารบัญ (`สารบัญ`) บนหน้าปกแล้วถูกขอเอาออก — อย่าใส่กลับโดยไม่ถาม

## Testing PDF generator ด้วยมือ

`public/test-inject.js` — script ฉีดข้อมูลทดสอบลง localStorage ตรง (5 รูปจริงจาก `public/test-data.json`) รันใน browser console:
```js
const blob = await fetch('/test-inject.js?v=' + Date.now(), {cache:'no-store'}).then(r=>r.blob());
const { inject } = await import(URL.createObjectURL(blob));
await inject();
```
แล้วไปที่ `/?reportId=report-test-inject` — **ต้อง cache-bust ทุกครั้ง** ไม่งั้น browser fetch cache จะเสิร์ฟ test-inject.js เก่า (เจอปัญหานี้มาแล้วจริง)

ดาวน์โหลด PDF ทดสอบแล้วเปิดด้วย `pypdf` เช็คโครงสร้าง (`pdftoppm` ไม่มีในเครื่องนี้ ใช้ Acrobat XI Pro ผ่าน computer-use แทนสำหรับดูภาพจริง)
