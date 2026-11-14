import { NextRequest } from "next/server";
import { resolveCredentials } from "@/lib/server/credentials";
import { createClient } from "@/lib/server/openai";
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
};

// Sizes accepted by OpenAI-compatible image endpoints (SDK-typed union).
const SIZE_MAP: Record<AspectRatio, "1024x1024" | "1536x1024" | "1024x1536" | "1792x1024" | "1024x1792"> = {
  "1:1": "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "4:3": "1536x1024",
  "3:2": "1792x1024",
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return Response.json({ error: "A prompt is required" }, { status: 400 });

  const aspect: AspectRatio = body.aspect ?? "1:1";
  const creds = resolveCredentials(req.headers);

  // No key → deterministic SVG synthesis fallback so the studio still works.
  if (!creds.apiKey) {
    const svg = synthesizeImage(prompt, aspect);
    return Response.json({
      id: uid("img"),
      url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      prompt,
      aspect,
      source: "synthesis",
      model: "promptguru/svg-synth",
    });
  }

  const client = createClient(creds);
  const imageModel = creds.imageModel || "gpt-image-1";
  let finalPrompt = prompt;

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
    } catch {
      // Enhancement is best-effort; keep the original prompt.
    }
  }

  try {
    const result = await client.images.generate({
      model: imageModel,
      prompt: finalPrompt,
      size: SIZE_MAP[aspect],
      n: 1,
    });
    const first = result.data?.[0];
    const url = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);
    if (!url) throw new Error("The image model returned no image.");
    return Response.json({
      id: uid("img"),
      url,
      prompt,
      enhancedPrompt: finalPrompt !== prompt ? finalPrompt : undefined,
      aspect,
      source: "model",
      model: imageModel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    // Graceful degradation: engine has no image endpoint → SVG synthesis.
    const svg = synthesizeImage(prompt, aspect);
    return Response.json({
      id: uid("img"),
      url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      prompt,
      enhancedPrompt: finalPrompt !== prompt ? finalPrompt : undefined,
      aspect,
      source: "synthesis",
      model: "promptguru/svg-synth",
      warning: `${message} — rendered locally instead.`,
    });
  }
}
