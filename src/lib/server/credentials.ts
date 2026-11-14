import "server-only";
import { normaliseBaseUrl } from "@/lib/utils";

export type CredentialSource = "user" | "server" | "none";

export type ResolvedCredentials = {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: CredentialSource;
  imageModel?: string;
};

export const DEFAULT_BASE_URL = "https://trans-jules-kmokaya864-5310.vercel.app/api/v1";
export const DEFAULT_MODEL = "tj-qwen-dev";

export class MissingCredentialsError extends Error {
  code = "missing_credentials" as const;
  constructor(message = "No TransJules API key available.") {
    super(message);
    this.name = "MissingCredentialsError";
  }
}

/**
 * Hybrid credential resolution.
 *
 * Priority:
 *   1. Per-request headers supplied by the browser key vault (`x-user-api-key` / `x-user-base-url`).
 *   2. Server-side environment variables (`OPENAI_API_KEY` / `OPENAI_BASE_URL`).
 *   3. Nothing → the caller must return HTTP 401 with a UI prompt to open Settings.
 */
export function resolveCredentials(headers: Headers): ResolvedCredentials {
  const headerKey = headers.get("x-user-api-key")?.trim() ?? "";
  const headerBase = headers.get("x-user-base-url")?.trim() ?? "";
  const headerModel = headers.get("x-user-model")?.trim() ?? "";

  const envKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const envBase = (process.env.OPENAI_BASE_URL ?? "").trim();
  const envModel = (process.env.OPENAI_MODEL ?? "").trim();

  const envKeyUsable = envKey && !/^your[-_]?/i.test(envKey);

  if (headerKey) {
    return {
      apiKey: headerKey,
      baseUrl: normaliseBaseUrl(headerBase || envBase || DEFAULT_BASE_URL),
      model: headerModel || envModel || DEFAULT_MODEL,
      source: "user",
      imageModel: (process.env.OPENAI_IMAGE_MODEL ?? "").trim() || undefined,
    };
  }

  if (envKeyUsable) {
    return {
      apiKey: envKey,
      baseUrl: normaliseBaseUrl(envBase || DEFAULT_BASE_URL),
      model: envModel || DEFAULT_MODEL,
      source: "server",
      imageModel: (process.env.OPENAI_IMAGE_MODEL ?? "").trim() || undefined,
    };
  }

  return {
    apiKey: "",
    baseUrl: normaliseBaseUrl(headerBase || envBase || DEFAULT_BASE_URL),
    model: headerModel || envModel || DEFAULT_MODEL,
    source: "none",
  };
}

export function requireCredentials(headers: Headers): ResolvedCredentials {
  const resolved = resolveCredentials(headers);
  if (!resolved.apiKey) throw new MissingCredentialsError();
  return resolved;
}

export function credentialsSummary(resolved: ResolvedCredentials) {
  return {
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    source: resolved.source,
    fallbackEnabled: process.env.JULES_LLM_FALLBACK === "true",
  };
}
