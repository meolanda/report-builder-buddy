import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Category } from "@/types/report";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (category: Category) => void;
}

const ICON_OPTIONS = ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣", "⚪", "🔧", "⚡", "🏗️", "🧹", "📋"];

const AddCategoryDialog = ({ open, onClose, onAdd }: Props) => {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🔵");
  const [type, setType] = useState<"unit-based" | "fixed-sub">("fixed-sub");

  const handleAdd = () => {
    if (!name.trim()) return;
    const id = `cat-custom-${Date.now()}`;
    const newCat: Category = {
      id,
      name: name.trim(),
      icon,
      colorClass: "primary",
      type,
      units: type === "unit-based"
        ? [{ id: `${id}-unit-1`, name: `${name.trim()} ยูนิตที่ 1`, beforePhotos: [], afterPhotos: [] }]
        : [],
      subSections: type === "fixed-sub"
        ? [{ id: `${id}-sub-1`, name: "หัวข้อย่อย 1", photos: [] }]
        : [],
    };
    onAdd(newCat);
    setName("");
    setIcon("🔵");
    setType("fixed-sub");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มหมวดหมู่ใหม่</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>ชื่อหมวดหมู่</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ระบบน้ำ, งานสี" />
          </div>
          <div>
            <Label>ไอคอน</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors ${
                    icon === ic ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>ประเภท</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as "unit-based" | "fixed-sub")} className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="unit-based" id="type-unit" />
                <Label htmlFor="type-unit" className="font-normal">
                  แบบยูนิต (ก่อน/หลัง) — เช่น แอร์, ตู้แช่
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed-sub" id="type-sub" />
                <Label htmlFor="type-sub" className="font-normal">
                  แบบหัวข้อย่อย — เช่น ระบบอาคาร, เอกสาร
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>เพิ่มหมวดหมู่</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCategoryDialog;
