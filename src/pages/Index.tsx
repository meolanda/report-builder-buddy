import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileDown, Loader2, Eye, Save, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import JobInfoForm from "@/components/JobInfoForm";
import CategorySection from "@/components/CategorySection";
import ConclusionSection from "@/components/ConclusionSection";
import PDFPreview from "@/components/PDFPreview";
import AddCategoryDialog from "@/components/AddCategoryDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { JobInfo, Category, ReportData, DEFAULT_CATEGORIES } from "@/types/report";
import defaultLogo from "@/assets/default-logo.jpg";
import { downloadPDF } from "@/utils/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { useReportStorage } from "@/hooks/useReportStorage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { saveReport, loadReport, isSaving, isLoading } = useReportStorage();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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
    const id = searchParams.get("reportId");
    if (id) {
      setReportId(id);
      loadReport(id).then((data) => {
        if (data) {
          setJobInfo(data.jobInfo);
          setCategories(data.categories.length > 0 ? data.categories : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
          setConclusion(data.conclusion);
          toast({ title: "โหลดรายงานสำเร็จ" });
        }
      });
    }
  }, [searchParams]);

  // Auto-save
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const hasDataRef = useRef(false);

  // Track if user has entered any data
  useEffect(() => {
    const hasPhotos = categories.some((cat) => {
      if (cat.type === "unit-based") return cat.units.some((u) => u.beforePhotos.length > 0 || u.afterPhotos.length > 0);
      return cat.subSections.some((s) => s.photos.length > 0);
    });
    hasDataRef.current = hasPhotos || !!jobInfo.clientName || !!conclusion;
  }, [categories, jobInfo.clientName, conclusion]);

  const doAutoSave = useCallback(async () => {
    if (!hasDataRef.current || isSaving) return;
    try {
      const id = await saveReport(jobInfo, categories, conclusion, reportId || undefined);
      if (!reportId) setReportId(id);
      setLastSavedAt(new Date());
    } catch {
      // silent fail for auto-save
    }
  }, [jobInfo, categories, conclusion, reportId, isSaving, saveReport]);

  useEffect(() => {
    autoSaveRef.current = setInterval(doAutoSave, AUTO_SAVE_INTERVAL);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [doAutoSave]);

  const updateCategory = (updated: Category) => {
    setCategories(categories.map((c) => (c.id === updated.id ? updated : c)));
  };

  const addCategory = (cat: Category) => {
    setCategories([...categories, cat]);
  };

  const deleteCategory = (catId: string) => {
    setCategories(categories.filter((c) => c.id !== catId));
  };

  const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));

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
      await downloadPDF(
        { jobInfo, categories, conclusion },
        { watermarkText: watermarkText.trim() || undefined }
      );
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

  const handleManualSave = async () => {
    const id = await saveReport(jobInfo, categories, conclusion, reportId || undefined);
    if (!reportId) setReportId(id);
    setLastSavedAt(new Date());
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
              <History className="mr-1 h-4 w-4" />
              ประวัติ
            </Button>
          </div>
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
                <CategorySection
                  key={cat.id}
                  category={cat}
                  onUpdate={updateCategory}
                  isCustom={!DEFAULT_IDS.has(cat.id)}
                  onDelete={() => deleteCategory(cat.id)}
                />
              ))}
              <Button variant="outline" className="w-full" onClick={() => setShowAddCategory(true)}>
                <Plus className="mr-1 h-4 w-4" />
                เพิ่มหมวดหมู่ใหม่
              </Button>
            </div>

            <ConclusionSection
              conclusion={conclusion}
              onConclusionChange={setConclusion}
              footerNote={jobInfo.footerNote}
              onFooterNoteChange={(note) => setJobInfo({ ...jobInfo, footerNote: note })}
            />

            {/* Watermark */}
            <div className="rounded-lg border border-border bg-card p-4">
              <Label className="text-sm font-medium">💧 ลายน้ำ (Watermark)</Label>
              <Input
                placeholder="เช่น CONFIDENTIAL, ลับเฉพาะ (เว้นว่างถ้าไม่ต้องการ)"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Button>
              <Button variant="secondary" onClick={handleManualSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
              <Button onClick={handleGeneratePDF} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
                {isGenerating ? "กำลังสร้าง PDF..." : "สร้างรายงาน PDF"}
              </Button>
              {lastSavedAt && (
                <span className="text-xs text-muted-foreground">
                  บันทึกล่าสุด: {lastSavedAt.toLocaleTimeString("th-TH")}
                </span>
              )}
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
      <AddCategoryDialog open={showAddCategory} onClose={() => setShowAddCategory(false)} onAdd={addCategory} />
    </div>
  );
};

export default Index;
