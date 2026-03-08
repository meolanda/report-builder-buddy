import { useRef, useState, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, X } from "lucide-react";
import { PhotoItem } from "@/types/report";

interface Props {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  label?: string;
}

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1200;
const QUALITY = 0.7;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const PhotoGrid = ({ photos, onChange, label }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const newPhotos = await Promise.all(
      imageFiles.map(async (file) => ({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: await compressImage(file),
        caption: "",
      }))
    );
    onChange([...photos, ...newPhotos]);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removePhoto = (id: string) => onChange(photos.filter((p) => p.id !== id));
  const updateCaption = (id: string, caption: string) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));

  return (
    <div
      className="space-y-2"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      {isDragging && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 py-8">
          <p className="text-sm font-medium text-primary">วางรูปภาพที่นี่</p>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${isDragging ? "opacity-50" : ""}`}>
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
          <span className="text-[10px]">เพิ่มรูป / ลากวาง</span>
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
};

export default PhotoGrid;
