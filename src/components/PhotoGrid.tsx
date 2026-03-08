import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, X } from "lucide-react";
import { PhotoItem } from "@/types/report";

interface Props {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  label?: string;
}

const PhotoGrid = ({ photos, onChange, label }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    Promise.all(promises).then((newPhotos) => onChange([...photos, ...newPhotos]));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (id: string) => onChange(photos.filter((p) => p.id !== id));
  const updateCaption = (id: string, caption: string) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative space-y-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border">
              <img src={photo.url} alt={photo.caption || "photo"} className="h-full w-full object-cover" />
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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-[10px]">เพิ่มรูป</span>
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
};

export default PhotoGrid;
