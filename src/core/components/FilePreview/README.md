# FilePreview System - CRM Next.js 15

A comprehensive file preview system built for the CRM application using Next.js 15, TypeScript, and modern React patterns. This system provides unified file viewing capabilities with automatic format detection and specialized viewers for different file types.

## 🚀 Features

### Core Capabilities
- **Automatic file type detection** based on extensions and MIME types
- **Unified interface** with consistent controls across all viewers
- **Responsive design** with mobile-first approach
- **Accessibility support** with ARIA labels and keyboard navigation
- **Error handling** with comprehensive error states and retry mechanisms
- **TypeScript strict mode** with full type safety

### Supported File Types

#### 📄 PDF Documents
- Zoom controls (25% - 200%)
- Page navigation with keyboard shortcuts
- Text search functionality
- Fullscreen mode
- Document rotation
- Loading progress indicators

#### 🖼️ Images
- Zoom and rotation controls
- Lightbox mode with react-photo-view
- Navigation between multiple images
- Touch gesture support for mobile
- Support for: JPG, PNG, WebP, SVG, GIF, BMP

#### 📝 Text Files
- Syntax highlighting for code files
- Search with match highlighting
- Copy to clipboard functionality
- Line numbers display
- Support for: TXT, MD, JSON, CSV, XML, HTML, CSS, JS, TS, YAML

#### 📋 Office Documents
- Automatic conversion to PDF for preview
- Support for Word, Excel, PowerPoint documents
- Fallback download option
- Retry mechanism for failed conversions
- Progress indicators during conversion

## 📁 Project Structure

```
src/
├── core/components/FilePreview/
│   ├── FilePreview.tsx              # Main component with routing logic
│   └── viewers/
│       ├── PdfViewer.tsx           # PDF document viewer
│       ├── ImageViewer.tsx         # Image viewer with lightbox
│       ├── TextViewer.tsx          # Text file viewer with syntax highlighting
│       └── OfficeViewer.tsx        # Office document viewer with conversion
├── types/
│   └── files.ts                    # Centralized TypeScript types
└── app/api/v2/files/
    └── convert-office/
        └── route.ts                # Office document conversion API
```

## 🔧 Installation & Setup

### Dependencies
The system uses the following key dependencies:
- `react-pdf` - PDF rendering and controls
- `react-photo-view` - Image lightbox functionality
- `@types/react-pdf` - TypeScript definitions

```bash
bun add react-pdf react-photo-view @types/react-pdf
```

### Configuration
The `next.config.ts` file includes necessary configurations for:
- React-PDF worker setup
- Image remote patterns for demo PDFs
- Webpack configuration for PDF.js
- CORS headers for PDF worker

## 💻 Usage Examples

### Basic Implementation
```tsx
import FilePreview from '@/core/components/FilePreview/FilePreview';
import { FileData } from '@/types/files';

function MyComponent() {
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handlePreview = (file: FileData) => {
    setPreviewFile(file);
    setIsOpen(true);
  };

  return (
    <>
      <button onClick={() => handlePreview(myFile)}>
        Preview File
      </button>
      
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setIsOpen(false)}
          isOpen={isOpen}
        />
      )}
    </>
  );
}
```

### Integrated with File List
```tsx
// Example from TramiteFilesList.tsx
const handlePreviewFile = (file: TramiteFile) => {
  const fileData: FileData = {
    id: file.id,
    filename: file.filename,
    extension: file.extension,
    size: file.size,
    download_url: file.download_url,
    preview_url: file.preview_url || undefined,
    upload_date: file.upload_date,
  };
  
  setPreviewFile(fileData);
  setIsPreviewOpen(true);
};
```

### Using Individual Viewers
```tsx
import PdfViewer from '@/core/components/FilePreview/viewers/PdfViewer';

// Direct PDF viewer usage
<PdfViewer
  file={pdfFile}
  onClose={handleClose}
  enableSearch={true}
  enableFullscreen={true}
  initialPage={1}
  onPageChange={(page) => {/* Handle page change */}}
/>
```

## 🎨 Customization

### Adding New File Types

1. **Update Type Definitions**
```typescript
// src/types/files.ts
export type SupportedNewExtensions = '.newext';
export type SupportedExtensions = 
  | SupportedImageExtensions 
  | SupportedPdfExtensions 
  | SupportedOfficeExtensions 
  | SupportedTextExtensions
  | SupportedNewExtensions; // Add your new type

// Add type guard
export const isNewFileType = (extension: string): extension is SupportedNewExtensions => {
  return extension.toLowerCase() === '.newext';
};

// Update detection function
export const detectFileType = (file: FileData): FileTypeDetection => {
  const extension = file.extension.toLowerCase();
  
  if (isNewFileType(extension)) {
    return { type: 'new', isSupported: true, suggestedViewer: 'new' };
  }
  
  // ... existing logic
};
```

