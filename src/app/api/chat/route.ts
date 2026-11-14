import { NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { credentialsSummary, resolveCredentials } from "@/lib/server/credentials";
import { createClient } from "@/lib/server/openai";
import { normaliseEngineError } from "@/lib/server/errors";
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
const MAX_ATTEMPTS = 3;

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
    return new Response(streamText(offlineReply(mode, lastUserText(messages), attachments)), {
      headers: SSE_HEADERS,
    });
  }

  const creds = resolveCredentials(req.headers);

  if (!creds.apiKey) {
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
    return new Response(streamText(offlineReply(mode, lastUserText(messages), attachments)), {
      headers: SSE_HEADERS,
    });
  }

  const client = createClient(creds);
  const payloadMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPromptForMode(mode, body.systemExtra) },
    ...toOpenAIMessages(messages),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: Parameters<typeof sse>[0]) => {
        if (closed) return;
        try {
          controller.enqueue(sse(event));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the runtime */
        }
      };

      send({ type: "meta", model: creds.model, simulated: false });

      let accumulated = "";
      let emitted = false;

      try {
        // Retry transient failures (503 capacity, 429) *before* any token is
        // emitted. Once the first token is on the wire we must never replay the
        // request — that would duplicate the partial answer in the transcript.
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
              if (delta) {
                if (!emitted) emitted = true;
                accumulated += delta;
                send({ type: "delta", text: delta });
              }
            }
            break; // stream completed cleanly
          } catch (attemptError) {
            const normalised = normaliseEngineError(attemptError);
            const canRetry = normalised.retryable && attempt < MAX_ATTEMPTS && !emitted;
            if (!canRetry) throw attemptError;
            const waitMs = Math.round(800 * Math.pow(2, attempt - 1) * (0.75 + Math.random() * 0.5));
            send({
              type: "retry",
              attempt: attempt + 1,
              waitMs,
              reason: normalised.message,
            });
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }

        send({ type: "done", model: creds.model });
        finish();
        return;
      } catch (error) {
        const normalised = normaliseEngineError(error);

        // Partial answer survives an interrupted stream — never discard it.
        if (accumulated.trim().length > 0) {
          send({
            type: "error",
            message: normalised.message,
            description: `${normalised.description}`,
            code: "upstream_interrupt",
            errorClass: "upstream_interrupt",
            retryable: true,
          });
          send({ type: "done", model: creds.model, interrupted: true, message: "partial" });
          finish();
          return;
        }

        if (FALLBACK_ENABLED()) {
          send({
            type: "error",
            message: `${normalised.message} Showing offline preview instead.`,
            code: "fallback",
            errorClass: normalised.className,
          });
          for (const chunk of offlineReply(mode, lastUserText(messages), attachments).match(/[\s\S]{1,18}/g) ?? []) {
            send({ type: "delta", text: chunk });
            await new Promise((r) => setTimeout(r, 12));
          }
          send({ type: "done", message: "offline-preview" });
          finish();
          return;
        }

        send({
          type: "error",
          message: normalised.message,
          description: normalised.description,
          code: normalised.className === "auth" ? "missing_credentials" : normalised.className,
          errorClass: normalised.className,
          retryable: normalised.retryable,
          detail: normalised.detail,
        });
        send({ type: "done", message: "error" });
        finish();
      }
    },
    cancel() {
      // Client aborted (stop button) — nothing to clean up beyond the runtime.
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
