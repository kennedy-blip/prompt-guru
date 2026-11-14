import { NextRequest } from "next/server";
import { resolveCredentials } from "@/lib/server/credentials";
import { createClient, withRetry } from "@/lib/server/openai";
import { FOLLOW_UP_SYSTEM, STARTER_SYSTEM } from "@/lib/prompts";
import { normaliseEngineError } from "@/lib/server/errors";
import { offlineFollowUps, offlineStarters } from "@/lib/server/offline";
import type { ModeId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  kind: "starter" | "followup";
  mode?: ModeId;
  context?: string;
  attachments?: string[];
  answer?: string;
  question?: string;
};

type Item = { label: string; prompt: string };

function extractJsonArray(raw: string): Item[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed
      .map((item) => {
        const obj = item as Record<string, unknown>;
        const label = typeof obj.label === "string" ? obj.label.trim() : "";
        const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
        return label && prompt ? { label: label.slice(0, 60), prompt: prompt.slice(0, 320) } : null;
      })
      .filter((value): value is Item => Boolean(value))
      .slice(0, 3);
    return items.length ? items : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ items: [], source: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const mode: ModeId = body.mode ?? "research";
  const attachments = body.attachments ?? [];
  const kind = body.kind === "starter" ? "starter" : "followup";

  // Deterministic fallback so the UI *always* has chips, even if the engine is
  // down, the key is missing, or the model returns prose instead of JSON.
  const fallback = kind === "starter" ? offlineStarters(mode, attachments) : offlineFollowUps(mode, attachments);
  const buildLocal = (reason: string, detail?: string) =>
    Response.json({ items: fallback, source: "offline", notice: reason, detail });

  const creds = resolveCredentials(req.headers);
  if (!creds.apiKey) {
    return buildLocal("Generated locally — add an API key for model-written follow-ups.");
  }

  const client = createClient(creds, 25_000);
  const system = kind === "starter" ? STARTER_SYSTEM : FOLLOW_UP_SYSTEM;
  const userContent =
    kind === "starter"
      ? `Mode: ${mode}\nAttachments: ${attachments.length ? attachments.join(", ") : "none"}\nContext: ${
          body.context?.slice(0, 4000) || "fresh empty session — invite the user to start"
        }`
      : `Mode: ${mode}\nUser asked: ${body.question?.slice(0, 1500) ?? "unknown"}\nAssistant answered: ${
          body.answer?.slice(0, 6000) ?? ""
        }\nAttachments: ${attachments.join(", ") || "none"}`;

  try {
    const completion = await withRetry(
      () =>
        client.chat.completions.create({
          model: creds.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
      { attempts: 2, baseDelayMs: 500 },
    );
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const items = extractJsonArray(raw);
    if (!items) {
      return buildLocal("The model didn't return usable JSON, so these are local suggestions.");
    }
    return Response.json({ items, source: "model" });
  } catch (error) {
    const normalised = normaliseEngineError(error);
    return buildLocal(normalised.message, normalised.description);
  }
}
