import { NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { credentialsSummary, resolveCredentials } from "@/lib/server/credentials";
import { createClient } from "@/lib/server/openai";
import { offlineReply } from "@/lib/server/offline";
import { SSE_HEADERS, sse } from "@/lib/server/stream";
import { systemPromptForMode } from "@/lib/prompts";
import type { ModeId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
};

type ChatBody = {
  messages: IncomingMessage[];
  mode?: ModeId;
  systemExtra?: string;
  attachments?: string[];
  temperature?: number;
  maxTokens?: number;
  demo?: boolean;
};

const FALLBACK_ENABLED = () => process.env.JULES_LLM_FALLBACK === "true";

function toOpenAIMessages(messages: IncomingMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "user" && message.images?.length) {
      return {
        role: "user",
        content: [
          ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
          ...message.images.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "auto" as const },
          })),
        ],
      };
    }
    return { role: message.role, content: message.content } as ChatCompletionMessageParam;
  });
}

function lastUserText(messages: IncomingMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content ?? "";
  }
  return "";
}

function streamText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse({ type: "meta", simulated: true }));
      const chunks = text.match(/[\s\S]{1,18}/g) ?? [];
      for (const chunk of chunks) {
        controller.enqueue(sse({ type: "delta", text: chunk }));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.enqueue(sse({ type: "done", message: "offline-preview" }));
      controller.close();
    },
  });
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON body", code: "bad_request" }, { status: 400 });
  }

  const mode: ModeId = body.mode ?? "research";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const attachments = body.attachments ?? [];

  if (!messages.length) {
    return Response.json({ error: "No messages supplied", code: "bad_request" }, { status: 400 });
  }

  // Explicit offline demo request from the client (Preview mode toggle).
  if (body.demo) {
    const text = offlineReply(mode, lastUserText(messages), attachments);
    return new Response(streamText(text), { headers: SSE_HEADERS });
  }

  const creds = resolveCredentials(req.headers);

  if (!creds.apiKey) {
    // No key anywhere → instruct the UI to open the Settings vault (HTTP 401).
    if (!FALLBACK_ENABLED()) {
      return Response.json(
        {
          error:
            "No TransJules API key found. Open Settings → Connection Vault and add your key, or deploy with OPENAI_API_KEY set.",
          code: "missing_credentials",
        },
        { status: 401 },
      );
    }
    const text = offlineReply(mode, lastUserText(messages), attachments);
    return new Response(streamText(text), { headers: SSE_HEADERS });
  }

  const client = createClient(creds);
  const payloadMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPromptForMode(mode, body.systemExtra) },
    ...toOpenAIMessages(messages),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof sse>[0]) => controller.enqueue(sse(event));
      send({ type: "meta", model: creds.model, simulated: false });

      try {
        const completion = await client.chat.completions.create({
          model: creds.model,
          messages: payloadMessages,
          temperature: body.temperature ?? 0.6,
          max_tokens: body.maxTokens ?? 4096,
          stream: true,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) send({ type: "delta", text: delta });
        }
        send({ type: "done", model: creds.model });
        controller.close();
        return;
      } catch (error) {
        const err = error as { message?: string; status?: number; code?: string };
        const allowFallback = FALLBACK_ENABLED();
        if (allowFallback) {
          send({
            type: "error",
            message: `TransJules request failed (${err.message ?? "unknown"}). Showing offline preview.`,
            code: "fallback",
          });
          const text = offlineReply(mode, lastUserText(messages), attachments);
          for (const chunk of text.match(/[\s\S]{1,18}/g) ?? []) {
            send({ type: "delta", text: chunk });
            await new Promise((r) => setTimeout(r, 12));
          }
          send({ type: "done", message: "offline-preview" });
          controller.close();
          return;
        }
        send({
          type: "error",
          message:
            err.status === 401 || err.status === 403
              ? `The engine rejected the API key (${err.status}). Check it in Settings → Connection Vault.`
              : err.message || "The inference engine could not be reached.",
          code: err.code ?? String(err.status ?? "engine_error"),
        });
        controller.close();
      }
    },
    cancel() {
      // Client aborted — stream teardown handled by the runtime.
    },
  });

  return new Response(stream, {
    headers: {
      ...SSE_HEADERS,
      "X-Credential-Source": credentialsSummary(creds).source,
      "X-Model": creds.model,
    },
  });
}

export async function GET(req: NextRequest) {
  const creds = resolveCredentials(req.headers);
  return Response.json({
    endpoint: "chat",
    ...credentialsSummary(creds),
    hasKey: Boolean(creds.apiKey),
    fallbackEnabled: FALLBACK_ENABLED(),
    encoding: "sse",
  });
}
