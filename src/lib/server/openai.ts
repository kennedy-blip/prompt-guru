import OpenAI from "openai";
import type { ResolvedCredentials } from "./credentials";
import { normaliseEngineError, type NormalisedError } from "./errors";

/** Builds an OpenAI SDK client pointed at the TransJules compatible endpoint. */
export function createClient(creds: ResolvedCredentials, timeout = 120_000): OpenAI {
  return new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: false,
    maxRetries: 0,
    timeout,
    defaultHeaders: {
      "HTTP-Referer": "https://promptguru.app",
      "X-Title": "PromptGuru",
    },
  });
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries transient engine failures (503 "no inference capacity", interrupted
 * streams, 429s) with exponential backoff + jitter. Non-retryable failures throw
 * the original error so callers can map it with `normaliseEngineError`.
 */
export async function withRetry<T>(
  run: (attempt: number) => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number; onRetry?: (info: { attempt: number; error: NormalisedError; waitMs: number }) => void } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 700;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      lastError = error;
      const normalised = normaliseEngineError(error);
      if (!normalised.retryable || attempt === attempts) throw error;
      const waitMs = Math.round(baseDelay * Math.pow(2, attempt - 1) * (0.75 + Math.random() * 0.5));
      options.onRetry?.({ attempt, error: normalised, waitMs });
      await sleep(waitMs);
    }
  }
  throw lastError;
}

export type ProbeResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  model?: string;
  models?: string[];
  error?: string;
  description?: string;
  errorClass?: NormalisedError["className"];
  /** Whether /images/generations exists on this deployment. */
  imageSupported?: boolean;
  source: ResolvedCredentials["source"];
  baseUrl: string;
};

export const DEFAULT_IMAGE_MODEL = "gpt-image-1";

/**
 * Settings → "Test Connection". Also probes whether the deployment actually
 * exposes an image route, so the Studio can tell the user up-front instead of
 * dumping a 404 HTML page into the UI.
 */
export async function probeConnection(creds: ResolvedCredentials): Promise<ProbeResult> {
  const started = Date.now();
  const client = createClient(creds, 20_000);
  let models: string[] | undefined;
  let modelOk = false;
  let lastError: unknown;

  try {
    const list = await client.models.list();
    models = (list.data ?? []).map((m) => m.id).filter(Boolean);
    modelOk = true;
  } catch (error) {
    lastError = error;
  }

  if (!modelOk) {
    // /models isn't always exposed — fall back to a 1-token chat probe.
    try {
      await client.chat.completions.create({
        model: creds.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      });
      modelOk = true;
    } catch (error) {
      lastError = error;
    }
  }

  if (!modelOk) {
    const normalised = normaliseEngineError(lastError);
    return {
      ok: false,
      status: normalised.status || 500,
      latencyMs: Date.now() - started,
      error: normalised.message,
      description: normalised.description,
      errorClass: normalised.className,
      source: creds.source,
      baseUrl: creds.baseUrl,
    };
  }

  const imageSupported = await detectImageSupport(creds);

  return {
    ok: true,
    status: 200,
    latencyMs: Date.now() - started,
    model: creds.model,
    models,
    imageSupported,
    source: creds.source,
    baseUrl: creds.baseUrl,
  };
}

/**
 * Cheap capability check for /images/generations.
 * A 404 (HTML or JSON) means "not deployed"; a 400/401/422 means the route
 * exists and simply rejected the probe payload.
 */
export async function detectImageSupport(creds: ResolvedCredentials): Promise<boolean> {
  try {
    const response = await fetch(`${creds.baseUrl.replace(/\/+$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({ model: creds.imageModel || DEFAULT_IMAGE_MODEL, prompt: "ping", n: 1, size: "1024x1024" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 404) return false;
    // Drain the body so the connection can be reused.
    await response.text().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Lists image models advertised by the deployment (best effort). */
export function pickImageModel(models: string[] | undefined): string {
  const candidates = ["gpt-image-1", "dall-e-3", "flux-schnell", "flux-dev", "sdxl", "stable-diffusion"];
  for (const candidate of candidates) {
    if (models?.some((model) => model.toLowerCase().includes(candidate))) return candidate;
  }
  return DEFAULT_IMAGE_MODEL;
}
