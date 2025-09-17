/**
 * Office Document Conversion API Endpoint
 *
 * This endpoint handles the conversion of Office documents (Word, Excel, PowerPoint)
 * to PDF format for preview purposes. Currently implemented as a stub that simulates
 * the conversion process.
 *
 * Future integration options:
 * - CloudConvert API
 * - LibreOffice headless conversion
 * - Microsoft Graph API
 * - Local conversion services
 */

import { NextRequest, NextResponse } from "next/server";
import { ConversionResponse } from "@/types/files";

// Supported office file extensions
const SUPPORTED_EXTENSIONS = [
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
];

// Maximum file size for conversion (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * POST /api/v2/files/convert-office
 *
 * Converts Office documents to PDF format
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileUrl = formData.get("fileUrl") as string;
    const filename = formData.get("filename") as string;
    const extension = formData.get("extension") as string;

    // Validate required fields
    if (!fileUrl || !filename || !extension) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos requeridos: fileUrl, filename, extension",
          originalFilename: filename || "unknown",
        } as ConversionResponse,
        { status: 400 }
      );
    }

    // Validate file extension
    if (!SUPPORTED_EXTENSIONS.includes(extension.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Formato no soportado: ${extension}. Formatos válidos: ${SUPPORTED_EXTENSIONS.join(", ")}`,
          originalFilename: filename,
        } as ConversionResponse,
        { status: 400 }
      );
    }

    // Simulate conversion process delay
    await new Promise((resolve) =>
      setTimeout(resolve, 2000 + Math.random() * 3000)
    );

    // Simulate random failure for testing (10% chance)
    if (Math.random() < 0.1) {
      return NextResponse.json(
        {
          success: false,
          error: "Error simulado en la conversión. Reintenta.",
          originalFilename: filename,
        } as ConversionResponse,
        { status: 500 }
      );
    }

    // For demo purposes, we'll return a successful response with a mock PDF URL
    // In a real implementation, this would:
    // 1. Download the original file from fileUrl
    // 2. Convert it to PDF using your chosen conversion service
    // 3. Upload the converted PDF to your storage
    // 4. Return the URL of the converted PDF

    const convertedFilename = `${filename.replace(/\.[^/.]+$/, "")}.pdf`;

    // Mock converted PDF URL (you would replace this with actual conversion logic)
    const convertedUrl = generateMockPdfUrl(filename);

    const response: ConversionResponse = {
      success: true,
      convertedUrl,
      originalFilename: filename,
      convertedFilename,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Office conversion error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor durante la conversión",
        originalFilename: "unknown",
      } as ConversionResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/v2/files/convert-office
 *
 * Returns information about the conversion service
 */
export async function GET() {
  return NextResponse.json({
    service: "Office Document Conversion API",
    version: "1.0.0",
    supportedFormats: SUPPORTED_EXTENSIONS,
    maxFileSize: MAX_FILE_SIZE,
    status: "active (stub implementation)",
  });
}

/**
 * Generate a mock PDF URL for demonstration purposes
 * In a real implementation, this would be replaced with actual conversion logic
 */
function generateMockPdfUrl(filename: string): string {
  // For demonstration, we'll use a sample PDF from the web
  // In production, this would be the URL of your converted file

  const samplePdfs = [
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "https://www.africau.edu/images/default/sample.pdf",
  ];

  // Use filename hash to consistently return the same mock PDF for the same file
  const hash = filename.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const pdfIndex = Math.abs(hash) % samplePdfs.length;

  return samplePdfs[pdfIndex];
}

/**
 * Real implementation helpers for future integration
 */

// Example: CloudConvert integration
/*
async function convertWithCloudConvert(fileUrl: string, filename: string, extension: string): Promise<string> {
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

  // Wait for job completion and return the converted file URL
  const completedJob = await cloudConvert.jobs.wait(job.id);
  const exportTask = completedJob.tasks.find(task => task.name === 'export-file');
  
  return exportTask.result.files[0].url;
}
*/

// Example: LibreOffice headless conversion
/*
async function convertWithLibreOffice(inputPath: string, outputPath: string): Promise<void> {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  const command = `libreoffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${inputPath}"`;
  
  try {
    await execAsync(command);
  } catch (error) {
    throw new Error(`LibreOffice conversion failed: ${error.message}`);
  }
}
*/
