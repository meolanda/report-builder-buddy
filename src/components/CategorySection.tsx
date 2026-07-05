import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { Category, CategoryUnit } from "@/types/report";
import PhotoGrid from "@/components/PhotoGrid";
import PairedPhotoGrid from "@/components/PairedPhotoGrid";

interface Props {
  category: Category;
  onUpdate: (cat: Category) => void;
}

const UnitBasedSection = ({ category, onUpdate }: Props) => {
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set(category.units.map((u) => u.id)));
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editUnitName, setEditUnitName] = useState("");

  const toggleUnit = (id: string) => {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addUnit = () => {
    const num = category.units.length + 1;
    const newUnit: CategoryUnit = {
      id: `${category.id}-unit-${Date.now()}`,
      name: `${category.name} ยูนิตที่ ${num}`,
      beforePhotos: [],
      afterPhotos: [],
    };
    onUpdate({ ...category, units: [...category.units, newUnit] });
    setOpenUnits((prev) => new Set(prev).add(newUnit.id));
  };

  const deleteUnit = (unitId: string) => {
    if (category.units.length <= 1) return;
    onUpdate({ ...category, units: category.units.filter((u) => u.id !== unitId) });
  };

  const updateUnit = (unitId: string, partial: Partial<CategoryUnit>) => {
    onUpdate({ ...category, units: category.units.map((u) => (u.id === unitId ? { ...u, ...partial } : u)) });
  };

  const saveEditUnit = (unitId: string) => {
    if (editUnitName.trim()) {
      onUpdate({ ...category, units: category.units.map((u) => u.id === unitId ? { ...u, name: editUnitName.trim() } : u) });
    }
    setEditingUnitId(null);
  };

  return (
    <div className="space-y-2">
      {category.units.map((unit) => (
        <Collapsible key={unit.id} open={openUnits.has(unit.id)} onOpenChange={() => toggleUnit(unit.id)}>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {openUnits.has(unit.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            {editingUnitId === unit.id ? (
              <input
                className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm"
                value={editUnitName}
                onChange={(e) => setEditUnitName(e.target.value)}
                onBlur={() => saveEditUnit(unit.id)}
                onKeyDown={(e) => e.key === "Enter" && saveEditUnit(unit.id)}
                autoFocus
              />
            ) : (
              <span
                className="flex-1 cursor-pointer text-sm font-medium hover:text-primary"
                onDoubleClick={() => { setEditingUnitId(unit.id); setEditUnitName(unit.name); }}
              >
                {unit.name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {unit.beforePhotos.length + unit.afterPhotos.length} รูป
            </span>
            {category.units.length > 1 && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteUnit(unit.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <CollapsibleContent className="ml-4 mt-2 border-l-2 border-border pl-4">
            <PairedPhotoGrid
              beforePhotos={unit.beforePhotos}
              afterPhotos={unit.afterPhotos}
              onChange={(before, after) =>
                updateUnit(unit.id, { beforePhotos: before, afterPhotos: after })
              }
            />
          </CollapsibleContent>
        </Collapsible>
      ))}

      <Button variant="outline" size="sm" className="w-full" onClick={addUnit}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        เพิ่มยูนิต
      </Button>
    </div>
  );
};

const FixedSubSection = ({ category, onUpdate }: Props) => {
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set(category.subSections.map((s) => s.id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const toggleSub = (id: string) => {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addSubSection = () => {
    const num = category.subSections.length + 1;
    const newSub = { id: `${category.id}-sub-${Date.now()}`, name: `หัวข้อย่อย ${num}`, photos: [] };
    onUpdate({ ...category, subSections: [...category.subSections, newSub] });
    setOpenSubs((prev) => new Set(prev).add(newSub.id));
  };

  const deleteSubSection = (subId: string) => {
    if (category.subSections.length <= 1) return;
    onUpdate({ ...category, subSections: category.subSections.filter((s) => s.id !== subId) });
  };

  const moveSub = (subId: string, dir: "up" | "down") => {
    const subs = [...category.subSections];
    const idx = subs.findIndex((s) => s.id === subId);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swap < 0 || swap >= subs.length) return;
    [subs[idx], subs[swap]] = [subs[swap], subs[idx]];
    onUpdate({ ...category, subSections: subs });
  };

  const startEdit = (sub: { id: string; name: string }) => {
    setEditingId(sub.id);
    setEditName(sub.name);
  };

  const saveEdit = (subId: string) => {
    if (editName.trim()) {
      onUpdate({
        ...category,
        subSections: category.subSections.map((s) => (s.id === subId ? { ...s, name: editName.trim() } : s)),
      });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {category.subSections.map((sub, idx) => (
        <Collapsible key={sub.id} open={openSubs.has(sub.id)} onOpenChange={() => toggleSub(sub.id)}>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {openSubs.has(sub.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            {editingId === sub.id ? (
              <input
                className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => saveEdit(sub.id)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(sub.id); if (e.key === "Escape") setEditingId(null); }}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm font-medium">{sub.name}</span>
            )}
            <span className="text-xs text-muted-foreground">{sub.photos.length} รูป</span>
            {/* Edit name */}
            <Button
              variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={() => startEdit(sub)}
              title="แก้ชื่อ"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {/* Move up/down */}
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              disabled={idx === 0}
              onClick={() => moveSub(sub.id, "up")}
              title="เลื่อนขึ้น"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              disabled={idx === category.subSections.length - 1}
              onClick={() => moveSub(sub.id, "down")}
              title="เลื่อนลง"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            {category.subSections.length > 1 && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSubSection(sub.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <CollapsibleContent className="ml-4 mt-2 border-l-2 border-border pl-4">
            <PhotoGrid
              photos={sub.photos}
              onChange={(photos) =>
                onUpdate({
                  ...category,
                  subSections: category.subSections.map((s) => (s.id === sub.id ? { ...s, photos } : s)),
                })
              }
            />
          </CollapsibleContent>
        </Collapsible>
      ))}

      <Button variant="outline" size="sm" className="w-full" onClick={addSubSection}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        เพิ่มหัวข้อย่อย
      </Button>
    </div>
  );
};

interface CategorySectionProps {
  category: Category;
  onUpdate: (cat: Category) => void;
  onDelete?: () => void;
  isCustom?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const CategorySection = ({
  category, onUpdate, onDelete, isCustom,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: CategorySectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [editingCatName, setEditingCatName] = useState(false);
  const [catNameVal, setCatNameVal] = useState(category.name);

  const saveCatName = () => {
    if (catNameVal.trim()) onUpdate({ ...category, name: catNameVal.trim() });
    else setCatNameVal(category.name);
    setEditingCatName(false);
  };

  const totalPhotos = category.type === "unit-based"
    ? category.units.reduce((sum, u) => sum + u.beforePhotos.length + u.afterPhotos.length, 0)
    : category.subSections.reduce((sum, s) => sum + s.photos.length, 0);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </CollapsibleTrigger>
              <span className="text-lg shrink-0">{category.icon}</span>
              {editingCatName ? (
                <input
                  className="rounded border border-input bg-background px-2 py-0.5 text-sm font-semibold flex-1 min-w-0"
                  value={catNameVal}
                  onChange={(e) => setCatNameVal(e.target.value)}
                  onBlur={saveCatName}
                  onKeyDown={(e) => e.key === "Enter" && saveCatName()}
                  autoFocus
                />
              ) : (
                <CardTitle
                  className="text-base cursor-pointer hover:text-primary"
                  onDoubleClick={() => { setEditingCatName(true); setCatNameVal(category.name); }}
                >
                  {category.name}
                </CardTitle>
              )}
              <span className="text-xs text-muted-foreground shrink-0">({totalPhotos} รูป)</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={!canMoveUp}
                onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                title="เลื่อนขึ้น"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={!canMoveDown}
                onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                title="เลื่อนลง"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              {isCustom && onDelete && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {category.type === "unit-based" ? (
              <UnitBasedSection category={category} onUpdate={onUpdate} />
            ) : (
              <FixedSubSection category={category} onUpdate={onUpdate} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default CategorySection;
