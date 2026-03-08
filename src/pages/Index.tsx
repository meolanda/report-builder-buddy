import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileDown, Loader2, Eye, Save, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import JobInfoForm from "@/components/JobInfoForm";
import CategorySection from "@/components/CategorySection";
import ConclusionSection from "@/components/ConclusionSection";
import PDFPreview from "@/components/PDFPreview";
import AddCategoryDialog from "@/components/AddCategoryDialog";
import { JobInfo, Category, ReportData, DEFAULT_CATEGORIES } from "@/types/report";
import defaultLogo from "@/assets/default-logo.jpg";
import { downloadPDF } from "@/utils/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { useReportStorage } from "@/hooks/useReportStorage";

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { saveReport, loadReport, isSaving, isLoading } = useReportStorage();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const [jobInfo, setJobInfo] = useState<JobInfo>({
    clientName: "",
    dateTime: "",
    location: "",
    reporterName: "",
    logo: null,
    footerNote: "ขอบคุณที่ไว้วางใจใช้บริการ\nหากพบปัญหาการใช้งาน กรุณาติดต่อ...",
    subject: "",
  });

  // Load default logo on mount
  useEffect(() => {
    if (!jobInfo.logo) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        setJobInfo((prev) => ({ ...prev, logo: canvas.toDataURL("image/jpeg") }));
      };
      img.src = defaultLogo;
    }
  }, []);

  const [categories, setCategories] = useState<Category[]>(
    JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
  );
  const [conclusion, setConclusion] = useState("");

  useEffect(() => {
    const reportId = searchParams.get("reportId");
    if (reportId) {
      loadReport(reportId).then((data) => {
        if (data) {
          setJobInfo(data.jobInfo);
          setCategories(data.categories.length > 0 ? data.categories : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
          setConclusion(data.conclusion);
          toast({ title: "โหลดรายงานสำเร็จ" });
        }
      });
    }
  }, [searchParams]);

  const updateCategory = (updated: Category) => {
    setCategories(categories.map((c) => (c.id === updated.id ? updated : c)));
  };

  const getTotalPhotos = () =>
    categories.reduce((sum, cat) => {
      if (cat.type === "unit-based") {
        return sum + cat.units.reduce((s, u) => s + u.beforePhotos.length + u.afterPhotos.length, 0);
      }
      return sum + cat.subSections.reduce((s, sub) => s + sub.photos.length, 0);
    }, 0);

  const handleGeneratePDF = async () => {
    if (getTotalPhotos() === 0) {
      toast({ title: "ไม่มีรูปภาพ", description: "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      await downloadPDF({ jobInfo, categories, conclusion });
      toast({ title: "สร้าง PDF สำเร็จ" });
    } catch (error) {
      console.error(error);
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = () => {
    if (getTotalPhotos() === 0 && !conclusion && !jobInfo.clientName) {
      toast({ title: "ไม่มีข้อมูล", description: "กรุณากรอกข้อมูลก่อน", variant: "destructive" });
      return;
    }
    setShowPreview(true);
  };

  const reportData: ReportData = { jobInfo, categories, conclusion };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Pro Site Report</h1>
              <p className="text-sm text-muted-foreground">สร้างรายงานรูปภาพเป็น PDF อย่างมืออาชีพ</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
            <History className="mr-1 h-4 w-4" />
            ประวัติ
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">กำลังโหลดรายงาน...</p>
          </div>
        ) : (
          <div className="space-y-5">
            <JobInfoForm jobInfo={jobInfo} onChange={setJobInfo} />

            {/* Categories */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                รูปภาพในรายงาน <span className="text-sm font-normal text-muted-foreground">({getTotalPhotos()} รูป)</span>
              </h2>
              {categories.map((cat) => (
                <CategorySection key={cat.id} category={cat} onUpdate={updateCategory} />
              ))}
            </div>

            <ConclusionSection
              conclusion={conclusion}
              onConclusionChange={setConclusion}
              footerNote={jobInfo.footerNote}
              onFooterNoteChange={(note) => setJobInfo({ ...jobInfo, footerNote: note })}
            />

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Button>
              <Button variant="secondary" onClick={() => saveReport(jobInfo, categories, conclusion)} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
              <Button onClick={handleGeneratePDF} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
                {isGenerating ? "กำลังสร้าง PDF..." : "สร้างรายงาน PDF"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-border bg-muted/50 py-4">
        <p className="text-center text-xs text-muted-foreground">
          Pro Site Report © {new Date().getFullYear()} — สร้างรายงานรูปภาพระดับมืออาชีพ
        </p>
      </div>

      {showPreview && <PDFPreview data={reportData} onClose={() => setShowPreview(false)} />}
    </div>
  );
};

export default Index;
