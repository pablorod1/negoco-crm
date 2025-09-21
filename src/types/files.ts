/**
 * Centralized TypeScript types for file preview system
 */

// File type categories
export type FileType = "image" | "pdf" | "office" | "text" | "unsupported";

// Supported file extensions
export type SupportedImageExtensions =
  | ".jpg"
  | ".jpeg"
  | ".png"
  | ".webp"
  | ".svg"
  | ".ico"
  | ".gif"
  | ".bmp"
  | ".avif";
export type SupportedPdfExtensions = ".pdf";
export type SupportedOfficeExtensions =
  | ".docx"
  | ".xlsx"
  | ".pptx"
  | ".doc"
  | ".xls"
  | ".ppt";
export type SupportedTextExtensions =
  | ".txt"
  | ".md"
  | ".json"
  | ".csv"
  | ".xml"
  | ".html"
  | ".css"
  | ".js"
  | ".ts"
  | ".tsx"
  | ".jsx"
  | ".yml"
  | ".yaml";

export type SupportedExtensions =
  | SupportedImageExtensions
  | SupportedPdfExtensions
  | SupportedOfficeExtensions
  | SupportedTextExtensions;

// MIME types mapping
export type SupportedMimeTypes =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/svg+xml"
  | "image/gif"
  | "image/bmp"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/msword"
  | "application/vnd.ms-excel"
  | "application/vnd.ms-powerpoint"
  | "text/plain"
  | "text/markdown"
  | "application/json"
  | "text/csv"
  | "text/xml"
  | "text/html"
  | "text/css"
  | "text/javascript"
  | "application/typescript"
  | "text/yaml";

// File data interface
export interface FileData {
  id: string;
  filename: string;
  extension: string;
  size: number;
  mimeType?: string;
  download_url: string;
  preview_url?: string;
  upload_date: string;
  type?: FileType;
}

// File preview component props
export interface FilePreviewProps {
  file: FileData;
  onClose: () => void;
  className?: string;
  isOpen?: boolean;
}

// Viewer component base props
export interface BaseViewerProps {
  file: FileData;
  onClose: () => void;
  className?: string;
}

// PDF viewer specific props
export interface PdfViewerProps extends BaseViewerProps {
  initialPage?: number;
  onPageChange?: (page: number) => void;
  enableSearch?: boolean;
  enableFullscreen?: boolean;
}

// Image viewer specific props
export interface ImageViewerProps extends BaseViewerProps {
  images?: FileData[];
  initialIndex?: number;
  enableRotation?: boolean;
  enableZoom?: boolean;
}

// Text viewer specific props
export interface TextViewerProps extends BaseViewerProps {
  maxLines?: number;
  enableSearch?: boolean;
  enableCopy?: boolean;
  syntaxHighlighting?: boolean;
}

// Office viewer specific props
export interface OfficeViewerProps extends BaseViewerProps {
  conversionEndpoint?: string;
  fallbackToDownload?: boolean;
}

// File type detection result
export interface FileTypeDetection {
  type: FileType;
  isSupported: boolean;
  suggestedViewer: "pdf" | "image" | "text" | "office" | "unsupported";
}

// Error states
export interface FilePreviewError {
  code:
    | "FILE_NOT_FOUND"
    | "UNSUPPORTED_FORMAT"
    | "LOAD_ERROR"
    | "CONVERSION_ERROR"
    | "NETWORK_ERROR";
  message: string;
  details?: string;
}

// Loading states
export type LoadingState = "idle" | "loading" | "success" | "error";

// Viewer state interface
export interface ViewerState {
  loading: LoadingState;
  error?: FilePreviewError;
  currentPage?: number;
  totalPages?: number;
  zoom?: number;
  fullscreen?: boolean;
}

// File conversion API response
export interface ConversionResponse {
  success: boolean;
  convertedUrl?: string;
  error?: string;
  originalFilename: string;
  convertedFilename?: string;
}

// Utility type guards
export const isImageFile = (
  extension: string
): extension is SupportedImageExtensions => {
  const imageExtensions: SupportedImageExtensions[] = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".svg",
    ".gif",
    ".bmp",
    ".ico",
    ".avif",
  ];
  return imageExtensions.includes(
    extension.toLowerCase() as SupportedImageExtensions
  );
};

export const isPdfFile = (
  extension: string
): extension is SupportedPdfExtensions => {
  return extension.toLowerCase() === ".pdf";
};

export const isOfficeFile = (
  extension: string
): extension is SupportedOfficeExtensions => {
  const officeExtensions: SupportedOfficeExtensions[] = [
    ".docx",
    ".xlsx",
    ".pptx",
    ".doc",
    ".xls",
    ".ppt",
  ];
  return officeExtensions.includes(
    extension.toLowerCase() as SupportedOfficeExtensions
  );
};

export const isTextFile = (
  extension: string
): extension is SupportedTextExtensions => {
  const textExtensions: SupportedTextExtensions[] = [
    ".txt",
    ".md",
    ".json",
    ".csv",
    ".xml",
    ".html",
    ".css",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".yml",
    ".yaml",
  ];
  return textExtensions.includes(
    extension.toLowerCase() as SupportedTextExtensions
  );
};

// File type detection utility
export const detectFileType = (file: FileData): FileTypeDetection => {
  // Normalize extension: ensure it starts with a dot and is lowercase
  let extension = file.extension.toLowerCase();
  if (!extension.startsWith(".")) {
    extension = "." + extension;
  }

  if (isImageFile(extension)) {
    return { type: "image", isSupported: true, suggestedViewer: "image" };
  }

  if (isPdfFile(extension)) {
    return { type: "pdf", isSupported: true, suggestedViewer: "pdf" };
  }

  if (isOfficeFile(extension)) {
    return { type: "office", isSupported: true, suggestedViewer: "office" };
  }

  if (isTextFile(extension)) {
    return { type: "text", isSupported: true, suggestedViewer: "text" };
  }

  return {
    type: "unsupported",
    isSupported: false,
    suggestedViewer: "unsupported",
  };
};

// Constants
export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export const DEFAULT_ZOOM = 1.0;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.0;
