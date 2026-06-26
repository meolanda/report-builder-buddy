import { ReportData, PhotoItem } from "@/types/report";
import jsPDF from "jspdf";

// ─── A4 Layout Constants ───────────────────────────────────────────────────────
const PW        = 210;
const PH        = 297;
const MARGIN    = 15;
const CW        = PW - MARGIN * 2;          // 180mm usable width

const HDR_H     = 49;                        // header image (25) + info bar (24)
const IMG_HDR_H = 25;                        // header image portion
const INFO_BAR_H = 24;                       // navy info bar below image
const FTR_H     = 12;
const CONTENT_TOP    = HDR_H + MARGIN;       // y where content starts (non-cover)
const CONTENT_BOTTOM = PH - FTR_H - MARGIN;

// Photo grid
const IMG_GAP   = 5;
const IMG_W     = (CW - IMG_GAP) / 2;       // ~87.5mm
const IMG_H     = IMG_W * 0.75;             // 4:3 ratio ≈ 65.6mm
const ROW_H     = IMG_H + 10;               // photo row + caption space

// Minimum space before starting a section / subsection (header + 1 photo row)
const SEC_MIN   = 16 + ROW_H;
const SUB_MIN   = 12 + ROW_H;

// ─── Colours ───────────────────────────────────────────────────────────────────
const NAVY   : [number,number,number] = [30,  58,  95];
const BLUE   : [number,number,number] = [59,  130, 246];
const LBLUE  : [number,number,number] = [219, 234, 254];
const GREEN  : [number,number,number] = [16,  185, 129];
const WHITE  : [number,number,number] = [255, 255, 255];
const DARK   : [number,number,number] = [30,  30,  30];
const MID    : [number,number,number] = [90,  90,  90];
const LIGHT  : [number,number,number] = [160, 160, 160];
const BGCARD : [number,number,number] = [248, 250, 253];
const BORDER : [number,number,number] = [210, 220, 235];

// ─── Font helpers ──────────────────────────────────────────────────────────────
const FONT_CACHE: Record<string, string> = {};

async function loadFont(url: string): Promise<string> {
  if (FONT_CACHE[url]) return FONT_CACHE[url];
  const res   = await fetch(url);
  const buf   = await res.arrayBuffer();
  const u8    = new Uint8Array(buf);
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

  // Method 1: fetch + FileReader
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

  // Method 2: Image + canvas (handles CORS-restricted storage)
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

  // Method 3: return URL directly — let jsPDF try loading it
  return url;
}

async function getAspect(b64: string): Promise<number> {
  return new Promise(res => {
    const img    = new Image();
    img.onload   = () => res(img.width / img.height);
    img.onerror  = () => res(4 / 3);
    img.src      = b64;
  });
}

