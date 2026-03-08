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

export interface PhotoSection {
  id: string;
  title: string;
  photos: PhotoItem[];
}

export interface ReportData {
  jobInfo: JobInfo;
  sections: PhotoSection[];
  conclusion: string;
}

export interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: ReportData;
}
