export interface QuickNoteForExcel {
  message: string;
  created_at: string;
  author: string | null;
}

/** Keep the exported line format stable so imports can recognize old notes. */
export function formatQuickNoteForExcel(note: QuickNoteForExcel): string {
  const date = new Date(note.created_at);
  const formattedDate = Number.isNaN(date.getTime())
    ? ""
    : `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
  const author = note.author?.trim();
  const message = note.message.replace(/\s*\n+\s*/g, " ").trim();
  const prefix = [formattedDate, author].filter(Boolean).join(" — ");
  return prefix ? `${prefix}: ${message}` : message;
}

export function parseLegacyNotesForExcel(
  value: unknown,
  isInternal = false,
): string[] {
  if (typeof value !== "string" || !value.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }

  const notes = Array.isArray(parsed) ? parsed : [parsed];
  return notes
    .filter((note): note is string => typeof note === "string")
    .map((note) => note.replace(/\s*\n+\s*/g, " ").trim())
    .filter(Boolean)
    .map((note) => (isInternal ? `[Interna] ${note}` : note));
}

/** One new line in the spreadsheet becomes one quick note. */
export function getNewExcelNotes(
  cells: string[],
  existingExportLines: string[],
  existingMessages: string[],
): string[] {
  const existing = new Set(
    [...existingExportLines, ...existingMessages].map((line) => line.trim()),
  );
  const added = new Set<string>();

  for (const cell of cells) {
    for (const line of cell.split(/\r?\n/)) {
      const note = line.trim();
      if (note && note !== "---" && !existing.has(note)) added.add(note);
    }
  }

  return [...added];
}
