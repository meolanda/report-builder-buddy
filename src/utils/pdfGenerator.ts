import { ReportData } from "@/types/report";
import jsPDF from "jspdf";

async function loadFont(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function registerThaiFont(pdf: jsPDF) {
  const [regular, bold] = await Promise.all([
    loadFont("/fonts/Sarabun-Regular.ttf"),
    loadFont("/fonts/Sarabun-Bold.ttf"),
  ]);
  pdf.addFileToVFS("Sarabun-Regular.ttf", regular);
  pdf.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  pdf.addFileToVFS("Sarabun-Bold.ttf", bold);
  pdf.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  pdf.setFont("Sarabun");
}

interface PDFOptions {
  watermarkText?: string;
}

export async function downloadPDF(data: ReportData, options?: PDFOptions) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerThaiFont(pdf);

  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Color palette
  const blue = { r: 30, g: 58, b: 138 };
  const lightBlue = { r: 59, g: 130, b: 246 };
  const accentBg = { r: 239, g: 246, b: 255 }; // very light blue bg
  const gray = { r: 100, g: 100, b: 100 };
  const lightGray = { r: 220, g: 220, b: 220 };
  const darkText = { r: 30, g: 30, b: 30 };

  const tocEntries: { name: string; icon: string; page: number }[] = [];

  const photoW = (contentW - 6) / 2;
  const photoH = photoW * 0.72;

  // Minimum space needed to start a section (header + label + first photo row)
  const SECTION_MIN_SPACE = 25 + photoH + 20;
  // Minimum space needed to start a subsection
  const SUBSECTION_MIN_SPACE = 20 + photoH + 15;

  const usableH = pageH - margin - 12; // reserve 12mm for page footer

  const addNewPageIfNeeded = (need: number) => {
    if (y + need > usableH) {
      pdf.addPage();
      y = margin;
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // Draw a rounded rect (simulated with filled rect + border)
  const drawCard = (x: number, cardY: number, w: number, h: number, fillR = 255, fillG = 255, fillB = 255) => {
    pdf.setFillColor(fillR, fillG, fillB);
    pdf.setDrawColor(lightGray.r, lightGray.g, lightGray.b);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(x, cardY, w, h, 2, 2, "FD");
  };

  const addPhotoPair = async (photos: { url: string; caption: string }[], startY: number) => {
    let cy = startY;
    for (let i = 0; i < photos.length; i += 2) {
      addNewPageIfNeeded(photoH + 18);

      for (let j = 0; j < 2 && i + j < photos.length; j++) {
        const photo = photos[i + j];
        const x = margin + j * (photoW + 6);

        // Photo card background
        drawCard(x, cy, photoW, photoH, 248, 248, 248);

        try {
          const img = await loadImage(photo.url);
          const imgRatio = img.width / img.height;
          let drawW = photoW - 2, drawH = (photoW - 2) / imgRatio;
          if (drawH > photoH - 2) { drawH = photoH - 2; drawW = (photoH - 2) * imgRatio; }
          pdf.addImage(
            photo.url, "JPEG",
            x + (photoW - drawW) / 2,
            cy + (photoH - drawH) / 2,
            drawW, drawH
          );
        } catch {
          pdf.setFillColor(230, 230, 230);
          pdf.rect(x + 1, cy + 1, photoW - 2, photoH - 2, "F");
          pdf.setFontSize(8);
          pdf.setTextColor(160, 160, 160);
          pdf.setFont("Sarabun", "normal");
          pdf.text("ไม่พบรูปภาพ", x + photoW / 2, cy + photoH / 2, { align: "center" });
        }

        // Caption below photo
        if (photo.caption) {
          pdf.setFontSize(7.5);
          pdf.setTextColor(gray.r, gray.g, gray.b);
          pdf.setFont("Sarabun", "normal");
          const captionLines = pdf.splitTextToSize(photo.caption, photoW);
          pdf.text(captionLines[0], x + photoW / 2, cy + photoH + 4.5, { align: "center" });
        }
      }

      cy += photoH + 10;
    }
    return cy;
  };

  // === COVER PAGE ===
  // Top accent bar
  pdf.setFillColor(blue.r, blue.g, blue.b);
  pdf.rect(0, 0, pageW, 8, "F");

  // Bottom accent bar
  pdf.setFillColor(blue.r, blue.g, blue.b);
  pdf.rect(0, pageH - 8, pageW, 8, "F");

  y = 30;

  if (data.jobInfo.logo) {
    try {
      const logoImg = await loadImage(data.jobInfo.logo);
      const logoH = 22;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      pdf.addImage(data.jobInfo.logo, "PNG", (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 12;
    } catch { y += 10; }
  }

  // Title
  pdf.setFont("Sarabun", "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(blue.r, blue.g, blue.b);
  pdf.text(data.jobInfo.subject || "รายงาน PM", pageW / 2, y, { align: "center" });
  y += 8;

  // Accent line under title
  pdf.setDrawColor(lightBlue.r, lightBlue.g, lightBlue.b);
  pdf.setLineWidth(0.8);
  pdf.line(pageW / 2 - 35, y, pageW / 2 + 35, y);
  y += 16;

  // Info card
  const infoLines = [
    ["ลูกค้า", data.jobInfo.clientName],
    ["วันที่", data.jobInfo.dateTime],
    ["สถานที่", data.jobInfo.location],
    ["ผู้รายงาน", data.jobInfo.reporterName],
  ].filter(([, v]) => v);

  const cardPad = 6;
  const cardH = infoLines.length * 9 + cardPad * 2;
  const cardX = margin + 10;
  const cardW = contentW - 20;
  drawCard(cardX, y, cardW, cardH, accentBg.r, accentBg.g, accentBg.b);

  y += cardPad + 5;
  for (const [label, value] of infoLines) {
    pdf.setFont("Sarabun", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(blue.r, blue.g, blue.b);
    pdf.text(`${label}:`, cardX + 8, y);
    pdf.setFont("Sarabun", "normal");
    pdf.setTextColor(darkText.r, darkText.g, darkText.b);
    pdf.text(value, cardX + 40, y);
    y += 9;
  }
  y += cardPad;

  // === TABLE OF CONTENTS ===
  const categoriesWithPhotos = data.categories.filter((cat) => {
    if (cat.type === "unit-based") return cat.units.some((u) => u.beforePhotos.length > 0 || u.afterPhotos.length > 0);
    return cat.subSections.some((s) => s.photos.length > 0);
  });

  if (categoriesWithPhotos.length > 0) {
    y += 14;

    // TOC heading
    pdf.setFont("Sarabun", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(blue.r, blue.g, blue.b);
    pdf.text("สารบัญ", margin, y);
    y += 5;
    pdf.setDrawColor(lightBlue.r, lightBlue.g, lightBlue.b);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, margin + 28, y);
    y += 7;

    const tocStartY = y;
    const tocPageNum = pdf.getNumberOfPages();

    for (let i = 0; i < categoriesWithPhotos.length; i++) y += 8;
    if (data.conclusion) y += 8;
    y += 5;

    // === CATEGORIES ===
    for (const cat of categoriesWithPhotos) {
      // Ensure heading + at least some content won't be orphaned
      addNewPageIfNeeded(SECTION_MIN_SPACE);

      tocEntries.push({ name: cat.name, icon: cat.icon, page: pdf.getNumberOfPages() });
      y += 4;

      // Category header band
      pdf.setFillColor(accentBg.r, accentBg.g, accentBg.b);
      pdf.setDrawColor(lightBlue.r, lightBlue.g, lightBlue.b);
      pdf.setLineWidth(0.3);
      pdf.rect(margin, y - 5, contentW, 12, "FD");

      // Left accent stripe
      pdf.setFillColor(lightBlue.r, lightBlue.g, lightBlue.b);
      pdf.rect(margin, y - 5, 3, 12, "F");

      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(blue.r, blue.g, blue.b);
      pdf.text(`${cat.icon}  ${cat.name}`, margin + 6, y + 1);
      y += 12;

      if (cat.type === "unit-based") {
        for (const unit of cat.units) {
          if (unit.beforePhotos.length === 0 && unit.afterPhotos.length === 0) continue;

          // Keep unit header with its content
          addNewPageIfNeeded(SUBSECTION_MIN_SPACE);

          // Unit sub-header
          pdf.setFillColor(248, 250, 255);
          pdf.setDrawColor(200, 215, 245);
          pdf.setLineWidth(0.15);
          pdf.rect(margin + 4, y - 4, contentW - 4, 9, "FD");
          pdf.setFont("Sarabun", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(gray.r, gray.g, gray.b);
          pdf.text(unit.name, margin + 8, y + 1);
          y += 10;

          if (unit.beforePhotos.length > 0) {
            addNewPageIfNeeded(SUBSECTION_MIN_SPACE);
            pdf.setFontSize(9.5);
            pdf.setTextColor(lightBlue.r, lightBlue.g, lightBlue.b);
            pdf.setFont("Sarabun", "bold");
            pdf.text("▸  ก่อน", margin + 6, y);
            y += 6;
            y = await addPhotoPair(unit.beforePhotos, y);
            y += 4;
          }
          if (unit.afterPhotos.length > 0) {
            addNewPageIfNeeded(SUBSECTION_MIN_SPACE);
            pdf.setFontSize(9.5);
            pdf.setTextColor(lightBlue.r, lightBlue.g, lightBlue.b);
            pdf.setFont("Sarabun", "bold");
            pdf.text("▸  หลัง", margin + 6, y);
            y += 6;
            y = await addPhotoPair(unit.afterPhotos, y);
            y += 4;
          }
          y += 4;
        }
      } else {
        for (const sub of cat.subSections) {
          if (sub.photos.length === 0) continue;

          // Keep sub-section header with its content
          addNewPageIfNeeded(SUBSECTION_MIN_SPACE);

          pdf.setFillColor(248, 250, 255);
          pdf.setDrawColor(200, 215, 245);
          pdf.setLineWidth(0.15);
          pdf.rect(margin + 4, y - 4, contentW - 4, 9, "FD");
          pdf.setFont("Sarabun", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(gray.r, gray.g, gray.b);
          pdf.text(sub.name, margin + 8, y + 1);
          y += 10;
          y = await addPhotoPair(sub.photos, y);
          y += 6;
        }
      }

      y += 6;
    }

    // === CONCLUSION ===
    let conclusionPage = 0;
    if (data.conclusion) {
      addNewPageIfNeeded(40);
      conclusionPage = pdf.getNumberOfPages();
      y += 4;

      pdf.setFillColor(accentBg.r, accentBg.g, accentBg.b);
      pdf.setDrawColor(lightBlue.r, lightBlue.g, lightBlue.b);
      pdf.setLineWidth(0.3);
      pdf.rect(margin, y - 5, contentW, 12, "FD");
      pdf.setFillColor(lightBlue.r, lightBlue.g, lightBlue.b);
      pdf.rect(margin, y - 5, 3, 12, "F");

      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(blue.r, blue.g, blue.b);
      pdf.text("📝  สรุปผล", margin + 6, y + 1);
      y += 14;

      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(darkText.r, darkText.g, darkText.b);
      for (const line of pdf.splitTextToSize(data.conclusion, contentW - 4)) {
        addNewPageIfNeeded(7);
        pdf.text(line, margin + 4, y);
        y += 6.5;
      }
    }

    // === FOOTER NOTE / CLOSING PAGE ===
    if (data.jobInfo.footerNote) {
      pdf.addPage();
      y = pageH / 2 - 20;

      pdf.setDrawColor(lightGray.r, lightGray.g, lightGray.b);
      pdf.setLineWidth(0.3);
      pdf.line(margin + 20, y, pageW - margin - 20, y);
      y += 10;

      pdf.setFontSize(13);
      pdf.setTextColor(blue.r, blue.g, blue.b);
      pdf.setFont("Sarabun", "bold");
      for (const line of pdf.splitTextToSize(data.jobInfo.footerNote, contentW)) {
        pdf.text(line, pageW / 2, y, { align: "center" });
        y += 8;
      }

      pdf.setDrawColor(lightGray.r, lightGray.g, lightGray.b);
      pdf.line(margin + 20, y + 4, pageW - margin - 20, y + 4);
    }

    // === FILL TOC with actual page numbers ===
    pdf.setPage(tocPageNum);
    let tocY = tocStartY;
    for (let i = 0; i < tocEntries.length; i++) {
      const entry = tocEntries[i];
      const label = `${entry.icon}  ${entry.name}`;
      const pageLabel = `หน้า ${entry.page}`;

      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(darkText.r, darkText.g, darkText.b);
      pdf.text(label, margin + 4, tocY);

      const labelWidth = pdf.getTextWidth(label) + margin + 8;
      const pageWidth = pdf.getTextWidth(pageLabel);
      const dotsEnd = pageW - margin - pageWidth - 3;
      let dotX = labelWidth;
      pdf.setTextColor(lightGray.r, lightGray.g, lightGray.b);
      while (dotX < dotsEnd) {
        pdf.text(".", dotX, tocY);
        dotX += 2.2;
      }
      pdf.setFont("Sarabun", "bold");
      pdf.setTextColor(lightBlue.r, lightBlue.g, lightBlue.b);
      pdf.text(pageLabel, pageW - margin, tocY, { align: "right" });
      tocY += 8;
    }
    if (data.conclusion && conclusionPage > 0) {
      const label = "📝  สรุปผล";
      const pageLabel = `หน้า ${conclusionPage}`;
      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(darkText.r, darkText.g, darkText.b);
      pdf.text(label, margin + 4, tocY);
      const labelWidth = pdf.getTextWidth(label) + margin + 8;
      const pageWidth = pdf.getTextWidth(pageLabel);
      const dotsEnd = pageW - margin - pageWidth - 3;
      let dotX = labelWidth;
      pdf.setTextColor(lightGray.r, lightGray.g, lightGray.b);
      while (dotX < dotsEnd) {
        pdf.text(".", dotX, tocY);
        dotX += 2.2;
      }
      pdf.setFont("Sarabun", "bold");
      pdf.setTextColor(lightBlue.r, lightBlue.g, lightBlue.b);
      pdf.text(pageLabel, pageW - margin, tocY, { align: "right" });
    }
  }

  // === WATERMARK on all pages ===
  const watermarkText = options?.watermarkText;
  if (watermarkText) {
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(50);
      pdf.setTextColor(200, 200, 200);
      pdf.saveGraphicsState();
      // @ts-ignore
      const gState = pdf.GState({ opacity: 0.15 });
      pdf.setGState(gState);
      pdf.text(watermarkText, pageW / 2, pageH / 2, { align: "center", angle: 45 });
      pdf.restoreGraphicsState();
    }
  }

  // === PAGE NUMBERS on all pages ===
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);

    // Footer bar
    pdf.setFillColor(245, 247, 250);
    pdf.setDrawColor(lightGray.r, lightGray.g, lightGray.b);
    pdf.setLineWidth(0.15);
    pdf.line(margin, pageH - 10, pageW - margin, pageH - 10);

    pdf.setFont("Sarabun", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 160);
    pdf.text(`หน้า ${p} / ${totalPages}`, pageW / 2, pageH - 5, { align: "center" });

    // Client name on footer left (except cover)
    if (p > 1 && data.jobInfo.clientName) {
      pdf.setFontSize(7.5);
      pdf.setTextColor(180, 180, 180);
      pdf.text(data.jobInfo.clientName, margin, pageH - 5);
    }
  }

  const fileName = `${data.jobInfo.clientName || "report"}_${new Date().toLocaleDateString("th-TH")}.pdf`;
  pdf.save(fileName);
}