2. **Create New Viewer Component**
```typescript
// src/core/components/FilePreview/viewers/NewViewer.tsx
import React from 'react';
import { BaseViewerProps } from '@/types/files';

export default function NewViewer({ file, onClose, className }: BaseViewerProps) {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Your viewer implementation */}
    </div>
  );
}
```

3. **Update Main FilePreview Component**
```typescript
// Add lazy import
const NewViewer = React.lazy(() => import('./viewers/NewViewer'));

// Add case in renderViewer function
case 'new':
  return (
    <React.Suspense fallback={<ViewerLoadingState />}>
      <NewViewer {...viewerProps} />
    </React.Suspense>
  );
```

### Styling Customization

The system uses Tailwind CSS with Shadcn/ui components. Key customization points:

```typescript
// Custom className props are available on all components
<FilePreview 
  file={file} 
  onClose={onClose}
  className="custom-preview-styles"
/>

// Viewer-specific styling
<PdfViewer 
  file={file}
  onClose={onClose}
  className="custom-pdf-viewer"
/>
```

### API Integration

#### Office Document Conversion
Replace the stub implementation in `/api/v2/files/convert-office/route.ts`:

```typescript
// Example: CloudConvert integration
async function convertWithCloudConvert(fileUrl: string, filename: string): Promise<string> {
  const CloudConvert = require('cloudconvert');
  const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY);

  const job = await cloudConvert.jobs.create({
    tasks: {
      'import-file': {
        operation: 'import/url',
        url: fileUrl
      },
      'convert-file': {
        operation: 'convert',
        input: 'import-file',
        output_format: 'pdf'
      },
      'export-file': {
        operation: 'export/url',
        input: 'convert-file'
      }
    }
  });

  const completedJob = await cloudConvert.jobs.wait(job.id);
  const exportTask = completedJob.tasks.find(task => task.name === 'export-file');
  
  return exportTask.result.files[0].url;
}
```

## 🔍 Testing

### Component Testing
```typescript
// Example test for file type detection
import { detectFileType } from '@/types/files';

describe('File Type Detection', () => {
  it('should detect PDF files correctly', () => {
    const file = { extension: '.pdf', /* ... */ };
    const result = detectFileType(file);
    expect(result.type).toBe('pdf');
    expect(result.isSupported).toBe(true);
  });
});
```

### Integration Testing
Test the FilePreview component with different file types to ensure proper viewer routing and error handling.

## 🚨 Error Handling

The system includes comprehensive error handling:

### Error Types
- `FILE_NOT_FOUND` - File URL is not accessible
- `UNSUPPORTED_FORMAT` - File type not supported
- `LOAD_ERROR` - Failed to load file content
- `CONVERSION_ERROR` - Office document conversion failed
- `NETWORK_ERROR` - Network connectivity issues

### Error Recovery
- Automatic retry mechanisms (up to 3 attempts)
- Fallback to download for unsupported formats
- User-friendly error messages with action buttons
- Detailed error logging for debugging

## 📱 Mobile Support

- Touch gesture support for image zooming and navigation
- Responsive design that adapts to screen sizes
- Mobile-optimized controls and button sizes
- Swipe navigation for image galleries

## ♿ Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast support
- Focus management for modal dialogs

## 🔧 Performance Optimizations

- Lazy loading of viewer components
- Image optimization with Next.js Image component
- Virtual scrolling for large text files
- Efficient PDF rendering with react-pdf
- Memoized components to prevent unnecessary re-renders

## 📝 API Reference

### FileData Interface
```typescript
interface FileData {
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
```

### FilePreview Props
```typescript
interface FilePreviewProps {
  file: FileData;
  onClose: () => void;
  className?: string;
  isOpen?: boolean;
}
```

## 🔄 Future Enhancements

### Planned Features
- [ ] Video file support with HTML5 video player
- [ ] Audio file support with waveform visualization
- [ ] CAD file preview integration
- [ ] Real-time collaborative viewing
- [ ] File annotation capabilities
- [ ] Advanced search within documents
- [ ] Print functionality
- [ ] Bookmark/favorites system

### Integration Opportunities
- [ ] Integration with cloud storage providers (Dropbox, Google Drive)
- [ ] OCR capabilities for scanned documents
- [ ] Machine learning-based content analysis
- [ ] Version comparison for documents
- [ ] Digital signature verification

## 🤝 Contributing

1. Follow the existing TypeScript patterns and interfaces
2. Add proper error handling for new viewers
3. Include accessibility features in new components
4. Write unit tests for new functionality
5. Update this README with new features or changes

## 📄 License

This file preview system is part of the CRM application and follows the project's licensing terms.

---

For more detailed implementation examples and advanced usage patterns, refer to the existing components in the codebase and the TypeScript definitions in `/src/types/files.ts`.