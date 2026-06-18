export const IMAGINA_PROVIDER = "imagina_energia" as const;
export const IMAGINA_SUPPLIER_NAME = "Imagina Energía" as const;

export type ImaginaRuntimeEnvironment = "pre" | "production";

export interface ImaginaEnergiaConfig {
  environment: ImaginaRuntimeEnvironment;
  authBaseUrl: string;
  apiBaseUrl: string;
  email: string;
  password: string;
  callbackSeedKey: string;
  webhookPublicRootDomain: string;
  requestTimeoutMs: number;
}

type Env = Record<string, string | undefined>;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const requiredEnv = (env: Env, name: string): string => {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const resolveImaginaRuntimeEnvironment = (
  env: Env = process.env,
): ImaginaRuntimeEnvironment => {
  if (env.VERCEL_ENV) {
    return env.VERCEL_ENV === "production" ? "production" : "pre";
  }

  return env.NODE_ENV === "production" ? "production" : "pre";
};

const resolveBaseUrls = (
  env: Env,
  runtimeEnvironment: ImaginaRuntimeEnvironment,
): { authBaseUrl: string; apiBaseUrl: string } => {
  const suffix = runtimeEnvironment === "production" ? "PROD" : "PRE";

  return {
    authBaseUrl: trimTrailingSlash(
      requiredEnv(env, `IMAGINA_AUTH_BASE_URL_${suffix}`),
    ),
    apiBaseUrl: trimTrailingSlash(
      requiredEnv(env, `IMAGINA_API_BASE_URL_${suffix}`),
    ),
  };
};

export const readImaginaEnergiaConfig = (
  env: Env = process.env,
): ImaginaEnergiaConfig => {
  const environment = resolveImaginaRuntimeEnvironment(env);
  const baseUrls = resolveBaseUrls(env, environment);

  return {
    environment,
    ...baseUrls,
    email: requiredEnv(env, "IMAGINA_EMAIL"),
    password: requiredEnv(env, "IMAGINA_PASSWORD"),
    callbackSeedKey: requiredEnv(env, "IMAGINA_CALLBACK_SEED_KEY"),
    webhookPublicRootDomain: requiredEnv(
      env,
      "IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN",
    )
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, ""),
    requestTimeoutMs: Number(env.IMAGINA_REQUEST_TIMEOUT_MS || 30_000),
  };
};

export const normalizeTenant = (tenant: string): string =>
  tenant.trim().toLowerCase();

export const tenantFromHost = (host: string | null): string | null => {
  if (!host) return null;
  const cleanHost = host.split(":")[0].toLowerCase();
  if (cleanHost === "localhost" || cleanHost === "127.0.0.1") return "test";
  const [subdomain] = cleanHost.split(".");
  if (!subdomain || subdomain === "api") return null;
  return normalizeTenant(subdomain);
};

export const buildTenantWebhookUrl = (
  tenant: string,
  rootDomain: string,
  path: string,
): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedRoot = rootDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  return `https://${normalizeTenant(tenant)}.${normalizedRoot}${normalizedPath}`;
};

export const getPublicRequestUrl = (request: Request): string => {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "") ||
    "https";

  return `${protocol}://${host}${url.pathname}${url.search}`;
};
