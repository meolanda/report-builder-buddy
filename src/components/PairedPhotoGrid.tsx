import { useRef, useState } from "react";
import { ImagePlus, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoItem } from "@/types/report";

const MAX_WIDTH = 1600, MAX_HEIGHT = 1200, QUALITY = 0.7;

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

interface Props {
  beforePhotos: PhotoItem[];
  afterPhotos: PhotoItem[];
  onChange: (before: PhotoItem[], after: PhotoItem[]) => void;
}

const PairedPhotoGrid = ({ beforePhotos, afterPhotos, onChange }: Props) => {
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef  = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const rowCount = Math.max(beforePhotos.length, afterPhotos.length, 0);

  const addPhotos = async (files: File[], side: "before" | "after") => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const newItems: PhotoItem[] = await Promise.all(
      imgs.map(async (f) => ({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: await compressImage(f),
        caption: "",
      }))
    );
    if (side === "before") onChange([...beforePhotos, ...newItems], afterPhotos);
    else onChange(beforePhotos, [...afterPhotos, ...newItems]);
  };

  const removePhoto = (side: "before" | "after", idx: number) => {
    if (side === "before") onChange(beforePhotos.filter((_, i) => i !== idx), afterPhotos);
    else onChange(beforePhotos, afterPhotos.filter((_, i) => i !== idx));
  };

  const updateCaption = (side: "before" | "after", idx: number, caption: string) => {
    if (side === "before")
      onChange(beforePhotos.map((p, i) => (i === idx ? { ...p, caption } : p)), afterPhotos);
    else
      onChange(beforePhotos, afterPhotos.map((p, i) => (i === idx ? { ...p, caption } : p)));
  };

  const PhotoCell = ({
    photo, side, idx,
  }: {
    photo: PhotoItem | null;
    side: "before" | "after";
    idx: number;
  }) => (
    <div className="p-1.5">
      {photo ? (
        <div className="group space-y-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded border border-border">
            <img
              src={photo.url}
              alt={photo.caption || "photo"}
              className="h-full w-full object-cover cursor-zoom-in"
              onClick={() => setLightbox(photo.url)}
            />
            <button
              onClick={() => removePhoto(side, idx)}
              className="absolute right-1 top-1 rounded-full bg-destructive/90 p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-1 right-1 rounded bg-black/40 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-3 w-3 text-white" />
            </div>
          </div>
          <Input
            placeholder="คำอธิบาย..."
            value={photo.caption}
            onChange={(e) => updateCaption(side, idx, e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      ) : (
        <div className="aspect-[4/3] flex items-center justify-center rounded border-2 border-dashed border-muted-foreground/20 text-muted-foreground/30 text-lg select-none">
          —
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border">
        {/* Column headers */}
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="bg-blue-50 py-2 text-center text-xs font-bold text-blue-700">
            📷 ก่อนทำ
          </div>
          <div className="bg-green-50 py-2 text-center text-xs font-bold text-green-600">
            ✅ หลังทำ
          </div>
        </div>

        {/* Pair rows */}
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 divide-x divide-border border-t border-border">
            <PhotoCell photo={beforePhotos[i] ?? null} side="before" idx={i} />
            <PhotoCell photo={afterPhotos[i] ?? null} side="after"  idx={i} />
          </div>
        ))}

        {/* Add-photo buttons */}
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            onClick={() => beforeRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            เพิ่มรูปก่อนทำ
          </button>
          <button
            onClick={() => afterRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-green-50 hover:text-green-600"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            เพิ่มรูปหลังทำ
          </button>
        </div>
      </div>

      <input
        ref={beforeRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addPhotos(Array.from(e.target.files || []), "before");
          if (beforeRef.current) beforeRef.current.value = "";
        }}
      />
      <input
        ref={afterRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addPhotos(Array.from(e.target.files || []), "after");
          if (afterRef.current) afterRef.current.value = "";
        }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="preview"
            className="max-h-[90vh] max-w-[90vw] rounded object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      )}
    </>
  );
};

export default PairedPhotoGrid;
