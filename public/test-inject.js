// ── Fast test inject ──────────────────────────────────────────────────────────
// รัน script นี้ใน browser console: (await import('/test-inject.js?v=' + Date.now())).inject()

export async function inject() {
  // โหลด logo จาก public/logo.jpg
  const logoB64 = await fetch('/logo.jpg')
    .then(r => r.blob())
    .then(b => new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result);
      fr.readAsDataURL(b);
    }))
    .catch(() => null);

  // โหลด 5 รูปตัวอย่างจาก test-data.json
  const photos5 = await fetch('/test-data.json').then(r => r.json());

  // สร้าง photo object วนซ้ำจาก 5 รูป
  const p = (idx, id, caption) => ({
    id,
    url: photos5[idx % 5],
    caption,
  });

  const report = [{
    id: "report-test-inject",
    name: "ทดสอบ layout 6 รูป",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: {
      jobInfo: {
        clientName: "โลตัส นครอินทร์-บางกรวย",
        dateTime: "2026-06-26",
        location: "นครอินทร์-บางกรวย",
        reporterName: "ผู้ทดสอบ",
        logo: logoB64,
        footerNote: "ขอบคุณที่ไว้วางใจใช้บริการ",
        subject: "ทดสอบรายงานรูปภาพ",
      },
      categories: [{
        id: "cat-air", name: "แอร์", icon: "❄️", type: "unit-based",
        units: [{
          id: "unit-1", name: "ยูนิตที่ 1",
          beforePhotos: [
            p(0,"b1","ก่อน 1"), p(1,"b2","ก่อน 2"), p(2,"b3","ก่อน 3"),
            p(3,"b4","ก่อน 4"), p(4,"b5","ก่อน 5"), p(0,"b6","ก่อน 6"),
          ],
          afterPhotos: [
            p(1,"a1","หลัง 1"), p(2,"a2","หลัง 2"), p(3,"a3","หลัง 3"),
            p(4,"a4","หลัง 4"), p(0,"a5","หลัง 5"), p(1,"a6","หลัง 6"),
          ],
        }],
        subSections: [],
      }],
      conclusion: "ทดสอบการวางรูปภาพ 6 รูปต่อหน้าเรียบร้อย",
    },
  }];

  localStorage.setItem("pro-site-reports", JSON.stringify(report));
  console.log("✅ Injected — logo:", logoB64 ? "OK" : "null", "— photos:", photos5.length);
  return `injected OK`;
}
