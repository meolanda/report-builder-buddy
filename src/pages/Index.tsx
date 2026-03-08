import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, FileDown, Loader2, Eye, Save, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import JobInfoForm from "@/components/JobInfoForm";
import PhotoSection from "@/components/PhotoSection";
import ConclusionSection from "@/components/ConclusionSection";
import PDFPreview from "@/components/PDFPreview";
import { JobInfo, PhotoSection as PhotoSectionType, ReportData } from "@/types/report";
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

  const [jobInfo, setJobInfo] = useState<JobInfo>({
    clientName: "",
    dateTime: "",
    location: "",
    reporterName: "",
    logo: null,
    footerNote: "ขอบคุณที่ไว้วางใจใช้บริการ\nหากพบปัญหาการใช้งาน กรุณาติดต่อ...",
    subject: "",
  });

  const [sections, setSections] = useState<PhotoSectionType[]>([
    { id: "section-1", title: "1. สภาพหน้างานก่อนเริ่มงาน", photos: [] },
    { id: "section-2", title: "2. ภาพขณะปฏิบัติงาน", photos: [] },
    { id: "section-3", title: "3. ผลงานหลังทำเสร็จ / ส่งมอบงาน", photos: [] },
  ]);

  const [conclusion, setConclusion] = useState("");

  useEffect(() => {
    const reportId = searchParams.get("reportId");
    if (reportId) {
      const loadData = async () => {
        const data = await loadReport(reportId);
        if (data) {
          setJobInfo(data.jobInfo);
          setSections(
            data.sections.length > 0
              ? data.sections
              : [
                  { id: "section-1", title: "1. สภาพหน้างานก่อนเริ่มงาน", photos: [] },
                  { id: "section-2", title: "2. ภาพขณะปฏิบัติงาน", photos: [] },
                  { id: "section-3", title: "3. ผลงานหลังทำเสร็จ / ส่งมอบงาน", photos: [] },
                ]
          );
          setConclusion(data.conclusion);
          toast({ title: "โหลดรายงานสำเร็จ", description: "ข้อมูลรายงานถูกโหลดแล้ว" });
        }
      };
      loadData();
    }
  }, [searchParams]);

  const addSection = () => {
    const newSection: PhotoSectionType = {
      id: `section-${Date.now()}`,
      title: `หัวข้อใหม่ ${sections.length + 1}`,
      photos: [],
    };
    setSections([...sections, newSection]);
    toast({ title: "เพิ่ม Section สำเร็จ", description: "คุณสามารถแก้ไขชื่อ Section ได้โดยกดที่ไอคอนดินสอ" });
  };

  const updateSection = (updatedSection: PhotoSectionType) => {
    setSections(sections.map((s) => (s.id === updatedSection.id ? updatedSection : s)));
  };

  const deleteSection = (sectionId: string) => {
    if (sections.length === 1) {
      toast({ title: "ไม่สามารถลบได้", description: "ต้องมีอย่างน้อย 1 Section ในรายงาน", variant: "destructive" });
      return;
    }
    setSections(sections.filter((s) => s.id !== sectionId));
    toast({ title: "ลบ Section สำเร็จ" });
  };

  const handleGeneratePDF = async () => {
    const totalPhotos = sections.reduce((sum, s) => sum + s.photos.length, 0);
    if (totalPhotos === 0) {
      toast({ title: "ไม่มีรูปภาพ", description: "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      await downloadPDF({ jobInfo, sections, conclusion });
      toast({ title: "สร้าง PDF สำเร็จ", description: "ไฟล์รายงานถูกดาวน์โหลดแล้ว" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถสร้าง PDF ได้", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveReport = async () => {
    await saveReport(jobInfo, sections, conclusion);
  };

  const handlePreview = () => {
    const totalPhotos = sections.reduce((sum, s) => sum + s.photos.length, 0);
    if (totalPhotos === 0 && !conclusion && !jobInfo.clientName) {
      toast({ title: "ไม่มีข้อมูล", description: "กรุณากรอกข้อมูลหรืออัปโหลดรูปภาพก่อน Preview", variant: "destructive" });
      return;
    }
    setShowPreview(true);
  };

  const totalPhotos = sections.reduce((sum, s) => sum + s.photos.length, 0);
  const reportData: ReportData = { jobInfo, sections, conclusion };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-background">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-between">
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
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">กำลังโหลดรายงาน...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Job Information */}
            <JobInfoForm jobInfo={jobInfo} onChange={setJobInfo} />

            {/* Photo Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">รูปภาพในรายงาน</h2>
                  <span className="text-sm text-muted-foreground">({totalPhotos} รูป)</span>
                </div>
                <Button variant="outline" size="sm" onClick={addSection}>
                  <Plus className="mr-1 h-4 w-4" />
                  เพิ่ม Section
                </Button>
              </div>

              {sections.map((section) => (
                <PhotoSection
                  key={section.id}
                  section={section}
                  onUpdate={updateSection}
                  onDelete={() => deleteSection(section.id)}
                />
              ))}
            </div>

            {/* Conclusion */}
            <ConclusionSection
              conclusion={conclusion}
              onConclusionChange={setConclusion}
              footerNote={jobInfo.footerNote}
              onFooterNoteChange={(note) => setJobInfo({ ...jobInfo, footerNote: note })}
            />

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="mr-1 h-4 w-4" />
                Preview
              </Button>
              <Button variant="secondary" onClick={handleSaveReport} disabled={isSaving}>
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

      {/* PDF Preview Modal */}
      {showPreview && <PDFPreview data={reportData} onClose={() => setShowPreview(false)} />}
    </div>
  );
};

export default Index;
