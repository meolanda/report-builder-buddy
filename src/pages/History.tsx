import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, FileText, ExternalLink } from "lucide-react";
import { useReportStorage } from "@/hooks/useReportStorage";
import { SavedReport } from "@/types/report";

const History = () => {
  const navigate = useNavigate();
  const { listReports, deleteReport } = useReportStorage();
  const [reports, setReports] = useState<SavedReport[]>(listReports());

  const handleDelete = (id: string) => {
    deleteReport(id);
    setReports(listReports());
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">ประวัติรายงาน</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">ยังไม่มีรายงานที่บันทึกไว้</p>
              <Button onClick={() => navigate("/")}>สร้างรายงานใหม่</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{report.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      สร้างเมื่อ {new Date(report.createdAt).toLocaleDateString("th-TH")}
                      {report.updatedAt !== report.createdAt &&
                        ` · แก้ไขล่าสุด ${new Date(report.updatedAt).toLocaleDateString("th-TH")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/?reportId=${report.id}`)}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      เปิด
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
