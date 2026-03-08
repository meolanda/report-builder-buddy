export interface JobInfo {
  clientName: string;
  dateTime: string;
  location: string;
  reporterName: string;
  logo: string | null;
  footerNote: string;
  subject: string;
}

export interface PhotoItem {
  id: string;
  url: string;
  caption: string;
}

// Unit-based category (แอร์, ตู้แช่) — each unit has before/after
export interface CategoryUnit {
  id: string;
  name: string;
  beforePhotos: PhotoItem[];
  afterPhotos: PhotoItem[];
}

// Sub-section for fixed-sub categories (Hood, อาคาร, เอกสาร)
export interface SubSection {
  id: string;
  name: string;
  photos: PhotoItem[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  colorClass: string; // tailwind bg class token
  type: "unit-based" | "fixed-sub";
  units: CategoryUnit[];
  subSections: SubSection[];
}

// Keep legacy for PDF compat
export interface PhotoSection {
  id: string;
  title: string;
  photos: PhotoItem[];
}

export interface ReportData {
  jobInfo: JobInfo;
  categories: Category[];
  conclusion: string;
}

export interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: ReportData;
}

// Default categories
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat-air",
    name: "แอร์",
    icon: "🔵",
    colorClass: "primary",
    type: "unit-based",
    units: [
      { id: "air-unit-1", name: "แอร์ ยูนิตที่ 1", beforePhotos: [], afterPhotos: [] },
    ],
    subSections: [],
  },
  {
    id: "cat-freezer",
    name: "ตู้แช่",
    icon: "🟦",
    colorClass: "primary",
    type: "unit-based",
    units: [
      { id: "freezer-unit-1", name: "ตู้แช่ ยูนิตที่ 1", beforePhotos: [], afterPhotos: [] },
    ],
    subSections: [],
  },
  {
    id: "cat-hood",
    name: "ระบบ Hood",
    icon: "🟡",
    colorClass: "accent",
    type: "fixed-sub",
    units: [],
    subSections: [
      { id: "hood-1", name: "Hood", photos: [] },
      { id: "hood-2", name: "คอยล์ร้อน", photos: [] },
      { id: "hood-3", name: "ปลายปล่อง Hood", photos: [] },
      { id: "hood-4", name: "มอเตอร์ Hood", photos: [] },
    ],
  },
  {
    id: "cat-building",
    name: "ระบบอาคาร",
    icon: "🟠",
    colorClass: "accent",
    type: "fixed-sub",
    units: [],
    subSections: [
      { id: "bld-1", name: "ระบบไฟฟ้า", photos: [] },
      { id: "bld-2", name: "ระบบประปา", photos: [] },
      { id: "bld-3", name: "สุขาภิบาล", photos: [] },
      { id: "bld-4", name: "ฝ้า", photos: [] },
    ],
  },
  {
    id: "cat-docs",
    name: "เอกสาร / บันทึก",
    icon: "📄",
    colorClass: "secondary",
    type: "fixed-sub",
    units: [],
    subSections: [
      { id: "doc-1", name: "รูปเข้า-ออกพื้นที่", photos: [] },
      { id: "doc-2", name: "ใบส่งมอบ", photos: [] },
      { id: "doc-3", name: "รายงาน", photos: [] },
    ],
  },
];
