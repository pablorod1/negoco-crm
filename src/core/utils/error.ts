const stringValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return null;
};

export const getErrorMessage = (
  error: unknown,
  fallback = "Error desconocido",
): string => {
  const primitiveMessage = stringValue(error);
  if (primitiveMessage !== null) return primitiveMessage || fallback;

  if (error instanceof Error) return error.message || fallback;

  if (Array.isArray(error)) {
    const messages = error
      .map((item) => getErrorMessage(item, ""))
      .filter(Boolean);

    return messages.length > 0 ? messages.join(", ") : fallback;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      stringValue(record.message) ||
      stringValue(record.error) ||
      stringValue(record.name);
    const code = stringValue(record.code);

    if (message && code) return `${message} (${code})`;
    if (message) return message;
    if (code) return code;

    try {
      const serialized = JSON.stringify(error);
      return serialized && serialized !== "{}" ? serialized : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
};
