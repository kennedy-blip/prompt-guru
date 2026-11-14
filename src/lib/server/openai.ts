import OpenAI from "openai";
import type { ResolvedCredentials } from "./credentials";

/** Builds an OpenAI SDK client pointed at the TransJules compatible endpoint. */
export function createClient(creds: ResolvedCredentials): OpenAI {
  return new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: false,
    maxRetries: 0,
    timeout: 120_000,
    defaultHeaders: {
      "HTTP-Referer": "https://promptguru.app",
      "X-Title": "PromptGuru",
    },
  });
}

export type ProbeResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  model?: string;
  models?: string[];
  error?: string;
  source: ResolvedCredentials["source"];
  baseUrl: string;
};

/** Lightweight latency/health probe used by the Settings "Test Connection" button. */
export async function probeConnection(creds: ResolvedCredentials): Promise<ProbeResult> {
  const started = Date.now();
  const client = createClient(creds);

  // Model listing is the cheapest round-trip; fall back to a 1-token chat completion
  // for endpoints that don't expose /models.
  try {
    const list = await client.models.list();
    const models = (list.data ?? []).map((m) => m.id).filter(Boolean);
    return {
      ok: true,
      status: 200,
      latencyMs: Date.now() - started,
      model: creds.model,
      models,
      source: creds.source,
      baseUrl: creds.baseUrl,
    };
  } catch {
    // continue to chat probe
  }

  try {
    await client.chat.completions.create({
      model: creds.model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    });
    return {
      ok: true,
      status: 200,
      latencyMs: Date.now() - started,
      model: creds.model,
      source: creds.source,
      baseUrl: creds.baseUrl,
    };
  } catch (error) {
    return {
      ok: false,
      status: (error as { status?: number }).status ?? 500,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Connection failed",
      source: creds.source,
      baseUrl: creds.baseUrl,
    };
  }
}
