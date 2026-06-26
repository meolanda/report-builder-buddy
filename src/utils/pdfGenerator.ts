import { ReportData } from "@/types/report";
import jsPDF from "jspdf";

// ─── Constants ────────────────────────────────────────────────────────────────
const PW = 210;          // page width  (A4)
const PH = 297;          // page height (A4)
const M  = 14;           // margin
const CW = PW - M * 2;  // content width

const HEADER_H = 10;     // running header height (pages 2+)
const FOOTER_H = 10;     // footer height
const CONTENT_TOP    = M + HEADER_H + 4;
const CONTENT_BOTTOM = PH - M - FOOTER_H;

// Photo grid
const IMG_GAP  = 5;
const IMG_W    = (CW - IMG_GAP) / 2;
const IMG_H    = IMG_W * 0.72;

// Colours
const C = {
  navy:      [30,  58,  95]  as [number,number,number],
  blue:      [59,  130, 246] as [number,number,number],
  lightBlue: [219, 234, 254] as [number,number,number],
  white:     [255, 255, 255] as [number,number,number],
  darkText:  [30,  30,  30]  as [number,number,number],
  midText:   [80,  80,  80]  as [number,number,number],
  lightText: [150, 150, 150] as [number,number,number],
  bg:        [248, 250, 253] as [number,number,number],
  border:    [210, 220, 235] as [number,number,number],
};

// ─── Font helpers ─────────────────────────────────────────────────────────────
async function loadFont(url: string): Promise<string> {
  const res  = await fetch(url);
  const buf  = await res.arrayBuffer();
  const u8   = new Uint8Array(buf);
  const chunk = 0x8000;
  let b64 = "";
  for (let i = 0; i < u8.length; i += chunk)
    b64 += String.fromCharCode(...u8.subarray(i, i + chunk));
  return btoa(b64);
}

async function registerFont(pdf: jsPDF) {
  const [reg, bold] = await Promise.all([
    loadFont("/fonts/Sarabun-Regular.ttf"),
    loadFont("/fonts/Sarabun-Bold.ttf"),
  ]);
  pdf.addFileToVFS("Sarabun-Regular.ttf", reg);
  pdf.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  pdf.addFileToVFS("Sarabun-Bold.ttf", bold);
  pdf.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  pdf.setFont("Sarabun", "normal");
}

// ─── Image helpers ────────────────────────────────────────────────────────────
const toBase64 = (src: string): Promise<string> =>
  src.startsWith("data:") ? Promise.resolve(src) :
  fetch(src, { mode: "cors" })
    .then(r => r.blob())
    .then(b => new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.onerror   = rej;
      fr.readAsDataURL(b);
    }));

const getImgDimensions = (src: string): Promise<{w:number;h:number}> =>
  new Promise(res => {
    const img = new Image();
    img.onload  = () => res({ w: img.width, h: img.height });
    img.onerror = () => res({ w: 1, h: 1 });
    img.src = src;
  });

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function setFill(pdf: jsPDF, c: [number,number,number]) {
  pdf.setFillColor(c[0], c[1], c[2]);
}
function setDraw(pdf: jsPDF, c: [number,number,number]) {
  pdf.setDrawColor(c[0], c[1], c[2]);
}
function setColor(pdf: jsPDF, c: [number,number,number]) {
  pdf.setTextColor(c[0], c[1], c[2]);
}

// Thin running header (pages 2+)
function drawRunningHeader(pdf: jsPDF, subject: string, client: string) {
  setFill(pdf, C.navy);
  pdf.rect(0, 0, PW, HEADER_H, "F");
  pdf.setFont("Sarabun", "bold");
  pdf.setFontSize(8);
  setColor(pdf, C.white);
  pdf.text(subject || "รายงาน PM", M, 6.5);
  pdf.setFont("Sarabun", "normal");
  pdf.text(client ? `ลูกค้า: ${client}` : "", PW - M, 6.5, { align: "right" });
}

// Footer with page number
function drawFooter(pdf: jsPDF, page: number, total: number, reporter: string) {
  const y = PH - M - 2;
  setDraw(pdf, C.border);
  pdf.setLineWidth(0.25);
  pdf.line(M, y - 4, PW - M, y - 4);
  pdf.setFont("Sarabun", "normal");
  pdf.setFontSize(7.5);
  setColor(pdf, C.lightText);
  if (reporter) pdf.text(`ผู้รายงาน: ${reporter}`, M, y);
  pdf.text(`หน้า ${page} / ${total}`, PW / 2, y, { align: "center" });
}

