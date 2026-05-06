import type { Client, InArgs, InStatement, ResultSet } from "@libsql/client";

type LibsqlExecutor = Pick<Client, "execute">;

const MAX_READ_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 100;
const MAX_JITTER_MS = 50;

const RETRYABLE_ERROR_SIGNALS = [
  "und_err_socket",
  "econnreset",
  "etimedout",
  "epipe",
  "fetch failed",
  "other side closed",
  "socketerror",
  "terminated",
];

const getErrorSignals = (error: unknown): string[] => {
  if (error === null || typeof error !== "object") {
    return [String(error)];
  }

  const current = error as Record<string, unknown>;
  const signals = [
    current.name,
    current.message,
    current.code,
    current.rawCode,
  ].map((signal) => String(signal).toLowerCase());

  if ("cause" in current) {
    signals.push(...getErrorSignals(current.cause));
  }

  return signals;
};

export const isRetryableLibsqlError = (error: unknown): boolean =>
  getErrorSignals(error).some((signal) =>
    RETRYABLE_ERROR_SIGNALS.some((retryable) => signal.includes(retryable)),
  );

const getStatementSql = (statement: InStatement): string =>
  typeof statement === "string" ? statement : statement.sql;

const assertReadStatement = (statement: InStatement) => {
  const sql = getStatementSql(statement).trim().toLowerCase();
  if (!sql.startsWith("select") && !sql.startsWith("with")) {
    throw new Error("executeReadWithRetry only accepts SELECT/WITH statements");
  }
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (attempt: number): number =>
  BASE_RETRY_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * MAX_JITTER_MS);

export async function executeReadWithRetry(
  client: LibsqlExecutor,
  statement: InStatement,
  args?: InArgs,
): Promise<ResultSet> {
  assertReadStatement(statement);

  for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
    try {
      if (args === undefined) {
        return await client.execute(statement);
      }

      if (typeof statement !== "string") {
        throw new Error("executeReadWithRetry args require a SQL string statement");
      }

      return await client.execute(statement, args);
    } catch (error) {
      if (
        attempt === MAX_READ_ATTEMPTS - 1 ||
        !isRetryableLibsqlError(error)
      ) {
        throw error;
      }

      await sleep(getRetryDelayMs(attempt));
    }
  }

  throw new Error("executeReadWithRetry exhausted retries unexpectedly");
}
