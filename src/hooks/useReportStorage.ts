import { useState } from "react";
import { JobInfo, Category, ReportData, SavedReport } from "@/types/report";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "pro-site-reports";

function getReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setReports(reports: SavedReport[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function useReportStorage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const saveReport = async (
    jobInfo: JobInfo,
    categories: Category[],
    conclusion: string,
    existingId?: string
  ): Promise<string> => {
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const reports = getReports();
      const now = new Date().toISOString();
      const id = existingId || `report-${Date.now()}`;
      const name = jobInfo.clientName || jobInfo.subject || "รายงานไม่มีชื่อ";
      const data: ReportData = { jobInfo, categories, conclusion };
      const existing = reports.findIndex((r) => r.id === id);

      if (existing >= 0) {
        reports[existing] = { ...reports[existing], name, updatedAt: now, data };
      } else {
        reports.unshift({ id, name, createdAt: now, updatedAt: now, data });
      }
      setReports(reports);
      toast({ title: "บันทึกสำเร็จ", description: "รายงานถูกบันทึกแล้ว" });
      return id;
    } finally { setIsSaving(false); }
  };

  const loadReport = async (id: string): Promise<ReportData | null> => {
    setIsLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const found = getReports().find((r) => r.id === id);
      return found?.data || null;
    } finally { setIsLoading(false); }
  };

  const listReports = (): SavedReport[] => getReports();
  const deleteReport = (id: string) => {
    setReports(getReports().filter((r) => r.id !== id));
    toast({ title: "ลบรายงานสำเร็จ" });
  };

  return { saveReport, loadReport, listReports, deleteReport, isSaving, isLoading };
}
