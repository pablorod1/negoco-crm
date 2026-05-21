type ExcelCellValue = string | number | boolean | null | undefined;

interface ExportRowsToExcelOptions {
  rows: Record<string, ExcelCellValue>[];
  sheetName: string;
  fileName: string;
}

const sanitizeSheetName = (sheetName: string) =>
  sheetName.replace(/[\][*?/\\:]/g, "").slice(0, 31) || "Export";

const normalizeFileName = (fileName: string) =>
  fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;

export const getExportDateStamp = () => new Date().toISOString().slice(0, 10);

export async function exportRowsToExcel({
  rows,
  sheetName,
  fileName,
}: ExportRowsToExcelOptions) {
  if (rows.length === 0) {
    throw new Error("No hay datos para exportar");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));
  XLSX.writeFile(workbook, normalizeFileName(fileName));
}
