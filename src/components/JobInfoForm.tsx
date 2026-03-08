import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { JobInfo } from "@/types/report";

interface Props {
  jobInfo: JobInfo;
  onChange: (info: JobInfo) => void;
}

const JobInfoForm = ({ jobInfo, onChange }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...jobInfo, logo: reader.result as string });
    reader.readAsDataURL(file);
  };

  const update = (key: keyof JobInfo, value: string) =>
    onChange({ ...jobInfo, [key]: value });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ข้อมูลงาน</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>หัวข้อรายงาน</Label>
          <Input
            placeholder="เช่น รายงานความคืบหน้าโครงการ"
            value={jobInfo.subject}
            onChange={(e) => update("subject", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>ชื่อลูกค้า</Label>
          <Input
            placeholder="ชื่อลูกค้า / บริษัท"
            value={jobInfo.clientName}
            onChange={(e) => update("clientName", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>วันที่</Label>
          <Input
            type="date"
            value={jobInfo.dateTime}
            onChange={(e) => update("dateTime", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>สถานที่</Label>
          <Input
            placeholder="สถานที่ปฏิบัติงาน"
            value={jobInfo.location}
            onChange={(e) => update("location", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>ผู้รายงาน</Label>
          <Input
            placeholder="ชื่อผู้จัดทำรายงาน"
            value={jobInfo.reporterName}
            onChange={(e) => update("reporterName", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>โลโก้บริษัท</Label>
          <div className="flex items-center gap-2">
            {jobInfo.logo ? (
              <div className="relative">
                <img
                  src={jobInfo.logo}
                  alt="Logo"
                  className="h-12 w-auto rounded border border-border object-contain"
                />
                <button
                  onClick={() => onChange({ ...jobInfo, logo: null })}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" />
                อัปโหลดโลโก้
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobInfoForm;
