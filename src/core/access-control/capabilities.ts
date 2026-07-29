export function hasAiStudiesCapability(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return false;
  }

  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue > 0;
}
