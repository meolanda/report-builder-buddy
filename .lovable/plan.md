

## Plan: สร้างระบบรายงานลูกค้า (Pro Site Report)

จากโค้ดที่ให้มา จะสร้างแอปสำหรับทำรายงานลูกค้าแบบ PDF ที่ประกอบด้วยการกรอกข้อมูลงาน, อัปโหลดรูปภาพ, สรุปผล และ export เป็น PDF

### สิ่งที่ต้องสร้าง

**1. Types & Data Models** (`src/types/report.ts`)
- `JobInfo` — ข้อมูลงาน (ชื่อลูกค้า, วันที่, สถานที่, ผู้รายงาน, โลโก้, หมายเหตุ, หัวข้อ)
- `PhotoItem` — รูปภาพพร้อมคำอธิบาย
- `PhotoSection` — กลุ่มรูปภาพ (id, title, photos)
- `ReportData` — รวม jobInfo + sections + conclusion

**2. Components** (6 ตัว)
- `JobInfoForm` — ฟอร์มกรอกข้อมูลงาน (ชื่อลูกค้า, วันที่, สถานที่, ผู้รายงาน, โลโก้, หัวข้อรายงาน)
- `PhotoSection` — จัดการรูปภาพแต่ละ section (อัปโหลด, ลบ, เพิ่มคำอธิบาย, แก้ชื่อ section)
- `ConclusionSection` — กรอกสรุปผลงาน + หมายเหตุท้ายกระดาษ
- `PDFPreview` — Modal แสดงตัวอย่างรายงานก่อน export
- `ReportHistory` — หน้าประวัติรายงานที่บันทึกไว้

**3. Hooks**
- `useReportStorage` — บันทึก/โหลดรายงานจาก localStorage (saveReport, loadReport, listReports, deleteReport, isSaving, isLoading)

**4. PDF Generator** (`src/utils/pdfGenerator.ts`)
- ใช้ browser print / canvas-based approach สร้าง PDF จากข้อมูลรายงาน
- รองรับโลโก้, หลายรูปภาพ, ข้อความสรุป

**5. Pages & Routes**
- `/` — หน้าหลัก (สร้าง/แก้ไขรายงาน) ตามโค้ดที่ให้มา
- `/history` — หน้าประวัติรายงาน

**6. Styling**
- เพิ่ม custom CSS classes (`btn-primary`, `btn-secondary`, gradient header) ใน index.css
- โทนสีน้ำเงินมืออาชีพ

### Technical Notes
- ข้อมูลบันทึกใน localStorage (ไม่ต้องใช้ backend)
- รูปภาพเก็บเป็น base64 data URL
- PDF สร้างจาก HTML-to-canvas approach โดยไม่ต้องใช้ library เพิ่ม — ใช้ `window.print()` กับ print stylesheet หรือจะเพิ่ม `jspdf` + `html2canvas`
- ทุก component ใช้ shadcn/ui components ที่มีอยู่แล้ว

