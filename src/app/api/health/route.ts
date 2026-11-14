import { credentialsSummary, resolveCredentials } from "@/lib/server/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const creds = resolveCredentials(new Headers(req.headers));
  return Response.json({
    ok: true,
    app: "PromptGuru",
    version: "1.0.0",
    ...credentialsSummary(creds),
    hasKey: Boolean(creds.apiKey),
    features: {
      chat: true,
      vision: true,
      imageGeneration: true,
      suggestions: true,
      mermaid: true,
      zipExport: true,
    },
  });
}
