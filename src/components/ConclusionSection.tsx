import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  conclusion: string;
  onConclusionChange: (val: string) => void;
  footerNote: string;
  onFooterNoteChange: (val: string) => void;
}

const ConclusionSection = ({
  conclusion,
  onConclusionChange,
  footerNote,
  onFooterNoteChange,
}: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">สรุปผลงาน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>สรุปผลการปฏิบัติงาน</Label>
          <Textarea
            placeholder="สรุปรายละเอียดผลงาน..."
            value={conclusion}
            onChange={(e) => onConclusionChange(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>หมายเหตุท้ายรายงาน</Label>
          <Textarea
            placeholder="ข้อความท้ายรายงาน เช่น ขอบคุณที่ไว้วางใจ..."
            value={footerNote}
            onChange={(e) => onFooterNoteChange(e.target.value)}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ConclusionSection;
