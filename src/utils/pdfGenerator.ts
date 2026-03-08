import { ReportData } from "@/types/report";
import jsPDF from "jspdf";

export async function downloadPDF(data: ReportData) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const addNewPageIfNeeded = (need: number) => {
    if (y + need > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // Helper to load image as data URL
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // === COVER PAGE ===
  // Logo
  if (data.jobInfo.logo) {
    try {
      const logoImg = await loadImage(data.jobInfo.logo);
      const logoH = 20;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      pdf.addImage(data.jobInfo.logo, "PNG", (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 8;
    } catch {
      y += 5;
    }
  }

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(30, 58, 138); // blue-900
  const title = data.jobInfo.subject || "รายงานลูกค้า";
  pdf.text(title, pageW / 2, y, { align: "center" });
  y += 12;

  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageW - margin, y);
  y += 10;

  // Job info
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(50, 50, 50);

  const infoLines = [
    ["ลูกค้า", data.jobInfo.clientName],
    ["วันที่", data.jobInfo.dateTime],
    ["สถานที่", data.jobInfo.location],
    ["ผู้รายงาน", data.jobInfo.reporterName],
  ].filter(([, v]) => v);

  for (const [label, value] of infoLines) {
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}: `, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, margin + 30, y);
    y += 7;
  }

  // === PHOTO SECTIONS ===
  for (const section of data.sections) {
    if (section.photos.length === 0) continue;

    addNewPageIfNeeded(30);

    // Section title
    y += 5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138);
    pdf.text(section.title, margin, y);
    y += 3;
    pdf.setDrawColor(59, 130, 246);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, margin + contentW * 0.4, y);
    y += 8;

    // Photos - 2 per row
    for (let i = 0; i < section.photos.length; i += 2) {
      const photoW = (contentW - 5) / 2;
      const photoH = photoW * 0.75;

      addNewPageIfNeeded(photoH + 15);

      for (let j = 0; j < 2 && i + j < section.photos.length; j++) {
        const photo = section.photos[i + j];
        const x = margin + j * (photoW + 5);

        try {
          const img = await loadImage(photo.url);
          // Fit image proportionally
          const imgRatio = img.width / img.height;
          let drawW = photoW;
          let drawH = photoW / imgRatio;
          if (drawH > photoH) {
            drawH = photoH;
            drawW = photoH * imgRatio;
          }
          const offsetX = x + (photoW - drawW) / 2;

          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(x, y, photoW, photoH);
          pdf.addImage(photo.url, "JPEG", offsetX, y + (photoH - drawH) / 2, drawW, drawH);
        } catch {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(x, y, photoW, photoH, "F");
          pdf.setFontSize(9);
          pdf.setTextColor(150, 150, 150);
          pdf.text("ไม่สามารถโหลดรูปได้", x + photoW / 2, y + photoH / 2, { align: "center" });
        }

        // Caption
        if (photo.caption) {
          pdf.setFontSize(8);
          pdf.setTextColor(80, 80, 80);
          pdf.setFont("helvetica", "normal");
          const captionLines = pdf.splitTextToSize(photo.caption, photoW);
          pdf.text(captionLines, x, y + photoH + 4);
        }
      }

      y += photoH + 12;
    }
  }

  // === CONCLUSION ===
  if (data.conclusion) {
    addNewPageIfNeeded(30);
    y += 5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138);
    pdf.text("สรุปผลงาน", margin, y);
    y += 3;
    pdf.setDrawColor(59, 130, 246);
    pdf.line(margin, y, margin + contentW * 0.3, y);
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(50, 50, 50);
    const conclusionLines = pdf.splitTextToSize(data.conclusion, contentW);
    for (const line of conclusionLines) {
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
    pdf.setFont("helvetica", "italic");
    const footerLines = pdf.splitTextToSize(data.jobInfo.footerNote, contentW);
    for (const line of footerLines) {
      addNewPageIfNeeded(5);
      pdf.text(line, pageW / 2, y, { align: "center" });
      y += 5;
    }
  }

  const fileName = `${data.jobInfo.clientName || "report"}_${new Date().toLocaleDateString("th-TH")}.pdf`;
  pdf.save(fileName);
}
