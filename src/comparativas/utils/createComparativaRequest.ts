export interface ComparisonCreateResult {
  success: boolean;
  error?: string;
}

interface RequestOptions {
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
}

const MAX_ATTEMPTS = 3;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function parseResult(response: Response): Promise<ComparisonCreateResult> {
  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("success" in body) ||
    typeof body.success !== "boolean"
  ) {
    throw new Error("Invalid comparison creation response");
  }

  const error =
    "error" in body && typeof body.error === "string"
      ? body.error
      : undefined;
  return { success: body.success, ...(error ? { error } : {}) };
}

/** Repeats only safe transient failures; the server uses the comparison ID as
 * the idempotency key, so every attempt carries the same FormData instance. */
export async function createComparativaRequest(
  formData: FormData,
  options: RequestOptions = {},
): Promise<ComparisonCreateResult> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? delay;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher("/api/v2/comparisons", {
        method: "POST",
        body: formData,
      });
      const result = await parseResult(response);

      if (!isTransientStatus(response.status) || attempt === MAX_ATTEMPTS - 1) {
        return result;
      }
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) {
        throw error;
      }
    }

    await wait(300 * 2 ** attempt);
  }

  throw new Error("Comparison creation retry loop ended unexpectedly");
}
