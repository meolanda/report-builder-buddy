import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";
import { ReportData } from "@/types/report";
import { downloadPDF } from "@/utils/pdfGenerator";
import { useState } from "react";

interface Props {
  data: ReportData;
  onClose: () => void;
}

const PDFPreview = ({ data, onClose }: Props) => {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await downloadPDF(data);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ตัวอย่างรายงาน</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          {/* Header */}
          <div className="text-center">
            {data.jobInfo.logo && (
              <img
                src={data.jobInfo.logo}
                alt="Logo"
                className="mx-auto mb-3 h-16 w-auto object-contain"
              />
            )}
            <h2 className="text-xl font-bold text-primary">
              {data.jobInfo.subject || "รายงานลูกค้า"}
            </h2>
            <div className="mx-auto mt-2 h-0.5 w-24 bg-primary/50" />
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {data.jobInfo.clientName && (
              <p><span className="font-semibold">ลูกค้า:</span> {data.jobInfo.clientName}</p>
            )}
            {data.jobInfo.dateTime && (
              <p><span className="font-semibold">วันที่:</span> {data.jobInfo.dateTime}</p>
            )}
            {data.jobInfo.location && (
              <p><span className="font-semibold">สถานที่:</span> {data.jobInfo.location}</p>
            )}
            {data.jobInfo.reporterName && (
              <p><span className="font-semibold">ผู้รายงาน:</span> {data.jobInfo.reporterName}</p>
            )}
          </div>

          {/* Sections */}
          {data.sections.map(
            (section) =>
              section.photos.length > 0 && (
                <div key={section.id}>
                  <h3 className="mb-2 font-bold text-primary">{section.title}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {section.photos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        <img
                          src={photo.url}
                          alt={photo.caption}
                          className="aspect-[4/3] w-full rounded border border-border object-cover"
                        />
                        {photo.caption && (
                          <p className="text-xs text-muted-foreground">{photo.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}

          {/* Conclusion */}
          {data.conclusion && (
            <div>
              <h3 className="mb-2 font-bold text-primary">สรุปผลงาน</h3>
              <p className="whitespace-pre-wrap text-sm">{data.conclusion}</p>
            </div>
          )}

          {/* Footer */}
          {data.jobInfo.footerNote && (
            <div className="border-t border-border pt-3 text-center text-xs text-muted-foreground italic">
              <p className="whitespace-pre-wrap">{data.jobInfo.footerNote}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
          <Button onClick={handleDownload} disabled={generating}>
            <FileDown className="mr-1 h-4 w-4" />
            {generating ? "กำลังสร้าง..." : "ดาวน์โหลด PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFPreview;
