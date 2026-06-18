import { getImaginaToken } from "./auth";
import {
  ImaginaEnergiaConfig,
  readImaginaEnergiaConfig,
} from "./config";

type FetchLike = typeof fetch;

export type ImaginaHttpMethod = "GET" | "POST";

export interface ImaginaRequestOptions {
  method: ImaginaHttpMethod;
  path: string;
  channelId?: string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  json?: unknown;
  formData?: FormData;
  auth?: boolean;
  requireChannel?: boolean;
  useAuthBaseUrl?: boolean;
  timeoutMs?: number;
}

export interface ImaginaResponse<T> {
  data: T;
  requestId?: string | number;
  headers: Headers;
  status: number;
}

export class MissingImaginaChannelError extends Error {
  constructor() {
    super("Imagina Energia request blocked because tenant X-Canal is missing");
    this.name = "MissingImaginaChannelError";
  }
}

export class ImaginaHttpError extends Error {
  status: number;
  requestId?: string | number;
  data: unknown;

  constructor(status: number, data: unknown, requestId?: string | number) {
    super(`Imagina Energia request failed with status ${status}`);
    this.name = "ImaginaHttpError";
    this.status = status;
    this.data = data;
    this.requestId = requestId;
  }
}

const appendQuery = (
  url: URL,
  query?: ImaginaRequestOptions["query"],
): void => {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const getRequestId = (data: unknown): string | number | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const requestId = (data as { request_id?: unknown }).request_id;
  return typeof requestId === "string" || typeof requestId === "number"
    ? requestId
    : undefined;
};

export class ImaginaEnergiaClient {
  private readonly config: ImaginaEnergiaConfig;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: ImaginaEnergiaConfig = readImaginaEnergiaConfig(),
    fetchImpl: FetchLike = fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async request<T>(options: ImaginaRequestOptions): Promise<ImaginaResponse<T>> {
    const auth = options.auth ?? true;
    const requireChannel = options.requireChannel ?? true;
    const channelId = options.channelId?.trim();

    if (requireChannel && !channelId) {
      throw new MissingImaginaChannelError();
    }

    const baseUrl = options.useAuthBaseUrl
      ? this.config.authBaseUrl
      : this.config.apiBaseUrl;
    const normalizedPath = options.path.startsWith("/")
      ? options.path
      : `/${options.path}`;
    const url = new URL(`${baseUrl}${normalizedPath}`);
    appendQuery(url, options.query);

    const headers = new Headers();
    if (channelId) headers.set("X-Canal", channelId);
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (auth) {
      const { token } = await getImaginaToken(this.config, this.fetchImpl);
      headers.set("Authorization", `Bearer ${token}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.config.requestTimeoutMs,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: options.method,
        headers,
        body:
          options.json !== undefined
            ? JSON.stringify(options.json)
            : options.formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await parseResponseBody(response);
    const requestId = getRequestId(data);

    if (!response.ok) {
      throw new ImaginaHttpError(response.status, data, requestId);
    }

    return {
      data: data as T,
      requestId,
      headers: response.headers,
      status: response.status,
    };
  }
}

export const createImaginaEnergiaClient = (
  config?: ImaginaEnergiaConfig,
  fetchImpl?: FetchLike,
): ImaginaEnergiaClient => new ImaginaEnergiaClient(config, fetchImpl);
