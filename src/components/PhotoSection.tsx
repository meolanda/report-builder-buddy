import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Upload, Pencil, Check, X, ImagePlus } from "lucide-react";
import { PhotoSection as PhotoSectionType, PhotoItem } from "@/types/report";

interface Props {
  section: PhotoSectionType;
  onUpdate: (section: PhotoSectionType) => void;
  onDelete: () => void;
}

const PhotoSection = ({ section, onUpdate, onDelete }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const promises = files.map(
      (file) =>
        new Promise<PhotoItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              url: reader.result as string,
              caption: "",
            });
          reader.readAsDataURL(file);
        })
    );

    Promise.all(promises).then((newPhotos) => {
      onUpdate({ ...section, photos: [...section.photos, ...newPhotos] });
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (photoId: string) => {
    onUpdate({
      ...section,
      photos: section.photos.filter((p) => p.id !== photoId),
    });
  };

  const updateCaption = (photoId: string, caption: string) => {
    onUpdate({
      ...section,
      photos: section.photos.map((p) =>
        p.id === photoId ? { ...p, caption } : p
      ),
    });
  };

  const saveTitle = () => {
    onUpdate({ ...section, title: editTitle });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-8 w-64"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setEditTitle(section.title);
                  setIsEditing(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Photo grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {section.photos.map((photo) => (
            <div key={photo.id} className="group relative space-y-1">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border">
                <img
                  src={photo.url}
                  alt={photo.caption || "photo"}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => removePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-destructive/90 p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Input
                placeholder="คำอธิบาย..."
                value={photo.caption}
                onChange={(e) => updateCaption(photo.id, e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          ))}

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <ImagePlus className="h-8 w-8" />
            <span className="text-xs">เพิ่มรูป</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotos}
        />
      </CardContent>
    </Card>
  );
};

export default PhotoSection;
