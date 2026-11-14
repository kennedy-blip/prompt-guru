/**
 * Mock OpenAI-compatible engine for exercising PromptGuru's error handling.
 *
 *   node scripts/mock-engine.mjs          # PORT=4010
 *   curl /v1/chat/completions            # behaviour switches via ?mode=
 *
 * Modes (env MOCK_MODE or ?mode= query):
 *   ok        stream a normal answer
 *   capacity  first 2 requests 503 "No inference capacity available; all workers…",
 *             then succeed (exercises retry + banner)
 *   interrupt stream a few tokens then destroy the socket (partial-answer path)
 *   html404   answer /images/generations with a Vercel-style HTML 404 page
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4010);
let calls = 0;

const sse = (res, payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

function streamAnswer(res, text) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const words = text.split(" ");
  let i = 0;
  const timer = setInterval(() => {
    if (i >= words.length) {
      sse(res, { choices: [{ delta: {}, finish_reason: "stop" }] });
      res.write("data: [DONE]\n\n");
      res.end();
      clearInterval(timer);
      return;
    }
    sse(res, { choices: [{ delta: { content: `${words[i]} ` } }] });
    i += 1;
  }, 30);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const mode = url.searchParams.get("mode") ?? process.env.MOCK_MODE ?? "ok";

  if (url.pathname.endsWith("/models")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [{ id: "tj-qwen-dev" }] }));
    return;
  }

  if (url.pathname.endsWith("/images/generations")) {
    if (mode === "html404") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(
        '<!DOCTYPE html><html lang="en"><head><title>404: This page could not be found.</title></head><body><div><h1>404</h1><h2>This page could not be found.</h2></div></body></html>',
      );
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ url: "https://example.com/mock.png" }] }));
    return;
  }

  if (url.pathname.endsWith("/chat/completions")) {
    calls += 1;
    if (mode === "capacity" && calls <= 2) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: "No inference capacity available; all workers and configured fallback providers failed",
            type: "server_error",
          },
        }),
      );
      return;
    }

    if (mode === "interrupt") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      ["Partial ", "answer ", "before "].forEach((word) =>
        sse(res, { choices: [{ delta: { content: word } }] }),
      );
      setTimeout(() => res.destroy(), 120); // simulate the worker dropping the socket
      return;
    }

    if (mode === "upstream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      sse(res, { choices: [{ delta: { content: "Starting…" } }] });
      setTimeout(() => {
        sse(res, { error: { message: "Upstream stream interrupted", type: "upstream_error" } });
        res.end();
      }, 100);
      return;
    }

    streamAnswer(res, "Mock engine online. The architecture uses a streaming gateway with credential resolution.");
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: "Not found" } }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock-engine] listening on http://0.0.0.0:${PORT}`);
});
