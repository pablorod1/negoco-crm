import { parseExcelFile, reparseWithColumn } from "../utils/excel-import";
import type { ExcelParseResult } from "../types";

export type WorkerRequest =
  | { type: "parse"; buffer: ArrayBuffer; sheetIndex: number }
  | {
      type: "reparse";
      buffer: ArrayBuffer;
      sheetIndex: number;
      columnIndex: number;
      commissionColumnIndex?: number | null;
    };

export type WorkerResponse =
  | { type: "result"; result: ExcelParseResult }
  | { type: "error"; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    let result: ExcelParseResult;

    if (event.data.type === "parse") {
      result = await parseExcelFile(event.data.buffer, event.data.sheetIndex);
    } else {
      result = await reparseWithColumn(
        event.data.buffer,
        event.data.sheetIndex,
        event.data.columnIndex,
        event.data.commissionColumnIndex,
      );
    }

    (self as unknown as Worker).postMessage({
      type: "result",
      result,
    } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      error: err instanceof Error ? err.message : "Error procesando archivo",
    } satisfies WorkerResponse);
  }
};
