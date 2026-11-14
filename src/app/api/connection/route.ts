import { NextRequest } from "next/server";
import { credentialsSummary, resolveCredentials } from "@/lib/server/credentials";
import { probeConnection } from "@/lib/server/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Settings → "Test Connection". Returns live latency + resolved model/source. */
export async function GET(req: NextRequest) {
  const creds = resolveCredentials(req.headers);
  const summary = credentialsSummary(creds);

  if (!creds.apiKey) {
    return Response.json(
      {
        ok: false,
        status: 401,
        code: "missing_credentials",
        error: "No API key configured. Add one in Settings → Connection Vault.",
        ...summary,
      },
      { status: 401 },
    );
  }

  const result = await probeConnection(creds);
  return Response.json(
    { ...result, ...summary },
    { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
  );
}
