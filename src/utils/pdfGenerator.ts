import { ReportData, PhotoItem } from "@/types/report";
import jsPDF from "jspdf";

// ─── A4 Layout Constants ───────────────────────────────────────────────────────
const PW     = 210;
const PH     = 297;
const MARGIN = 15;
const CW     = PW - MARGIN * 2;          // 180mm usable width

const HDR_H      = 38;                   // logo strip (20) + info bar (18)
const IMG_HDR_H  = 20;
const INFO_BAR_H = 18;
const FTR_H      = 9;
const CONTENT_TOP    = HDR_H + 5;        // 43mm (tight gap below info bar)
const CONTENT_BOTTOM = PH - FTR_H - MARGIN; // 273mm (3mm pair-gap after last row acts as buffer)
const CONTENT_H      = CONTENT_BOTTOM - CONTENT_TOP; // 220mm

// Photo grid
const IMG_GAP  = 5;
const IMG_W    = (CW - IMG_GAP) / 2;    // ~87.5mm per cell

// Per-page section header (unit name + date) + column labels
const UNIT_HDR_H = 12;   // "🧊 ตู้แช่ › ยูนิต 1 | 17 Jul 25"
const COL_LBL_H  = 8;    // "ก่อนทำ | หลังทำ"
const PAIR_H     = 47;   // photo pair row height
const PAIR_GAP   = 3;    // gap between consecutive pairs

// Fixed-sub section label (no before/after)
const SUB_LBL_H  = 10;

// Min space to start a new unit group (hdr + lbl + first row)
const UNIT_MIN = UNIT_HDR_H + COL_LBL_H + PAIR_H + PAIR_GAP; // 70mm
const SUB_MIN  = SUB_LBL_H + PAIR_H + PAIR_GAP;               // 60mm

// ─── Colours ───────────────────────────────────────────────────────────────────
const NAVY  : [number,number,number] = [30,  58,  95];
const BLUE  : [number,number,number] = [59,  130, 246];
const LBLUE : [number,number,number] = [219, 234, 254];
const GREEN : [number,number,number] = [16,  185, 129];
const LGREEN: [number,number,number] = [209, 250, 229];
const WHITE : [number,number,number] = [255, 255, 255];
const DARK  : [number,number,number] = [30,  30,  30];
const MID   : [number,number,number] = [90,  90,  90];
const LIGHT : [number,number,number] = [160, 160, 160];
const BORDER: [number,number,number] = [210, 220, 235];

// ─── Font helpers ──────────────────────────────────────────────────────────────
const FONT_CACHE: Record<string, string> = {};

async function loadFont(url: string): Promise<string> {
  if (FONT_CACHE[url]) return FONT_CACHE[url];
  const res  = await fetch(url);
  const buf  = await res.arrayBuffer();
  const u8   = new Uint8Array(buf);
  const chunk = 0x8000;
  let b64 = "";
  for (let i = 0; i < u8.length; i += chunk)
    b64 += String.fromCharCode(...u8.subarray(i, i + chunk));
  FONT_CACHE[url] = btoa(b64);
  return FONT_CACHE[url];
}

async function registerFonts(pdf: jsPDF) {
  const [reg, bold] = await Promise.all([
    loadFont("/fonts/Sarabun-Regular.ttf"),
    loadFont("/fonts/Sarabun-Bold.ttf"),
  ]);
  pdf.addFileToVFS("Sarabun-Regular.ttf", reg);
  pdf.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  pdf.addFileToVFS("Sarabun-Bold.ttf", bold);
  pdf.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
}

// ─── Image helpers ─────────────────────────────────────────────────────────────
const IMG_B64_CACHE = new Map<string, string>();

