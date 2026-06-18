import { ImaginaEnergiaConfig } from "./config";

export interface ImaginaAuthToken {
  token: string;
  expiresIn?: number;
}

type FetchLike = typeof fetch;

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const getImaginaToken = async (
  config: ImaginaEnergiaConfig,
  fetchImpl: FetchLike = fetch,
): Promise<ImaginaAuthToken> => {
  const response = await fetchImpl(`${config.authBaseUrl}/initiateauthcommand`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(`Imagina auth failed with status ${response.status}`);
  }

  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { token?: unknown }).token !== "string"
  ) {
    throw new Error("Imagina auth response did not include a token");
  }

  return {
    token: (data as { token: string }).token,
    expiresIn:
      typeof (data as { expires_in?: unknown }).expires_in === "number"
        ? (data as { expires_in: number }).expires_in
        : undefined,
  };
};
