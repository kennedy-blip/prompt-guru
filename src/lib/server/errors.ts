/**
 * Engine error normalisation.
 *
 * TransJules is an OpenAI-compatible engine but not every OpenAI route exists on
 * every deployment (image generation in particular). When a route is missing,
 * Vercel returns a full HTML 404 page, which the SDK surfaces as a giant
 * `message` string — never let that reach the UI.
 */

export type ErrorClass =
  | "auth"
  | "capacity"
  | "upstream_interrupt"
  | "timeout"
  | "network"
  | "rate_limit"
  | "no_image_model"
  | "endpoint_missing"
  | "bad_request"
  | "quota"
  | "unknown";

export type NormalisedError = {
  className: ErrorClass;
  /** Short, user-safe sentence (always < 220 chars, never raw HTML). */
  message: string;
  description: string;
  status: number;
  retryable: boolean;
  /** Raw engine text, truncated, for the collapsible technical detail. */
  detail?: string;
};

const MAX_DETAIL = 400;

export function looksLikeHtml(text: string): boolean {
  return /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(text);
}

/** Strips markup/tags and collapses whitespace. */
export function sanitizeText(raw?: string, limit = 220): string {
  if (!raw) return "";
  const withoutTags = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
  const collapsed = withoutTags.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit - 1).trimEnd()}…`;
}

type EngineErrorish = {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
  cause?: unknown;
  error?: unknown;
  response?: { status?: number };
};

function readStatus(error: EngineErrorish): number {
  return error.status ?? error.response?.status ?? 0;
}

/** Extracts the most useful human string from an SDK error without HTML. */
function readRawMessage(error: EngineErrorish): string {
  const candidates: string[] = [];
  if (typeof error.message === "string") candidates.push(error.message);
  const nested = error.error as { message?: unknown } | undefined;
  if (nested && typeof nested.message === "string") candidates.push(nested.message);
  const usable = candidates.find((value) => value && !looksLikeHtml(value));
  return usable ?? candidates[0] ?? "";
}

export function normaliseEngineError(input: unknown): NormalisedError {
  const error = (input ?? {}) as EngineErrorish;
  const status = readStatus(error);
  const raw = readRawMessage(error);
  const detail = raw ? sanitizeText(raw, MAX_DETAIL) : undefined;
  const lower = raw.toLowerCase();

  if (looksLikeHtml(raw)) {
    return {
      className: status === 404 ? "endpoint_missing" : "unknown",
      message:
        status === 404
          ? "That route does not exist on this deployment (404). The engine answered with an HTML page instead of JSON."
          : "The engine returned a web page instead of JSON — the endpoint path is probably wrong.",
      description:
        "Check the Base URL in Settings → Connection Vault. It must end with /v1 and point at an OpenAI-compatible API, not at a dashboard.",
      status,
      retryable: false,
      detail,
    };
  }

  if (status === 401 || status === 403 || /invalid.*api.?key|unauthori[sz]ed|forbidden/.test(lower)) {
    return {
      className: "auth",
      message: "The engine rejected the API key.",
      description: "Open Settings → Connection Vault and paste a valid TransJules key, then press Test Connection.",
      status: status || 401,
      retryable: false,
      detail,
    };
  }

  if (status === 404 || /not found|does not exist|unknown url|no route/.test(lower)) {
    return {
      className: "endpoint_missing",
      message: "This endpoint is not available on the TransJules deployment (404).",
      description:
        "The model exists but has no route for this feature. PromptGuru falls back to a local render where it can.",
      status: 404,
      retryable: false,
      detail,
    };
  }

  if (/no inference capacity|all workers|no available (worker|backend)|capacity available/.test(lower) || status === 503) {
    return {
      className: "capacity",
      message: "The engine has no inference capacity right now.",
      description:
        "Every worker (and the configured fallback providers) refused the request. This is usually brief — retry in a few seconds or switch model in Settings.",
      status: status || 503,
      retryable: true,
      detail,
    };
  }

  if (/upstream stream interrupted|stream interrupted|upstream.*(closed|terminated|interrupted|aborted)|premature close|socket hang up/.test(lower)) {
    return {
      className: "upstream_interrupt",
      message: "The engine's stream was interrupted mid-answer.",
      description:
        "The worker dropped the connection while generating. Anything already written is kept — regenerate to continue.",
      status: status || 502,
      retryable: true,
      detail,
    };
  }

  if (status === 429 || /rate.?limit|too many requests/.test(lower)) {
    return {
      className: "rate_limit",
      message: "Rate limited by the inference engine.",
      description: "Wait a moment, then retry. Lowering max tokens or switching model also helps.",
      status: 429,
      retryable: true,
      detail,
    };
  }

  if (status === 402 || /quota|billing|insufficient (funds|credit)/.test(lower)) {
    return {
      className: "quota",
      message: "The account behind this key is out of quota.",
      description: "Top up the TransJules account, or switch to a key with remaining credit.",
      status: status || 402,
      retryable: false,
      detail,
    };
  }

  if (/timeout|timed out|ETIMEDOUT|aborted due to timeout/.test(lower) || status === 504) {
    return {
      className: "timeout",
      message: "The engine took too long to respond.",
      description: "Reduce the context size or ask for a shorter answer, then retry.",
      status: status || 504,
      retryable: true,
      detail,
    };
  }

  const causeText =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === "string"
        ? error.cause
        : "";
  const isConnectionError =
    error.name === "APIConnectionError" ||
    /connection error|fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|network|getaddrinfo|socket hang up|self.signed|certificate|unable to (connect|resolve)/.test(
      `${lower} ${causeText.toLowerCase()}`,
    );

  if (isConnectionError) {
    return {
      className: "network",
      message: "PromptGuru could not reach the inference engine.",
      description: "Check the Base URL in Settings and that the engine is online.",
      status: status || 0,
      retryable: true,
      detail,
    };
  }

  if (status === 400 || status === 422) {
    return {
      className: "bad_request",
      message: sanitizeText(raw, 180) || "The engine rejected the request payload.",
      description: "This is usually a model id mismatch or an unsupported message shape.",
      status,
      retryable: false,
      detail,
    };
  }

  return {
    className: "unknown",
    message: sanitizeText(raw, 180) || "The inference engine returned an unexpected error.",
    description: "Retry once; if it persists, check the model id in Settings.",
    status,
    retryable: status >= 500 || status === 0,
    detail,
  };
}

export function shouldRetry(error: NormalisedError, attempt: number, maxAttempts: number): boolean {
  return error.retryable && attempt < maxAttempts;
}