async function toB64(url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  if (IMG_B64_CACHE.has(url)) return IMG_B64_CACHE.get(url)!;
  try {
    const res  = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const b64  = await new Promise<string>((ok, err) => {
      const fr = new FileReader();
      fr.onloadend = () => ok(fr.result as string);
      fr.onerror   = err;
      fr.readAsDataURL(blob);
    });
    IMG_B64_CACHE.set(url, b64);
    return b64;
  } catch { /* fall through */ }
  try {
    const b64 = await new Promise<string>((ok, err) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        ok(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = err;
      img.src = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
    });
    IMG_B64_CACHE.set(url, b64);
    return b64;
  } catch { /* fall through */ }
  return url;
}

async function getAspect(b64: string): Promise<number> {
  return new Promise(res => {
    const img   = new Image();
    img.onload  = () => res(img.width / img.height);
    img.onerror = () => res(4 / 3);
    img.src     = b64;
  });
}

function imgFormat(b64: string): string {
  if (b64.includes("data:image/png"))  return "PNG";
  if (b64.includes("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function preloadAll(data: ReportData): Promise<void> {
  const urls: string[] = [];
  if (data.jobInfo.logo) urls.push(data.jobInfo.logo);
  for (const cat of data.categories) {
    if (cat.type === "unit-based") {
      for (const u of cat.units)
        for (const p of [...u.beforePhotos, ...u.afterPhotos]) urls.push(p.url);
    } else {
      for (const s of cat.subSections)
        for (const p of s.photos) urls.push(p.url);
    }
  }
  await Promise.all(urls.map(async u => { try { await toB64(u); } catch {} }));
}

// ─── Drawing utilities ─────────────────────────────────────────────────────────
function fc(pdf: jsPDF, c: [number,number,number]) { pdf.setFillColor(c[0], c[1], c[2]); }
function dc(pdf: jsPDF, c: [number,number,number]) { pdf.setDrawColor(c[0], c[1], c[2]); }
function tc(pdf: jsPDF, c: [number,number,number]) { pdf.setTextColor(c[0], c[1], c[2]); }
function font(pdf: jsPDF, w: "normal"|"bold", size: number) {
  pdf.setFont("Sarabun", w);
  pdf.setFontSize(size);
}

// Clip + draw image (cover/crop — fills cell, clips overflow)
async function drawCellImage(
  pdf: jsPDF, photo: PhotoItem | null,
  x: number, y: number, cellW: number, cellH: number
) {
  // Cell border
  dc(pdf, BORDER); pdf.setLineWidth(0.25);
  pdf.rect(x, y, cellW, cellH);

  if (!photo) {
    font(pdf, "normal", 8); tc(pdf, LIGHT);
    pdf.text("—", x + cellW / 2, y + cellH / 2 + 2, { align: "center" });
    return;
  }

  const imgSrc = IMG_B64_CACHE.get(photo.url) ?? photo.url;
  if (imgSrc) {
    try {
      const aspect   = await getAspect(imgSrc);
      const cellRatio = cellW / cellH;
      let dw: number, dh: number;
      if (aspect >= cellRatio) { dw = cellW; dh = dw / aspect; }
      else                     { dh = cellH; dw = dh * aspect; }
      const ox = x + (cellW - dw) / 2;
      const oy = y + (cellH - dh) / 2;
      const pt = (v: number) => (v * 72 / 25.4).toFixed(3);
      pdf.saveGraphicsState();
      pdf.internal.write(`${pt(x)} ${pt(PH - y - cellH)} ${pt(cellW)} ${pt(cellH)} re W n`);
      pdf.addImage(imgSrc, imgFormat(imgSrc), ox, oy, dw, dh, photo.id);
      pdf.restoreGraphicsState();
    } catch {
      font(pdf, "normal", 8); tc(pdf, LIGHT);
      pdf.text("ไม่พบรูปภาพ", x + cellW / 2, y + cellH / 2, { align: "center" });
    }
  }
}

// Section header bar: "[icon] catName  ›  unitName  |  date"
function drawUnitHeader(
  pdf: jsPDF, icon: string, catName: string, unitName: string, date: string, y: number
) {
  fc(pdf, NAVY); pdf.rect(MARGIN, y, CW, UNIT_HDR_H, "F");
  fc(pdf, BLUE); pdf.rect(MARGIN, y, 4, UNIT_HDR_H, "F");

  const parts = [icon + " " + catName, unitName].filter(Boolean);
  font(pdf, "bold", 9); tc(pdf, WHITE);
  pdf.text(parts.join("  ›  "), MARGIN + 8, y + UNIT_HDR_H / 2 + 2.5);

  if (date) {
    font(pdf, "normal", 8); tc(pdf, LBLUE);
    pdf.text(date, MARGIN + CW - 3, y + UNIT_HDR_H / 2 + 2.5, { align: "right" });
  }
}

// Column label row: "ก่อนทำ" | "หลังทำ"
function drawColLabels(pdf: jsPDF, y: number) {
  const half = IMG_W;
  const lx = MARGIN;
  const rx = MARGIN + half + IMG_GAP;

  fc(pdf, LBLUE); pdf.rect(lx, y, half, COL_LBL_H, "F");
  dc(pdf, BORDER); pdf.setLineWidth(0.2);
  pdf.rect(lx, y, half, COL_LBL_H);
  font(pdf, "bold", 8.5); tc(pdf, NAVY);
  pdf.text("ก่อนทำ", lx + half / 2, y + COL_LBL_H / 2 + 2.5, { align: "center" });

  fc(pdf, LGREEN); pdf.rect(rx, y, half, COL_LBL_H, "F");
  dc(pdf, BORDER); pdf.rect(rx, y, half, COL_LBL_H);
  tc(pdf, GREEN);
  pdf.text("หลังทำ", rx + half / 2, y + COL_LBL_H / 2 + 2.5, { align: "center" });
}

// Subsection label (for fixed-sub, full-width)
function drawSubLabel(pdf: jsPDF, icon: string, catName: string, subName: string, y: number) {
  fc(pdf, LBLUE); pdf.rect(MARGIN, y, CW, SUB_LBL_H, "F");
  fc(pdf, BLUE);  pdf.rect(MARGIN, y, 3, SUB_LBL_H, "F");
  font(pdf, "bold", 8.5); tc(pdf, NAVY);
  const label = subName
    ? `${icon} ${catName}  ›  ${subName}`
    : `${icon} ${catName}`;
  pdf.text(label, MARGIN + 7, y + SUB_LBL_H / 2 + 2.5);
}

// Running header (every content page)
async function drawHeader(pdf: jsPDF, data: ReportData) {
  fc(pdf, WHITE); pdf.rect(0, 0, PW, IMG_HDR_H, "F");
  dc(pdf, [220, 225, 235]); pdf.setLineWidth(0.3);
  pdf.line(0, IMG_HDR_H, PW, IMG_HDR_H);

  if (data.jobInfo.logo) {
    const lsrc = IMG_B64_CACHE.get(data.jobInfo.logo) ?? data.jobInfo.logo;
    try {
      const aspect = await getAspect(lsrc);
      const lh = IMG_HDR_H - 6, lw = aspect * lh;
      pdf.addImage(lsrc, imgFormat(lsrc), MARGIN, 3, lw, lh);
    } catch { /* skip */ }
  }

  if (data.jobInfo.subject) {
    font(pdf, "bold", 10); tc(pdf, NAVY);
    pdf.text(data.jobInfo.subject, PW - MARGIN, IMG_HDR_H / 2 + 2, { align: "right" });
  }

  const hasInfo = !!(data.jobInfo.clientName || data.jobInfo.dateTime || data.jobInfo.location || data.jobInfo.reporterName);
  if (!hasInfo) return;

  fc(pdf, NAVY); pdf.rect(0, IMG_HDR_H, PW, INFO_BAR_H, "F");
  tc(pdf, WHITE);
  let iy = IMG_HDR_H + 7;
  font(pdf, "normal", 8);
  if (data.jobInfo.clientName)  pdf.text(`ลูกค้า: ${data.jobInfo.clientName}`, MARGIN, iy);
  if (data.jobInfo.dateTime)    pdf.text(`วันที่: ${data.jobInfo.dateTime}`, PW - MARGIN, iy, { align: "right" });
  iy += 5.5;
  if (data.jobInfo.location)    pdf.text(`สถานที่: ${data.jobInfo.location}`, MARGIN, iy);
  if (data.jobInfo.reporterName) pdf.text(`ผู้รายงาน: ${data.jobInfo.reporterName}`, PW - MARGIN, iy, { align: "right" });
}

function drawFooter(pdf: jsPDF, page: number, total: number) {
  const y = PH - MARGIN + 3;
  dc(pdf, BORDER); pdf.setLineWidth(0.25);
  pdf.line(MARGIN, y - 4, PW - MARGIN, y - 4);
  font(pdf, "normal", 7.5); tc(pdf, LIGHT);
  pdf.text(`หน้า ${page} / ${total}`, PW / 2, y, { align: "center" });
}

// ─── Page plan types ───────────────────────────────────────────────────────────
type Block =
  | { t: "cover" }
  | { t: "unit-hdr"; icon: string; catName: string; unitName: string }
  | { t: "col-lbl" }
  | { t: "pair"; before: PhotoItem | null; after: PhotoItem | null }
  | { t: "sub-lbl"; icon: string; catName: string; subName: string }
  | { t: "photo-row"; left: PhotoItem | null; right: PhotoItem | null }
  | { t: "gap"; h: number }
  | { t: "conclusion"; text: string }
  | { t: "closing" };

interface PDFPage { isCover: boolean; blocks: Block[] }

// ─── Main export ───────────────────────────────────────────────────────────────
interface PDFOptions { watermarkText?: string }

export async function downloadPDF(data: ReportData, options?: PDFOptions) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerFonts(pdf);
  await preloadAll(data);

  const ENTRY_EXIT_SUB_ID = "doc-1";
  let entryExitPhotos: PhotoItem[] = [];
  for (const cat of data.categories) {
    if (cat.type === "fixed-sub") {
      const sub = cat.subSections.find(s => s.id === ENTRY_EXIT_SUB_ID);
      if (sub?.photos.length) entryExitPhotos = sub.photos;
    }
  }

  const catsWithPhotos = data.categories.filter(cat => {
    if (cat.type === "unit-based")
      return cat.units.some(u => u.beforePhotos.length > 0 || u.afterPhotos.length > 0);
    return cat.subSections.some(s => s.id !== ENTRY_EXIT_SUB_ID && s.photos.length > 0);
  });

  // ── PASS 1 : build page plan ─────────────────────────────────────────────────
  const pages: PDFPage[] = [];
  let py = 0;

  const newPage = (cover = false) => {
    pages.push({ isCover: cover, blocks: [] });
    py = cover ? MARGIN : CONTENT_TOP;
  };
  const cur  = () => pages[pages.length - 1];
  const push = (b: Block, h: number) => { cur().blocks.push(b); py += h; };
  const fits = (h: number) => py + h <= CONTENT_BOTTOM;

  // Cover (always its own page)
  newPage(true);
  push({ t: "cover" }, 0);

  // Content starts on page 2 (cover must never share a page with content)
  if (catsWithPhotos.length > 0) newPage();

  // Categories
  for (const cat of catsWithPhotos) {

    if (cat.type === "unit-based") {
      for (const unit of cat.units) {
        if (!unit.beforePhotos.length && !unit.afterPhotos.length) continue;

        // Pair up before/after by index
        const maxLen = Math.max(unit.beforePhotos.length, unit.afterPhotos.length);
        const pairs: { before: PhotoItem | null; after: PhotoItem | null }[] = [];
        for (let i = 0; i < maxLen; i++) {
          pairs.push({
            before: unit.beforePhotos[i] ?? null,
            after:  unit.afterPhotos[i]  ?? null,
          });
        }

        // Start header for this unit (pack onto current page if space allows)
        if (!fits(UNIT_MIN)) newPage();
        push({ t: "unit-hdr", icon: cat.icon, catName: cat.name, unitName: unit.name }, UNIT_HDR_H);
        push({ t: "col-lbl" }, COL_LBL_H);

        for (const pair of pairs) {
          if (!fits(PAIR_H + PAIR_GAP)) {
            newPage();
            push({ t: "unit-hdr", icon: cat.icon, catName: cat.name, unitName: unit.name }, UNIT_HDR_H);
            push({ t: "col-lbl" }, COL_LBL_H);
          }
          push({ t: "pair", before: pair.before, after: pair.after }, PAIR_H);
          push({ t: "gap", h: PAIR_GAP }, PAIR_GAP);
        }
      }

    } else {
      // fixed-sub: photos shown in 2-col grid, no before/after pairing
      let firstSub = true;
      for (const sub of cat.subSections) {
        if (sub.id === ENTRY_EXIT_SUB_ID) continue;
        if (!sub.photos.length) continue;

        if (firstSub) {
          if (!fits(SUB_MIN)) newPage();
          firstSub = false;
        } else {
          if (!fits(SUB_MIN)) newPage();
        }

        push({ t: "sub-lbl", icon: cat.icon, catName: cat.name, subName: sub.name }, SUB_LBL_H);

        for (let i = 0; i < sub.photos.length; i += 2) {
          if (!fits(PAIR_H + PAIR_GAP)) {
            newPage();
            push({ t: "sub-lbl", icon: cat.icon, catName: cat.name, subName: sub.name + " (ต่อ)" }, SUB_LBL_H);
          }
          push({ t: "photo-row", left: sub.photos[i] ?? null, right: sub.photos[i + 1] ?? null }, PAIR_H);
          push({ t: "gap", h: PAIR_GAP }, PAIR_GAP);
        }
      }
    }
  }

  const CONCLUSION_MIN = 40;
  const CLOSING_MIN    = 50;

  if (data.conclusion?.trim()) {
    if (!fits(CONCLUSION_MIN)) newPage();
    push({ t: "conclusion", text: data.conclusion }, 0);
  }
  if (data.jobInfo.footerNote?.trim()) {
    if (!fits(CLOSING_MIN)) newPage();
    push({ t: "closing" }, 0);
  }

  const totalPages = pages.length;

  // ── PASS 2 : render ──────────────────────────────────────────────────────────
  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) pdf.addPage();
    const page   = pages[pi];
    const pageNo = pi + 1;
    let ry = page.isCover ? MARGIN : CONTENT_TOP;

    pdf.setFont("Sarabun", "normal");

    if (!page.isCover) {
      await drawHeader(pdf, data);
      drawFooter(pdf, pageNo, totalPages);
    }

    for (const b of page.blocks) {

      // ── Cover ────────────────────────────────────────────────────────────────
      if (b.t === "cover") {
        fc(pdf, NAVY); pdf.rect(0, 0, PW, 7, "F");
        ry = 15;

        if (data.jobInfo.logo) {
          const lsrc = IMG_B64_CACHE.get(data.jobInfo.logo) ?? data.jobInfo.logo;
          try {
            const asp = await getAspect(lsrc);
            const lh = 20, lw = asp * lh;
            pdf.addImage(lsrc, imgFormat(lsrc), (PW - lw) / 2, ry, lw, lh);
            ry += lh + 8;
          } catch { ry += 5; }
        }

        font(pdf, "bold", 26); tc(pdf, NAVY);
        pdf.text(data.jobInfo.subject || "รายงาน PM", PW / 2, ry, { align: "center" });
        ry += 7;
        dc(pdf, BLUE); pdf.setLineWidth(0.8);
        pdf.line(PW / 2 - 30, ry, PW / 2 + 30, ry);
        ry += 12;

        const rows = [
          ["ลูกค้า",     data.jobInfo.clientName],
          ["วันที่",     data.jobInfo.dateTime],
          ["สถานที่",    data.jobInfo.location],
          ["ผู้รายงาน", data.jobInfo.reporterName],
        ].filter(([, v]) => v) as [string,string][];

        if (rows.length) {
          const cardH = rows.length * 9 + 12;
          fc(pdf, [242, 247, 255]); dc(pdf, BORDER); pdf.setLineWidth(0.2);
          pdf.roundedRect(MARGIN + 6, ry - 4, CW - 12, cardH, 3, 3, "FD");
          fc(pdf, NAVY); pdf.rect(MARGIN + 6, ry - 4, 4, cardH, "F");
          for (const [label, value] of rows) {
            font(pdf, "bold", 10.5); tc(pdf, NAVY);
            pdf.text(`${label}:`, MARGIN + 15, ry + 3);
            font(pdf, "normal", 10.5); tc(pdf, DARK);
            pdf.text(value, MARGIN + 46, ry + 3);
            ry += 9;
          }
        }

        // Entry/exit photos on cover
        if (entryExitPhotos.length) {
          ry += 20;
          font(pdf, "bold", 12); tc(pdf, NAVY);
          pdf.text("📷  รูปเข้า-ออกงาน", MARGIN, ry);
          ry += 5;
          dc(pdf, BLUE); pdf.setLineWidth(0.4);
          pdf.line(MARGIN, ry, MARGIN + 24, ry);
          ry += 8;

          const shots = entryExitPhotos.slice(0, 4);
          const cellH = 50;
          for (let i = 0; i < shots.length; i += 2) {
            const rowPhotos = shots.slice(i, i + 2);
            const cnt   = rowPhotos.length;
            const cellW = cnt === 1 ? IMG_W * 1.25 : IMG_W;
            const startX = cnt === 1 ? MARGIN + (CW - cellW) / 2 : MARGIN;
            for (let j = 0; j < cnt; j++) {
              const photo  = rowPhotos[j];
              const x      = startX + j * (cellW + IMG_GAP);
              const imgSrc = IMG_B64_CACHE.get(photo.url) ?? photo.url;
              dc(pdf, BORDER); pdf.setLineWidth(0.25); pdf.rect(x, ry, cellW, cellH);
              if (imgSrc) {
                try {
                  const aspect    = await getAspect(imgSrc);
                  const cellRatio = cellW / cellH;
                  let dw: number, dh: number;
                  if (aspect >= cellRatio) { dw = cellW; dh = dw / aspect; }
                  else                     { dh = cellH; dw = dh * aspect; }
                  const ox = x + (cellW - dw) / 2;
                  const oy = ry + (cellH - dh) / 2;
                  const pt = (v: number) => (v * 72 / 25.4).toFixed(3);
                  pdf.saveGraphicsState();
                  pdf.internal.write(`${pt(x)} ${pt(PH - ry - cellH)} ${pt(cellW)} ${pt(cellH)} re W n`);
                  pdf.addImage(imgSrc, imgFormat(imgSrc), ox, oy, dw, dh, photo.id);
                  pdf.restoreGraphicsState();
                } catch { /* skip */ }
              }
            }
            ry += cellH + 5;
          }
        }

        fc(pdf, NAVY); pdf.rect(0, PH - 7, PW, 7, "F");
        font(pdf, "normal", 8); tc(pdf, WHITE);
        pdf.text(`หน้า 1 / ${totalPages}`, PW / 2, PH - 2.5, { align: "center" });
      }

      // ── Unit header bar ───────────────────────────────────────────────────────
      else if (b.t === "unit-hdr") {
        drawUnitHeader(pdf, b.icon, b.catName, b.unitName, data.jobInfo.dateTime || "", ry);
        ry += UNIT_HDR_H;
      }

      // ── Column labels ─────────────────────────────────────────────────────────
      else if (b.t === "col-lbl") {
        drawColLabels(pdf, ry);
        ry += COL_LBL_H;
      }

      // ── Photo pair row (before | after) ───────────────────────────────────────
      else if (b.t === "pair") {
        await drawCellImage(pdf, b.before, MARGIN,            ry, IMG_W, PAIR_H);
        await drawCellImage(pdf, b.after,  MARGIN + IMG_W + IMG_GAP, ry, IMG_W, PAIR_H);
        ry += PAIR_H;
      }

      // ── Subsection label (fixed-sub) ──────────────────────────────────────────
      else if (b.t === "sub-lbl") {
        drawSubLabel(pdf, b.icon, b.catName, b.subName, ry);
        ry += SUB_LBL_H;
      }

      // ── Photo row (fixed-sub, 2-col grid) ─────────────────────────────────────
      else if (b.t === "photo-row") {
        await drawCellImage(pdf, b.left,  MARGIN,            ry, IMG_W, PAIR_H);
        await drawCellImage(pdf, b.right, MARGIN + IMG_W + IMG_GAP, ry, IMG_W, PAIR_H);
        ry += PAIR_H;
      }

      // ── Gap ──────────────────────────────────────────────────────────────────
      else if (b.t === "gap") {
        ry += b.h;
      }

      // ── Conclusion ───────────────────────────────────────────────────────────
      else if (b.t === "conclusion") {
        ry = CONTENT_TOP;
        fc(pdf, LBLUE); pdf.rect(MARGIN, ry, CW, 8, "F");
        fc(pdf, BLUE);  pdf.rect(MARGIN, ry, 3, 8, "F");
        font(pdf, "bold", 9); tc(pdf, NAVY);
        pdf.text("📝  สรุปผลการทำงาน", MARGIN + 6, ry + 5.5);
        ry += 12;
        font(pdf, "normal", 11); tc(pdf, DARK);
        for (const line of pdf.splitTextToSize(b.text, CW - 4)) {
          if (ry + 7 > CONTENT_BOTTOM) break;
          pdf.text(line, MARGIN + 4, ry);
          ry += 6.5;
        }
      }

      // ── Closing ──────────────────────────────────────────────────────────────
      else if (b.t === "closing") {
        ry += 8;
        dc(pdf, BORDER); pdf.setLineWidth(0.3);
        pdf.line(MARGIN + 25, ry, PW - MARGIN - 25, ry);
        ry += 12;
        const noteLines = (data.jobInfo.footerNote || "").split(/\n/).map(l => l.trim()).filter(Boolean);
        font(pdf, "bold", 14); tc(pdf, NAVY);
        noteLines.forEach((line, i) => {
          pdf.text(line, PW / 2, ry + i * 10, { align: "center" });
        });
        const afterText = ry + noteLines.length * 10 + 8;
        pdf.setDrawColor(200, 200, 200);
        pdf.line(MARGIN + 25, afterText, PW - MARGIN - 25, afterText);
      }
    }
  }

  // ── Watermark ────────────────────────────────────────────────────────────────
  if (options?.watermarkText) {
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      font(pdf, "bold", 50); tc(pdf, [210, 210, 210]);
      pdf.saveGraphicsState();
      // @ts-ignore
      pdf.setGState(pdf.GState({ opacity: 0.12 }));
      pdf.text(options.watermarkText, PW / 2, PH / 2, { align: "center", angle: 45 });
      pdf.restoreGraphicsState();
    }
  }

  const fileName = `${data.jobInfo.clientName || "report"}_${new Date().toLocaleDateString("th-TH")}.pdf`;
  pdf.save(fileName);
}
