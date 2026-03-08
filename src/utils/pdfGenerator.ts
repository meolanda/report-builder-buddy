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

  // Track category page numbers for TOC
  const tocEntries: { name: string; icon: string; page: number }[] = [];

  const addNewPageIfNeeded = (need: number) => {
    if (y + need > pageH - margin - 10) { // extra 10mm for page number
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

  const addPhotoPair = async (photos: { url: string; caption: string }[], startY: number) => {
    let cy = startY;
    for (let i = 0; i < photos.length; i += 2) {
      const photoW = (contentW - 5) / 2;
      const photoH = photoW * 0.75;
      addNewPageIfNeeded(photoH + 15);

      for (let j = 0; j < 2 && i + j < photos.length; j++) {
        const photo = photos[i + j];
        const x = margin + j * (photoW + 5);
        try {
          const img = await loadImage(photo.url);
          const imgRatio = img.width / img.height;
          let drawW = photoW, drawH = photoW / imgRatio;
          if (drawH > photoH) { drawH = photoH; drawW = photoH * imgRatio; }
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(x, y, photoW, photoH);
          pdf.addImage(photo.url, "JPEG", x + (photoW - drawW) / 2, y + (photoH - drawH) / 2, drawW, drawH);
        } catch {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(x, y, photoW, photoH, "F");
        }
        if (photo.caption) {
          pdf.setFontSize(8);
          pdf.setTextColor(80, 80, 80);
          pdf.setFont("Sarabun", "normal");
          pdf.text(pdf.splitTextToSize(photo.caption, photoW), x, y + photoH + 4);
        }
      }
      y += photoH + 12;
    }
    return y;
  };

  // === COVER (Page 1) ===
  if (data.jobInfo.logo) {
    try {
      const logoImg = await loadImage(data.jobInfo.logo);
      const logoH = 20;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      pdf.addImage(data.jobInfo.logo, "PNG", (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 8;
    } catch { y += 5; }
  }

  pdf.setFont("Sarabun", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(30, 58, 138);
  pdf.text(data.jobInfo.subject || "Report", pageW / 2, y, { align: "center" });
  y += 12;
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageW - margin, y);
  y += 10;

  pdf.setFontSize(11);
  pdf.setTextColor(50, 50, 50);
  const infoLines = [
    ["ลูกค้า", data.jobInfo.clientName],
    ["วันที่", data.jobInfo.dateTime],
    ["สถานที่", data.jobInfo.location],
    ["ผู้รายงาน", data.jobInfo.reporterName],
  ].filter(([, v]) => v);
  for (const [label, value] of infoLines) {
    pdf.setFont("Sarabun", "bold");
    pdf.text(`${label}: `, margin, y);
    pdf.setFont("Sarabun", "normal");
    pdf.text(value, margin + 30, y);
    y += 7;
  }

  // === TABLE OF CONTENTS ===
  const categoriesWithPhotos = data.categories.filter((cat) => {
    if (cat.type === "unit-based") return cat.units.some((u) => u.beforePhotos.length > 0 || u.afterPhotos.length > 0);
    return cat.subSections.some((s) => s.photos.length > 0);
  });

  if (categoriesWithPhotos.length > 0) {
    y += 10;
    addNewPageIfNeeded(20 + categoriesWithPhotos.length * 8);
    pdf.setFont("Sarabun", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138);
    pdf.text("สารบัญ", margin, y);
    y += 8;
    pdf.setDrawColor(59, 130, 246);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, margin + 30, y);
    y += 6;

    // We'll fill in page numbers later with a placeholder approach
    const tocStartY = y;
    const tocPageNum = pdf.getNumberOfPages();
    // Reserve space for TOC entries
    for (let i = 0; i < categoriesWithPhotos.length; i++) {
      y += 7;
    }
    if (data.conclusion) y += 7;
    y += 5;

    // === CATEGORIES ===
    for (const cat of categoriesWithPhotos) {
      addNewPageIfNeeded(25);
      tocEntries.push({ name: cat.name, icon: cat.icon, page: pdf.getNumberOfPages() });
      y += 5;
      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138);
      pdf.text(`${cat.icon} ${cat.name}`, margin, y);
      y += 3;
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, margin + contentW * 0.5, y);
      y += 8;

      if (cat.type === "unit-based") {
        for (const unit of cat.units) {
          if (unit.beforePhotos.length === 0 && unit.afterPhotos.length === 0) continue;
          addNewPageIfNeeded(20);
          pdf.setFont("Sarabun", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(60, 60, 60);
          pdf.text(unit.name, margin + 2, y);
          y += 7;

          if (unit.beforePhotos.length > 0) {
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont("Sarabun", "normal");
            pdf.text("ก่อน:", margin + 4, y);
            y += 5;
            y = await addPhotoPair(unit.beforePhotos, y);
          }
          if (unit.afterPhotos.length > 0) {
            addNewPageIfNeeded(15);
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont("Sarabun", "normal");
            pdf.text("หลัง:", margin + 4, y);
            y += 5;
            y = await addPhotoPair(unit.afterPhotos, y);
          }
        }
      } else {
        for (const sub of cat.subSections) {
          if (sub.photos.length === 0) continue;
          addNewPageIfNeeded(20);
          pdf.setFont("Sarabun", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(60, 60, 60);
          pdf.text(sub.name, margin + 2, y);
          y += 7;
          y = await addPhotoPair(sub.photos, y);
        }
      }
    }

    // === CONCLUSION ===
    let conclusionPage = 0;
    if (data.conclusion) {
      addNewPageIfNeeded(30);
      conclusionPage = pdf.getNumberOfPages();
      y += 5;
      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(30, 58, 138);
      pdf.text("สรุปผล", margin, y);
      y += 8;
      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);
      for (const line of pdf.splitTextToSize(data.conclusion, contentW)) {
        addNewPageIfNeeded(7);
        pdf.text(line, margin, y);
        y += 6;
      }
    }

    // === FOOTER NOTE ===
    if (data.jobInfo.footerNote) {
      addNewPageIfNeeded(20);
      y += 10;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.setFont("Sarabun", "normal");
      for (const line of pdf.splitTextToSize(data.jobInfo.footerNote, contentW)) {
        addNewPageIfNeeded(5);
        pdf.text(line, pageW / 2, y, { align: "center" });
        y += 5;
      }
    }

    // === FILL TOC with actual page numbers ===
    pdf.setPage(tocPageNum);
    let tocY = tocStartY;
    pdf.setFont("Sarabun", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(50, 50, 50);
    for (let i = 0; i < tocEntries.length; i++) {
      const entry = tocEntries[i];
      const label = `${entry.icon} ${entry.name}`;
      const pageLabel = `หน้า ${entry.page}`;
      pdf.text(label, margin + 4, tocY);
      // Dotted line
      const labelWidth = pdf.getTextWidth(label) + margin + 6;
      const pageWidth = pdf.getTextWidth(pageLabel);
      const dotsStart = labelWidth;
      const dotsEnd = pageW - margin - pageWidth - 2;
      let dotX = dotsStart;
      pdf.setTextColor(180, 180, 180);
      while (dotX < dotsEnd) {
        pdf.text(".", dotX, tocY);
        dotX += 2;
      }
      pdf.setTextColor(50, 50, 50);
      pdf.text(pageLabel, pageW - margin, tocY, { align: "right" });
      tocY += 7;
    }
    if (data.conclusion && conclusionPage > 0) {
      const label = "📝 สรุปผล";
      const pageLabel = `หน้า ${conclusionPage}`;
      pdf.text(label, margin + 4, tocY);
      const labelWidth = pdf.getTextWidth(label) + margin + 6;
      const pageWidth = pdf.getTextWidth(pageLabel);
      const dotsEnd = pageW - margin - pageWidth - 2;
      let dotX = labelWidth;
      pdf.setTextColor(180, 180, 180);
      while (dotX < dotsEnd) {
        pdf.text(".", dotX, tocY);
        dotX += 2;
      }
      pdf.setTextColor(50, 50, 50);
      pdf.text(pageLabel, pageW - margin, tocY, { align: "right" });
    }
  } else {
    // No categories with photos — still render conclusion/footer
    if (data.conclusion) {
      addNewPageIfNeeded(30);
      y += 5;
      pdf.setFont("Sarabun", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(30, 58, 138);
      pdf.text("สรุปผล", margin, y);
      y += 8;
      pdf.setFont("Sarabun", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);
      for (const line of pdf.splitTextToSize(data.conclusion, contentW)) {
        addNewPageIfNeeded(7);
        pdf.text(line, margin, y);
        y += 6;
      }
    }
    if (data.jobInfo.footerNote) {
      addNewPageIfNeeded(20);
      y += 10;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.setFont("Sarabun", "normal");
      for (const line of pdf.splitTextToSize(data.jobInfo.footerNote, contentW)) {
        addNewPageIfNeeded(5);
        pdf.text(line, pageW / 2, y, { align: "center" });
        y += 5;
      }
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
      // @ts-ignore - jsPDF internal for rotation
      const gState = pdf.GState({ opacity: 0.15 });
      pdf.setGState(gState);
      pdf.text(watermarkText, pageW / 2, pageH / 2, {
        align: "center",
        angle: 45,
      });
      pdf.restoreGraphicsState();
    }
  }

  // === PAGE NUMBERS on all pages ===
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont("Sarabun", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`หน้า ${p} / ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
  }

  const fileName = `${data.jobInfo.clientName || "report"}_${new Date().toLocaleDateString("th-TH")}.pdf`;
  pdf.save(fileName);
}