function imgFormat(b64: string): string {
  if (b64.includes("data:image/png"))  return "PNG";
  if (b64.includes("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function preloadAll(data: ReportData): Promise<Map<string, string>> {
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
  return IMG_B64_CACHE;
}

// ─── PDF drawing utilities ─────────────────────────────────────────────────────
function fc(pdf: jsPDF, c: [number,number,number]) { pdf.setFillColor(c[0], c[1], c[2]); }
function dc(pdf: jsPDF, c: [number,number,number]) { pdf.setDrawColor(c[0], c[1], c[2]); }
function tc(pdf: jsPDF, c: [number,number,number]) { pdf.setTextColor(c[0], c[1], c[2]); }
function font(pdf: jsPDF, w: "normal"|"bold", size: number) {
  pdf.setFont("Sarabun", w);
  pdf.setFontSize(size);
}

// Running header (every content page) — logo strip + navy info bar
async function drawHeader(pdf: jsPDF, data: ReportData) {
  // ── Logo strip (white background) ──────────────────────────────────────────
  fc(pdf, WHITE);
  pdf.rect(0, 0, PW, IMG_HDR_H, "F");

  // light bottom border of logo strip
  dc(pdf, [220, 225, 235]);
  pdf.setLineWidth(0.3);
  pdf.line(0, IMG_HDR_H, PW, IMG_HDR_H);

  const logoB64 = data.jobInfo.logo ? IMG_B64_CACHE.get(data.jobInfo.logo) : undefined;
  if (logoB64) {
    try {
      const aspect = await getAspect(logoB64);
      const lh = IMG_HDR_H - 6;            // fit within strip with padding
      const lw = aspect * lh;
      pdf.addImage(logoB64, imgFormat(logoB64), MARGIN, 3, lw, lh);
    } catch { /* skip */ }
  }

  // Subject text right-aligned in logo strip
  if (data.jobInfo.subject) {
    font(pdf, "bold", 10);
    tc(pdf, NAVY);
    pdf.text(data.jobInfo.subject, PW - MARGIN, IMG_HDR_H / 2 + 2, { align: "right" });
  }

  // ── Navy info bar ───────────────────────────────────────────────────────────
  fc(pdf, NAVY);
  pdf.rect(0, IMG_HDR_H, PW, INFO_BAR_H, "F");

  tc(pdf, WHITE);
  let iy = IMG_HDR_H + 8;
  font(pdf, "normal", 8.5);

  if (data.jobInfo.clientName)
    pdf.text(`ลูกค้า: ${data.jobInfo.clientName}`, MARGIN, iy);
  if (data.jobInfo.dateTime)
    pdf.text(`วันที่: ${data.jobInfo.dateTime}`, PW - MARGIN, iy, { align: "right" });
  iy += 6;
  if (data.jobInfo.location)
    pdf.text(`สถานที่: ${data.jobInfo.location}`, MARGIN, iy);
  if (data.jobInfo.reporterName)
    pdf.text(`ผู้รายงาน: ${data.jobInfo.reporterName}`, PW - MARGIN, iy, { align: "right" });
}

// Footer
function drawFooter(pdf: jsPDF, page: number, total: number) {
  const y = PH - MARGIN + 3;
  dc(pdf, BORDER);
  pdf.setLineWidth(0.25);
  pdf.line(MARGIN, y - 4, PW - MARGIN, y - 4);
  font(pdf, "normal", 7.5);
  tc(pdf, LIGHT);
  pdf.text(`หน้า ${page} / ${total}`, PW / 2, y, { align: "center" });
}

// Section banner (full-width navy + accent stripe)
function drawSectionBanner(pdf: jsPDF, icon: string, name: string, y: number): number {
  const bh = 13;
  fc(pdf, NAVY);  pdf.rect(MARGIN, y, CW, bh, "F");
  fc(pdf, BLUE);  pdf.rect(MARGIN, y, 4, bh, "F");
  font(pdf, "bold", 13);
  tc(pdf, WHITE);
  pdf.text(`${icon}  ${name}`, MARGIN + 8, y + 9);
  return bh;
}

// Sub-header (unit / subsection)
function drawSubHeader(pdf: jsPDF, name: string, y: number): number {
  const bh = 9;
  fc(pdf, LBLUE); pdf.setDrawColor(0,0,0,0); // no border
  pdf.rect(MARGIN, y, CW, bh, "F");
  fc(pdf, BLUE);  pdf.rect(MARGIN, y, 3.5, bh, "F");
  font(pdf, "bold", 10.5);
  tc(pdf, NAVY);
  pdf.text(name, MARGIN + 7, y + 6.5);
  return bh;
}

// Pill label (ก่อน / หลัง)
function drawPill(pdf: jsPDF, label: string, x: number, y: number, color: [number,number,number]) {
  font(pdf, "bold", 9);
  const tw = pdf.getTextWidth(label);
  fc(pdf, color);
  pdf.roundedRect(x, y - 4.5, tw + 7, 6, 1.5, 1.5, "F");
  tc(pdf, WHITE);
  pdf.text(label, x + 3.5, y);
  return tw + 7;
}

// Draw a single photo row (1 or 2 photos)
async function drawPhotoRow(pdf: jsPDF, photos: PhotoItem[], y: number) {
  const count = Math.min(photos.length, 2);
  // If only 1 photo, center it
  const cellW  = count === 1 ? IMG_W * 1.25 : IMG_W;
  const startX = count === 1 ? MARGIN + (CW - cellW) / 2 : MARGIN;

  for (let j = 0; j < count; j++) {
    const photo = photos[j];
    const x     = startX + j * (cellW + IMG_GAP);
    const imgSrc = IMG_B64_CACHE.get(photo.url) ?? photo.url;

    // Photo border only (no fill background)
    dc(pdf, [200, 205, 215]); pdf.setLineWidth(0.25);
    pdf.rect(x, y, cellW, IMG_H);

    if (imgSrc) {
      try {
        const aspect = await getAspect(imgSrc);
        let dw = cellW - 2, dh = dw / aspect;
        if (dh > IMG_H - 2) { dh = IMG_H - 2; dw = dh * aspect; }
        pdf.addImage(imgSrc, imgFormat(imgSrc),
          x + (cellW - dw) / 2,
          y + (IMG_H - dh) / 2,
          dw, dh);
      } catch {
        font(pdf, "normal", 8); tc(pdf, LIGHT);
        pdf.text("ไม่พบรูปภาพ", x + cellW / 2, y + IMG_H / 2, { align: "center" });
      }
    }

    // Caption centered under photo
    if (photo.caption) {
      font(pdf, "normal", 7); tc(pdf, MID);
      const lines = pdf.splitTextToSize(photo.caption, cellW);
      pdf.text(lines[0], x + cellW / 2, y + IMG_H + 4.5, { align: "center" });
    }
  }
}

// ─── Page plan types ───────────────────────────────────────────────────────────
type Block =
  | { t: "cover" }
  | { t: "hdr"; catIdx: number }                                  // section banner
  | { t: "sub"; label: string }                                   // sub-header
  | { t: "pill"; label: string; color: [number,number,number] }
  | { t: "row"; photos: PhotoItem[] }
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

  const catsWithPhotos = data.categories.filter(cat => {
    if (cat.type === "unit-based")
      return cat.units.some(u => u.beforePhotos.length > 0 || u.afterPhotos.length > 0);
    return cat.subSections.some(s => s.photos.length > 0);
  });

  // ── PASS 1 : build page plan ─────────────────────────────────────────────────
  const pages: PDFPage[] = [];
  let py = 0;

  const newPage = (cover = false) => {
    pages.push({ isCover: cover, blocks: [] });
    py = cover ? MARGIN : CONTENT_TOP;
  };
  const cur   = () => pages[pages.length - 1];
  const push  = (b: Block, h: number) => { cur().blocks.push(b); py += h; };
  const fits  = (h: number) => py + h <= CONTENT_BOTTOM;

  // Cover
  newPage(true);
  push({ t: "cover" }, 0);

  // Categories
  for (let ci = 0; ci < catsWithPhotos.length; ci++) {
    const cat = catsWithPhotos[ci];
    newPage();                                   // every section → new page
    push({ t: "hdr", catIdx: ci }, 16);

    if (cat.type === "unit-based") {
      for (const unit of cat.units) {
        if (!unit.beforePhotos.length && !unit.afterPhotos.length) continue;
        if (!fits(SUB_MIN)) { newPage(); push({ t: "hdr", catIdx: ci }, 16); }
        push({ t: "sub", label: unit.name }, 12);

        const addGroup = (photos: PhotoItem[], pill: string, color: [number,number,number]) => {
          if (!photos.length) return;
          if (!fits(8 + ROW_H)) { newPage(); push({ t: "hdr", catIdx: ci }, 16); push({ t: "sub", label: unit.name }, 12); }
          push({ t: "pill", label: pill, color }, 8);
          for (let i = 0; i < photos.length; i += 2) {
            if (!fits(ROW_H)) { newPage(); push({ t: "hdr", catIdx: ci }, 16); }
            push({ t: "row", photos: photos.slice(i, i + 2) }, ROW_H);
          }
          push({ t: "gap", h: 3 }, 3);
        };
        addGroup(unit.beforePhotos, "ก่อน", BLUE);
        addGroup(unit.afterPhotos,  "หลัง", GREEN);
        push({ t: "gap", h: 4 }, 4);
      }
    } else {
      for (const sub of cat.subSections) {
        if (!sub.photos.length) continue;
        if (!fits(SUB_MIN)) { newPage(); push({ t: "hdr", catIdx: ci }, 16); }
        push({ t: "sub", label: sub.name }, 12);
        for (let i = 0; i < sub.photos.length; i += 2) {
          if (!fits(ROW_H)) { newPage(); push({ t: "hdr", catIdx: ci }, 16); }
          push({ t: "row", photos: sub.photos.slice(i, i + 2) }, ROW_H);
        }
        push({ t: "gap", h: 4 }, 4);
      }
    }
  }

  if (data.conclusion?.trim()) {
    newPage();
    push({ t: "conclusion", text: data.conclusion }, 0);
  }
  if (data.jobInfo.footerNote?.trim()) {
    newPage();
    push({ t: "closing" }, 0);
  }

  const totalPages = pages.length;
  const catPageMap = new Map<number, number>();   // catIdx → page number

  // ── PASS 2 : render ──────────────────────────────────────────────────────────
  let coverTocY   = 0;
  let coverPageNo = 1;

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) pdf.addPage();
    const page   = pages[pi];
    const pageNo = pi + 1;
    let ry = page.isCover ? MARGIN : CONTENT_TOP;

    // Ensure font is active after addPage
    pdf.setFont("Sarabun", "normal");

    if (!page.isCover) {
      await drawHeader(pdf, data);
      drawFooter(pdf, pageNo, totalPages);
    }

    for (const b of page.blocks) {

      // ── Cover ────────────────────────────────────────────────────────────────
      if (b.t === "cover") {
        // Top navy bar
        fc(pdf, NAVY); pdf.rect(0, 0, PW, 7, "F");

        ry = 15;

        // Logo
        if (data.jobInfo.logo) {
          const lsrc = IMG_B64_CACHE.get(data.jobInfo.logo) ?? data.jobInfo.logo;
          try {
            const asp = await getAspect(lsrc);
            const lh = 20, lw = asp * lh;
            pdf.addImage(lsrc, imgFormat(lsrc), (PW - lw) / 2, ry, lw, lh);
            ry += lh + 8;
          } catch { ry += 5; }
        }

        // Title
        font(pdf, "bold", 26); tc(pdf, NAVY);
        pdf.text(data.jobInfo.subject || "รายงาน PM", PW / 2, ry, { align: "center" });
        ry += 7;
        dc(pdf, BLUE); pdf.setLineWidth(0.8);
        pdf.line(PW / 2 - 30, ry, PW / 2 + 30, ry);
        ry += 12;

        // Info card
        const rows = [
          ["ลูกค้า",     data.jobInfo.clientName],
          ["วันที่",     data.jobInfo.dateTime],
          ["สถานที่",    data.jobInfo.location],
          ["ผู้รายงาน", data.jobInfo.reporterName],
        ].filter(([, v]) => v) as [string,string][];

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
        ry += 14;

        // TOC header
        font(pdf, "bold", 12); tc(pdf, NAVY);
        pdf.text("สารบัญ", MARGIN, ry);
        ry += 5;
        dc(pdf, BLUE); pdf.setLineWidth(0.4);
        pdf.line(MARGIN, ry, MARGIN + 24, ry);
        ry += 8;

        coverTocY   = ry;
        coverPageNo = pageNo;

        // Reserve TOC lines (category rows + sub-section rows)
        const subCount = catsWithPhotos.reduce((n, cat) =>
          n + (cat.type === "fixed-sub" ? cat.subSections.filter(s => s.photos.length > 0).length : 0), 0);
        ry += catsWithPhotos.length * 8 + subCount * 6.5 + (data.conclusion ? 8 : 0) + 4;

        // Bottom bar
        fc(pdf, NAVY); pdf.rect(0, PH - 7, PW, 7, "F");
        font(pdf, "normal", 8); tc(pdf, WHITE);
        pdf.text(`หน้า 1 / ${totalPages}`, PW / 2, PH - 2.5, { align: "center" });
      }

      // ── Section banner ───────────────────────────────────────────────────────
      else if (b.t === "hdr") {
        const cat = catsWithPhotos[b.catIdx];
        if (!catPageMap.has(b.catIdx)) catPageMap.set(b.catIdx, pageNo);
        const bh = drawSectionBanner(pdf, cat.icon, cat.name, ry);
        ry += bh + 6;
      }

      // ── Sub-header ───────────────────────────────────────────────────────────
      else if (b.t === "sub") {
        const bh = drawSubHeader(pdf, b.label, ry);
        ry += bh + 4;
      }

      // ── Pill ─────────────────────────────────────────────────────────────────
      else if (b.t === "pill") {
        drawPill(pdf, b.label, MARGIN + 2, ry + 4, b.color);
        ry += 8;
      }

      // ── Photo row ────────────────────────────────────────────────────────────
      else if (b.t === "row") {
        await drawPhotoRow(pdf, b.photos, ry);
        ry += ROW_H;
      }

      // ── Gap ──────────────────────────────────────────────────────────────────
      else if (b.t === "gap") {
        ry += b.h;
      }

      // ── Conclusion ───────────────────────────────────────────────────────────
      else if (b.t === "conclusion") {
        await drawHeader(pdf, data);
        drawFooter(pdf, pageNo, totalPages);
        ry = CONTENT_TOP;
        const bh = drawSectionBanner(pdf, "📝", "สรุปผลการทำงาน", ry);
        ry += bh + 10;
        font(pdf, "normal", 11); tc(pdf, DARK);
        for (const line of pdf.splitTextToSize(b.text, CW - 4)) {
          if (ry + 7 > CONTENT_BOTTOM) break;
          pdf.text(line, MARGIN + 4, ry);
          ry += 6.5;
        }
      }

      // ── Closing ──────────────────────────────────────────────────────────────
      else if (b.t === "closing") {
        fc(pdf, NAVY); pdf.rect(0, 0, PW, 7, "F");
        fc(pdf, NAVY); pdf.rect(0, PH - 7, PW, 7, "F");
        const cy = PH / 2 - 15;
        dc(pdf, BORDER); pdf.setLineWidth(0.3);
        pdf.line(MARGIN + 25, cy, PW - MARGIN - 25, cy);
        font(pdf, "bold", 15); tc(pdf, NAVY);
        pdf.text(data.jobInfo.footerNote, PW / 2, cy + 14, { align: "center" });
        font(pdf, "normal", 8.5); tc(pdf, MID);
        pdf.text("หากพบปัญหาการใช้งาน กรุณาติดต่อทีมงาน", PW / 2, cy + 24, { align: "center" });
        pdf.setDrawColor(200, 200, 200);
        pdf.line(MARGIN + 25, cy + 30, PW - MARGIN - 25, cy + 30);
        font(pdf, "normal", 7.5); tc(pdf, LIGHT);
        pdf.text(`หน้า ${pageNo} / ${totalPages}`, PW / 2, PH - 3, { align: "center" });
      }
    }
  }

  // ── Fill TOC on cover page ───────────────────────────────────────────────────
  pdf.setPage(coverPageNo);
  let ty = coverTocY;

  const drawTocRow = (label: string, pgLabel: string, indent: number, bold: boolean) => {
    font(pdf, bold ? "bold" : "normal", bold ? 10.5 : 9.5);
    tc(pdf, bold ? DARK : MID);
    pdf.text(label, MARGIN + 4 + indent, ty);
    const lx = MARGIN + 4 + indent + pdf.getTextWidth(label) + 3;
    const rx = PW - MARGIN - pdf.getTextWidth(pgLabel) - 3;
    tc(pdf, BORDER);
    for (let dx = lx; dx < rx; dx += 2.2) pdf.text(".", dx, ty);
    font(pdf, "bold", bold ? 10.5 : 9.5);
    tc(pdf, BLUE);
    pdf.text(pgLabel, PW - MARGIN, ty, { align: "right" });
    ty += bold ? 8 : 6.5;
  };

  for (let ci = 0; ci < catsWithPhotos.length; ci++) {
    const cat = catsWithPhotos[ci];
    const pg  = catPageMap.get(ci) ?? 1;
    drawTocRow(`${cat.icon}  ${cat.name}`, `หน้า ${pg}`, 0, true);

    // Sub-sections for fixed-sub categories
    if (cat.type === "fixed-sub") {
      for (const sub of cat.subSections) {
        if (!sub.photos.length) continue;
        // find which page this sub is on from the page plan
        const subPage = (() => {
          for (let pi2 = 0; pi2 < pages.length; pi2++) {
            if (pages[pi2].blocks.some(b => b.t === "sub" && b.label === sub.name))
              return pi2 + 1;
          }
          return pg;
        })();
        drawTocRow(`  •  ${sub.name}`, `หน้า ${subPage}`, 6, false);
      }
    }
  }

  if (data.conclusion?.trim()) {
    const cPage = pages.findIndex(p => p.blocks.some(b => b.t === "conclusion")) + 1;
    drawTocRow("📝  สรุปผล", `หน้า ${cPage}`, 0, true);
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
