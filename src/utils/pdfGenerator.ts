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

export async function downloadPDF(data: ReportData) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerThaiFont(pdf);
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

  // === COVER ===
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
    ["Client", data.jobInfo.clientName],
    ["Date", data.jobInfo.dateTime],
    ["Location", data.jobInfo.location],
    ["Reporter", data.jobInfo.reporterName],
  ].filter(([, v]) => v);
  for (const [label, value] of infoLines) {
    pdf.setFont("Sarabun", "bold");
    pdf.text(`${label}: `, margin, y);
    pdf.setFont("Sarabun", "normal");
    pdf.text(value, margin + 30, y);
    y += 7;
  }

  // === CATEGORIES ===
  for (const cat of data.categories) {
    const hasPhotos = cat.type === "unit-based"
      ? cat.units.some((u) => u.beforePhotos.length > 0 || u.afterPhotos.length > 0)
      : cat.subSections.some((s) => s.photos.length > 0);
    if (!hasPhotos) continue;

    addNewPageIfNeeded(25);
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

  // === FOOTER ===
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

  const fileName = `${data.jobInfo.clientName || "report"}_${new Date().toLocaleDateString("th-TH")}.pdf`;
  pdf.save(fileName);
}