// Bold section banner
function drawSectionBanner(pdf: jsPDF, icon: string, name: string, y: number) {
  const bh = 13;
  setFill(pdf, C.navy);
  pdf.rect(M, y, CW, bh, "F");
  // accent stripe
  setFill(pdf, C.blue);
  pdf.rect(M, y, 3.5, bh, "F");
  pdf.setFont("Sarabun", "bold");
  pdf.setFontSize(13);
  setColor(pdf, C.white);
  pdf.text(`${icon}  ${name}`, M + 7, y + 9);
  return bh;
}

// Sub-header (unit / subsection name)
function drawSubHeader(pdf: jsPDF, name: string, y: number) {
  const bh = 9;
  setFill(pdf, C.lightBlue);
  setDraw(pdf, C.blue);
  pdf.setLineWidth(0.2);
  pdf.rect(M, y, CW, bh, "FD");
  setFill(pdf, C.blue);
  pdf.rect(M, y, 2.5, bh, "F");
  pdf.setFont("Sarabun", "bold");
  pdf.setFontSize(10.5);
  setColor(pdf, C.navy);
  pdf.text(name, M + 6, y + 6.5);
  return bh;
}

// Pill label (ก่อน / หลัง)
function drawPillLabel(pdf: jsPDF, label: string, x: number, y: number, color: [number,number,number]) {
  const tw = pdf.getTextWidth(label);
  const pw = tw + 6, ph = 5.5;
  setFill(pdf, color);
  pdf.roundedRect(x, y - 4, pw, ph, 1.5, 1.5, "F");
  pdf.setFont("Sarabun", "bold");
  pdf.setFontSize(8.5);
  setColor(pdf, C.white);
  pdf.text(label, x + 3, y - 0.2);
  return pw;
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface PDFOptions { watermarkText?: string; }

export async function downloadPDF(data: ReportData, options?: PDFOptions) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerFont(pdf);

  // ── Pre-load all images as base64 ─────────────────────────────────────────
  const imgCache = new Map<string, string>();
  const allUrls: string[] = [];

  for (const cat of data.categories) {
    if (cat.type === "unit-based") {
      for (const u of cat.units) {
        for (const p of [...u.beforePhotos, ...u.afterPhotos]) allUrls.push(p.url);
      }
    } else {
      for (const s of cat.subSections) {
        for (const p of s.photos) allUrls.push(p.url);
      }
    }
  }

  await Promise.all(allUrls.map(async url => {
    try { imgCache.set(url, await toBase64(url)); } catch { /* skip */ }
  }));

  // ─────────────────────────────────────────────────────────────────────────
  // Build page plan
  // Each structure element: { pageIndex, type, ... }
  // We render in two passes: first calculate pages, then draw.
  // ─────────────────────────────────────────────────────────────────────────

  type Block =
    | { type: "cover" }
    | { type: "section-start"; catIdx: number }
    | { type: "sub-header"; label: string }
    | { type: "pill"; label: string; color: [number,number,number] }
    | { type: "photo-row"; photos: {url:string;caption:string}[] }
    | { type: "gap"; size: number }
    | { type: "conclusion"; text: string }
    | { type: "closing" };

  interface Page { isCover: boolean; blocks: Block[] }

  const pages: Page[] = [];
  const addPage = (cover = false) => {
    pages.push({ isCover: cover, blocks: [] });
  };
  const cur = () => pages[pages.length - 1];

  // current Y tracker (only used during planning, not actual rendering)
  let py = 0;

  const resetY = () => { py = CONTENT_TOP; };

  const need = (h: number): boolean => py + h > CONTENT_BOTTOM;

  const push = (block: Block, h: number) => {
    cur().blocks.push(block);
    py += h;
  };

  const categoriesWithPhotos = data.categories.filter(cat => {
    if (cat.type === "unit-based") return cat.units.some(u => u.beforePhotos.length > 0 || u.afterPhotos.length > 0);
    return cat.subSections.some(s => s.photos.length > 0);
  });

  // Cover page
  addPage(true);
  cur().blocks.push({ type: "cover" });

  // Category sections
  for (let ci = 0; ci < categoriesWithPhotos.length; ci++) {
    const cat = categoriesWithPhotos[ci];

    // New page for every section
    addPage();
    resetY();
    push({ type: "section-start", catIdx: ci }, 20);

    if (cat.type === "unit-based") {
      for (const unit of cat.units) {
        if (unit.beforePhotos.length === 0 && unit.afterPhotos.length === 0) continue;

        // Sub-header — if no room for header + at least 1 photo row, new page
        if (need(9 + 7 + IMG_H + 8)) { addPage(); resetY(); push({ type: "section-start", catIdx: ci }, 20); }
        push({ type: "sub-header", label: unit.name }, 12);

        const addPhotoGroup = (photos: {url:string;caption:string}[], pillLabel: string, pillColor: [number,number,number]) => {
          if (photos.length === 0) return;
          if (need(7 + IMG_H + 8)) { addPage(); resetY(); push({ type: "section-start", catIdx: ci }, 20); push({ type: "sub-header", label: unit.name }, 12); }
          push({ type: "pill", label: pillLabel, color: pillColor }, 7);
          for (let i = 0; i < photos.length; i += 2) {
            if (need(IMG_H + 8)) { addPage(); resetY(); push({ type: "section-start", catIdx: ci }, 20); }
            push({ type: "photo-row", photos: photos.slice(i, i + 2) }, IMG_H + 10);
          }
          push({ type: "gap", size: 4 }, 4);
        };

        addPhotoGroup(unit.beforePhotos, "ก่อน",  [59, 130, 246]);
        addPhotoGroup(unit.afterPhotos,  "หลัง",  [16, 185, 129]);
        push({ type: "gap", size: 4 }, 4);
      }
    } else {
      for (const sub of cat.subSections) {
        if (sub.photos.length === 0) continue;
        if (need(9 + IMG_H + 8)) { addPage(); resetY(); push({ type: "section-start", catIdx: ci }, 20); }
        push({ type: "sub-header", label: sub.name }, 12);
        for (let i = 0; i < sub.photos.length; i += 2) {
          if (need(IMG_H + 8)) { addPage(); resetY(); push({ type: "section-start", catIdx: ci }, 20); }
          push({ type: "photo-row", photos: sub.photos.slice(i, i + 2) }, IMG_H + 10);
        }
        push({ type: "gap", size: 4 }, 4);
      }
    }
  }

  // Conclusion
  if (data.conclusion) {
    addPage();
    resetY();
    cur().blocks.push({ type: "conclusion", text: data.conclusion });
  }

  // Closing
  if (data.jobInfo.footerNote) {
    addPage();
    cur().blocks.push({ type: "closing" });
  }

  const totalPages = pages.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const tocEntries: { name: string; icon: string; page: number }[] = [];

  // Map catIdx -> page number (filled during render)
  const catPageMap = new Map<number, number>();

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) pdf.addPage();
    const page = pages[pi];
    const pageNum = pi + 1;

    let ry = page.isCover ? M : CONTENT_TOP;

    if (!page.isCover) {
      drawRunningHeader(pdf, data.jobInfo.subject || "รายงาน PM", data.jobInfo.clientName || "");
      drawFooter(pdf, pageNum, totalPages, data.jobInfo.reporterName || "");
    }

    for (const block of page.blocks) {
      // ── Cover ──────────────────────────────────────────────────────────
      if (block.type === "cover") {
        // Top accent
        setFill(pdf, C.navy);
        pdf.rect(0, 0, PW, 6, "F");

        ry = 14;

        // Logo left
        let logoEndX = M;
        if (data.jobInfo.logo) {
          try {
            const b64  = await toBase64(data.jobInfo.logo);
            const dim  = await getImgDimensions(data.jobInfo.logo);
            const lh   = 18, lw = (dim.w / dim.h) * lh;
            pdf.addImage(b64, "PNG", M, ry, lw, lh);
            logoEndX = M + lw + 6;
          } catch { /* skip */ }
        }

        // Company logo right (if exists as second logo field — gracefully skip)
        ry += 22;

        // Title
        pdf.setFont("Sarabun", "bold");
        pdf.setFontSize(28);
        setColor(pdf, C.navy);
        pdf.text(data.jobInfo.subject || "รายงาน PM", PW / 2, ry, { align: "center" });
        ry += 6;

        // Divider
        setDraw(pdf, C.blue);
        pdf.setLineWidth(0.8);
        pdf.line(M + 20, ry, PW - M - 20, ry);
        ry += 12;

        // Info block
        const infoRows = [
          ["ลูกค้า",      data.jobInfo.clientName],
          ["วันที่",      data.jobInfo.dateTime],
          ["สถานที่",     data.jobInfo.location],
          ["ผู้รายงาน",  data.jobInfo.reporterName],
        ].filter(([, v]) => v) as [string, string][];

        const infoH = infoRows.length * 9 + 10;
        setFill(pdf, C.bg);
        setDraw(pdf, C.border);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(M + 8, ry - 4, CW - 16, infoH, 3, 3, "FD");
        // left accent
        setFill(pdf, C.navy);
        pdf.roundedRect(M + 8, ry - 4, 3, infoH, 1, 1, "F");

        for (const [label, value] of infoRows) {
          pdf.setFont("Sarabun", "bold");
          pdf.setFontSize(10.5);
          setColor(pdf, C.navy);
          pdf.text(`${label}:`, M + 16, ry + 2.5);
          pdf.setFont("Sarabun", "normal");
          setColor(pdf, C.darkText);
          pdf.text(value, M + 44, ry + 2.5);
          ry += 9;
        }
        ry += 10;

        // TOC header
        pdf.setFont("Sarabun", "bold");
        pdf.setFontSize(12);
        setColor(pdf, C.navy);
        pdf.text("สารบัญ", M, ry);
        ry += 4;
        setDraw(pdf, C.blue);
        pdf.setLineWidth(0.4);
        pdf.line(M, ry, M + 22, ry);
        ry += 8;

        // TOC rows (after render we'll have catPageMap)
        // We store this Y so we can go back and fill it in
        // Actually: fill now using catPageMap values which are set later.
        // Instead just store and do a second pass below.
        // For now, mark placeholder — we'll fill after all pages rendered.
        (block as any)._tocY = ry;
        (block as any)._tocPage = pageNum;
        ry += categoriesWithPhotos.length * 8 + (data.conclusion ? 8 : 0) + 6;

        // Bottom accent
        setFill(pdf, C.navy);
        pdf.rect(0, PH - 6, PW, 6, "F");
        pdf.setFont("Sarabun", "normal");
        pdf.setFontSize(8);
        setColor(pdf, [255,255,255]);
        pdf.text(`หน้า 1 / ${totalPages}`, PW / 2, PH - 2.5, { align: "center" });
      }

      // ── Section start ──────────────────────────────────────────────────
      else if (block.type === "section-start") {
        const cat = categoriesWithPhotos[block.catIdx];
        if (!catPageMap.has(block.catIdx)) catPageMap.set(block.catIdx, pageNum);
        const bh = drawSectionBanner(pdf, cat.icon, cat.name, ry);
        ry += bh + 6;
      }

      // ── Sub-header ─────────────────────────────────────────────────────
      else if (block.type === "sub-header") {
        const bh = drawSubHeader(pdf, block.label, ry);
        ry += bh + 4;
      }

      // ── Pill ───────────────────────────────────────────────────────────
      else if (block.type === "pill") {
        drawPillLabel(pdf, block.label, M + 2, ry + 4, block.color);
        ry += 7;
      }

      // ── Photo row ──────────────────────────────────────────────────────
      else if (block.type === "photo-row") {
        for (let j = 0; j < block.photos.length; j++) {
          const ph   = block.photos[j];
          const x    = M + j * (IMG_W + IMG_GAP);
          const b64  = imgCache.get(ph.url);

          // Card background
          setFill(pdf, [252, 253, 255]);
          setDraw(pdf, C.border);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(x, ry, IMG_W, IMG_H, 2, 2, "FD");

          if (b64) {
            try {
              const dim  = await getImgDimensions(ph.url);
              const ratio = dim.w / dim.h;
              let dw = IMG_W - 2, dh = dw / ratio;
              if (dh > IMG_H - 2) { dh = IMG_H - 2; dw = dh * ratio; }
              pdf.addImage(b64, "JPEG", x + (IMG_W - dw) / 2, ry + (IMG_H - dh) / 2, dw, dh);
            } catch { /* placeholder already drawn */ }
          } else {
            pdf.setFont("Sarabun", "normal");
            pdf.setFontSize(8);
            setColor(pdf, C.lightText);
            pdf.text("ไม่พบรูปภาพ", x + IMG_W / 2, ry + IMG_H / 2, { align: "center" });
          }

          // Caption
          if (ph.caption) {
            pdf.setFont("Sarabun", "normal");
            pdf.setFontSize(7);
            setColor(pdf, C.midText);
            const lines = pdf.splitTextToSize(ph.caption, IMG_W - 2);
            pdf.text(lines[0] || "", x + IMG_W / 2, ry + IMG_H + 4, { align: "center" });
          }
        }
        ry += IMG_H + 10;
      }

      // ── Gap ────────────────────────────────────────────────────────────
      else if (block.type === "gap") {
        ry += block.size;
      }

      // ── Conclusion ─────────────────────────────────────────────────────
      else if (block.type === "conclusion") {
        drawRunningHeader(pdf, data.jobInfo.subject || "รายงาน PM", data.jobInfo.clientName || "");
        drawFooter(pdf, pageNum, totalPages, data.jobInfo.reporterName || "");

        ry = CONTENT_TOP;
        const bh = drawSectionBanner(pdf, "📝", "สรุปผลการทำงาน", ry);
        ry += bh + 8;

        pdf.setFont("Sarabun", "normal");
        pdf.setFontSize(11);
        setColor(pdf, C.darkText);
        const lines = pdf.splitTextToSize(block.text, CW - 4);
        for (const line of lines) {
          if (ry + 7 > CONTENT_BOTTOM) break;
          pdf.text(line, M + 2, ry);
          ry += 6.5;
        }
      }

      // ── Closing ────────────────────────────────────────────────────────
      else if (block.type === "closing") {
        setFill(pdf, C.navy);
        pdf.rect(0, 0, PW, 6, "F");
        setFill(pdf, C.navy);
        pdf.rect(0, PH - 6, PW, 6, "F");

        const cy = PH / 2 - 18;
        setDraw(pdf, C.border);
        pdf.setLineWidth(0.3);
        pdf.line(M + 25, cy, PW - M - 25, cy);

        pdf.setFont("Sarabun", "bold");
        pdf.setFontSize(14);
        setColor(pdf, C.navy);
        pdf.text(data.jobInfo.footerNote || "ขอบคุณที่ไว้วางใจใช้บริการ", PW / 2, cy + 12, { align: "center" });

        pdf.setFont("Sarabun", "normal");
        pdf.setFontSize(9);
        setColor(pdf, C.midText);
        pdf.text("หากพบปัญหาการใช้งาน กรุณาติดต่อทีมงาน", PW / 2, cy + 22, { align: "center" });

        pdf.setDrawColor(200,200,200);
        pdf.line(M + 25, cy + 28, PW - M - 25, cy + 28);

        pdf.setFontSize(7.5);
        setColor(pdf, C.lightText);
        pdf.text(`หน้า ${pageNum} / ${totalPages}`, PW / 2, PH - 3, { align: "center" });
      }
    }
  }

  // ─── Fill TOC on cover page ───────────────────────────────────────────────
  const coverBlock = pages[0].blocks[0] as any;
  if (coverBlock?._tocY !== undefined) {
    pdf.setPage(1);
    let ty = coverBlock._tocY as number;

    for (let ci = 0; ci < categoriesWithPhotos.length; ci++) {
      const cat  = categoriesWithPhotos[ci];
      const pg   = catPageMap.get(ci) ?? 1;
      const label = `${cat.icon}  ${cat.name}`;
      const pgLabel = `หน้า ${pg}`;

      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(10.5);
      setColor(pdf, C.darkText);
      pdf.text(label, M + 4, ty);

      // dots
      const lx = M + 4 + pdf.getTextWidth(label) + 2;
      const rx = PW - M - pdf.getTextWidth(pgLabel) - 3;
      setColor(pdf, C.border);
      for (let dx = lx; dx < rx; dx += 2.2) pdf.text(".", dx, ty);

      pdf.setFont("Sarabun", "bold");
      setColor(pdf, C.blue);
      pdf.text(pgLabel, PW - M, ty, { align: "right" });
      ty += 8;
    }

    if (data.conclusion) {
      const cPage = pages.findIndex(p => p.blocks.some(b => b.type === "conclusion")) + 1;
      const pgLabel = `หน้า ${cPage}`;
      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(10.5);
      setColor(pdf, C.darkText);
      pdf.text("📝  สรุปผล", M + 4, ty);
      const lx = M + 4 + pdf.getTextWidth("📝  สรุปผล") + 2;
      const rx = PW - M - pdf.getTextWidth(pgLabel) - 3;
      setColor(pdf, C.border);
      for (let dx = lx; dx < rx; dx += 2.2) pdf.text(".", dx, ty);
      pdf.setFont("Sarabun", "bold");
      setColor(pdf, C.blue);
      pdf.text(pgLabel, PW - M, ty, { align: "right" });
    }
  }

  // ─── Watermark ────────────────────────────────────────────────────────────
  if (options?.watermarkText) {
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(50);
      pdf.setTextColor(200, 200, 200);
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
