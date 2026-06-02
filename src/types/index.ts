export type ConversionStatus = "Pending" | "Converting" | "Done" | "Error";

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  targetFormat: string;
  targetWidth: number;
  targetHeight: number;
  status: ConversionStatus;
  progress: number;
  outputUrl?: string;
  outputBlob?: Blob;
  createdAt: number;
}
