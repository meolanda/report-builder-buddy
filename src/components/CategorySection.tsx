import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Category, CategoryUnit } from "@/types/report";
import PhotoGrid from "@/components/PhotoGrid";

interface Props {
  category: Category;
  onUpdate: (cat: Category) => void;
}

const UnitBasedSection = ({ category, onUpdate }: Props) => {
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set(category.units.map((u) => u.id)));

  const toggleUnit = (id: string) => {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addUnit = () => {
    const num = category.units.length + 1;
    const baseName = category.name; // e.g. "แอร์"
    const newUnit: CategoryUnit = {
      id: `${category.id}-unit-${Date.now()}`,
      name: `${baseName} ยูนิตที่ ${num}`,
      beforePhotos: [],
      afterPhotos: [],
    };
    const updated = { ...category, units: [...category.units, newUnit] };
    onUpdate(updated);
    setOpenUnits((prev) => new Set(prev).add(newUnit.id));
  };

  const deleteUnit = (unitId: string) => {
    if (category.units.length <= 1) return;
    onUpdate({ ...category, units: category.units.filter((u) => u.id !== unitId) });
  };

  const updateUnit = (unitId: string, partial: Partial<CategoryUnit>) => {
    onUpdate({
      ...category,
      units: category.units.map((u) => (u.id === unitId ? { ...u, ...partial } : u)),
    });
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
            <span className="flex-1 text-sm font-medium">{unit.name}</span>
            <span className="text-xs text-muted-foreground">
              {unit.beforePhotos.length + unit.afterPhotos.length} รูป
            </span>
            {category.units.length > 1 && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteUnit(unit.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <CollapsibleContent className="ml-4 mt-2 space-y-3 border-l-2 border-border pl-4">
            <PhotoGrid
              label="📷 ก่อนทำ"
              photos={unit.beforePhotos}
              onChange={(photos) => updateUnit(unit.id, { beforePhotos: photos })}
            />
            <PhotoGrid
              label="✅ หลังทำ"
              photos={unit.afterPhotos}
              onChange={(photos) => updateUnit(unit.id, { afterPhotos: photos })}
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
    const newSub = {
      id: `${category.id}-sub-${Date.now()}`,
      name: `หัวข้อย่อย ${num}`,
      photos: [],
    };
    onUpdate({ ...category, subSections: [...category.subSections, newSub] });
    setOpenSubs((prev) => new Set(prev).add(newSub.id));
  };

  const deleteSubSection = (subId: string) => {
    if (category.subSections.length <= 1) return;
    onUpdate({ ...category, subSections: category.subSections.filter((s) => s.id !== subId) });
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
      {category.subSections.map((sub) => (
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
                onKeyDown={(e) => e.key === "Enter" && saveEdit(sub.id)}
                autoFocus
              />
            ) : (
              <span
                className="flex-1 cursor-pointer text-sm font-medium hover:text-primary"
                onDoubleClick={() => startEdit(sub)}
              >
                {sub.name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{sub.photos.length} รูป</span>
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

  const totalPhotos = category.type === "unit-based"
    ? category.units.reduce((sum, u) => sum + u.beforePhotos.length + u.afterPhotos.length, 0)
    : category.subSections.reduce((sum, s) => sum + s.photos.length, 0);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-left">
                <span className="text-lg">{category.icon}</span>
                <CardTitle className="text-base">{category.name}</CardTitle>
                <span className="text-xs text-muted-foreground">({totalPhotos} รูป)</span>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-1">
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
