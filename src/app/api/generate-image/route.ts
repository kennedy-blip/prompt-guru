import { NextRequest } from "next/server";
import { resolveCredentials } from "@/lib/server/credentials";
import { createClient, DEFAULT_IMAGE_MODEL, detectImageSupport, withRetry } from "@/lib/server/openai";
import { normaliseEngineError } from "@/lib/server/errors";
import { synthesizeImage } from "@/lib/server/svg-synth";
import { uid } from "@/lib/utils";
import type { AspectRatio } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Body = {
  prompt: string;
  aspect?: AspectRatio;
  enhance?: boolean;
  style?: string;
  /** Skip the network image model entirely and render locally. */
  local?: boolean;
};

// Sizes accepted by OpenAI-compatible image endpoints (SDK-typed union).
const SIZE_MAP: Record<AspectRatio, "1024x1024" | "1536x1024" | "1024x1536" | "1792x1024" | "1024x1792"> = {
  "1:1": "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "4:3": "1536x1024",
  "3:2": "1792x1024",
};

function localRender(prompt: string, aspect: AspectRatio, extra: Record<string, unknown> = {}) {
  const svg = synthesizeImage(prompt, aspect);
  return {
    id: uid("img"),
    url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    prompt,
    aspect,
    source: "synthesis" as const,
    model: "promptguru/svg-synth",
    ...extra,
  };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body", code: "bad_request" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return Response.json({ error: "A prompt is required", code: "bad_request" }, { status: 400 });
  }

  const aspect: AspectRatio = body.aspect ?? "1:1";
  const creds = resolveCredentials(req.headers);

  // No key, or the user explicitly asked for a local render.
  if (!creds.apiKey || body.local) {
    return Response.json(localRender(prompt, aspect));
  }

  // 1. Does this deployment even expose /images/generations?
  const imageSupported = await detectImageSupport(creds);
  if (!imageSupported) {
    return Response.json(
      localRender(prompt, aspect, {
        notice:
          "This TransJules deployment doesn't expose an image route (404 on /images/generations), so PromptGuru rendered it locally.",
      }),
    );
  }

  const client = createClient(creds, 90_000);
  const imageModel = creds.imageModel || DEFAULT_IMAGE_MODEL;

  // 2. Best-effort prompt enhancement through the chat model.
  let finalPrompt = prompt;
  let enhancementNote: string | undefined;
  if (body.enhance) {
    try {
      const enhanced = await client.chat.completions.create({
        model: creds.model,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the user's image prompt into a rich, vivid generation prompt. Return ONLY the rewritten prompt, max 90 words, no quotes, no preamble.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 220,
      });
      const text = enhanced.choices?.[0]?.message?.content?.trim();
      if (text) finalPrompt = text;
    } catch (error) {
      enhancementNote = `Prompt enhancement skipped: ${normaliseEngineError(error).message}`;
    }
  }

  // 3. Generate, retrying transient capacity failures.
  try {
    const result = await withRetry(
      () =>
        client.images.generate({
          model: imageModel,
          prompt: finalPrompt,
          size: SIZE_MAP[aspect],
          n: 1,
        }),
      { attempts: 3, baseDelayMs: 900 },
    );
    const first = result.data?.[0];
    const url = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);
    if (!url) throw new Error("The image model returned an empty response.");
    return Response.json({
      id: uid("img"),
      url,
      prompt,
      enhancedPrompt: finalPrompt !== prompt ? finalPrompt : undefined,
      aspect,
      source: "model",
      model: imageModel,
      notice: enhancementNote,
    });
  } catch (error) {
    const normalised = normaliseEngineError(error);
    // Clean, human message — never the raw HTML page or a bare stack.
    return Response.json(
      localRender(prompt, aspect, {
        enhancedPrompt: finalPrompt !== prompt ? finalPrompt : undefined,
        notice: `${normalised.message} ${normalised.description}`.trim(),
        errorClass: normalised.className,
        status: normalised.status,
      }),
    );
  }
}

export async function GET(req: NextRequest) {
  const creds = resolveCredentials(req.headers);
  if (!creds.apiKey) {
    return Response.json({ hasKey: false, imageSupported: false, model: DEFAULT_IMAGE_MODEL });
  }
  const imageSupported = await detectImageSupport(creds);
  return Response.json({
    hasKey: true,
    imageSupported,
    model: creds.imageModel || DEFAULT_IMAGE_MODEL,
    baseUrl: creds.baseUrl,
  });
}
