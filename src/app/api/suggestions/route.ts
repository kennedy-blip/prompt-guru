import { NextRequest } from "next/server";
import { resolveCredentials } from "@/lib/server/credentials";
import { createClient } from "@/lib/server/openai";
import { FOLLOW_UP_SYSTEM, STARTER_SYSTEM } from "@/lib/prompts";
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

function extractJsonArray(raw: string): { label: string; prompt: string }[] | null {
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
      .filter((v): v is { label: string; prompt: string } => Boolean(v))
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
    return Response.json({ items: [], error: "Invalid JSON" }, { status: 400 });
  }

  const mode: ModeId = body.mode ?? "research";
  const attachments = body.attachments ?? [];
  const fallback =
    body.kind === "starter" ? offlineStarters(mode, attachments) : offlineFollowUps(mode, attachments);

  const creds = resolveCredentials(req.headers);
  if (!creds.apiKey) {
    return Response.json({ items: fallback, source: "offline" });
  }

  const client = createClient(creds);
  const system = body.kind === "starter" ? STARTER_SYSTEM : FOLLOW_UP_SYSTEM;
  const userContent =
    body.kind === "starter"
      ? `Mode: ${mode}\nAttachments: ${attachments.length ? attachments.join(", ") : "none"}\nContext: ${
          body.context?.slice(0, 4000) || "fresh empty session — invite the user to start"
        }`
      : `Mode: ${mode}\nUser asked: ${body.question?.slice(0, 1500) ?? "unknown"}\nAssistant answered: ${
          body.answer?.slice(0, 6000) ?? ""
        }\nAttachments: ${attachments.join(", ") || "none"}`;

  try {
    const completion = await client.chat.completions.create({
      model: creds.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const items = extractJsonArray(raw);
    return Response.json({ items: items ?? fallback, source: items ? "model" : "offline" });
  } catch {
    return Response.json({ items: fallback, source: "offline" });
  }
}
