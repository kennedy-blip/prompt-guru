import type { ModeId } from "@/lib/types";

/**
 * Offline preview engine.
 *
 * When no credentials are configured (or the engine is unreachable and
 * JULES_LLM_FALLBACK=true), PromptGuru still demonstrates its full multimodal UI
 * with locally synthesised, mode-appropriate content. Clearly labelled in the UI.
 */
export function offlineReply(mode: ModeId, userPrompt: string, attachments: string[]): string {
  const topic = userPrompt.trim().slice(0, 160) || "your request";
  const contextLine = attachments.length
    ? `\n\n> **Context received:** ${attachments.length} attachment(s) — ${attachments
        .slice(0, 4)
        .join(", ")}${attachments.length > 4 ? " …" : ""}.`
    : "";

  const banner = `> ⚠️ **Offline preview** — the TransJules endpoint isn't reachable right now, so this answer is generated locally to demonstrate the workspace. Open **Settings → Connection Vault** and add your API key for live reasoning.`;

  const body = {
    research: researchBody(topic),
    scaffold: scaffoldBody(topic),
    diagram: diagramBody(topic),
    math: mathBody(topic),
    data: dataBody(topic),
  }[mode];

  return `${banner}${contextLine}\n\n${body}`;
}

function researchBody(topic: string): string {
  return `## TL;DR
You asked about **${topic}**. The pragmatic default is to start with the boring, well-observed architecture, instrument it, and only reach for exotic components once a measurement says you must.

## Key findings
- **Boundary clarity beats micro-optimisation.** Systems that separate ingestion, inference and presentation stay debuggable at 10× the load.
- **Streaming changes the UX budget.** Perceived latency drops sharply with token streaming even when total latency is unchanged.
- **Vendor coupling is the real risk.** An OpenAI-compatible abstraction layer lets you swap inference backends without touching product code.

## Trade-off matrix
| Option | Maturity | Latency | Ops cost | Ecosystem |
| --- | --- | --- | --- | --- |
| Single monolith | ★★★★★ | ★★★ | ★★★★★ | ★★★★★ |
| Modular monolith | ★★★★ | ★★★★ | ★★★★ | ★★★★ |
| Full microservices | ★★★ | ★★ | ★★ | ★★★ |

## Pros / cons
| ✅ Pros | ⚠️ Cons |
| --- | --- |
| Fast to ship | Harder to isolate failures |
| One deploy unit | Coupling grows silently |
| Shared types end-to-end | Team-scale contention |

## Implementation guide
1. Define the request/response contract first — a single typed \`ChatRequest\` shared by client and route handler.
2. Put credential resolution behind one function so BYOK and server env behave identically.
3. Stream with SSE; buffer only at the presentation layer.
4. Add a health probe endpoint and surface its latency in the UI.

\`\`\`ts
export type ChatRequest = { messages: { role: "user" | "assistant"; content: string }[] };
\`\`\`

## Pitfalls & observability
- Silent provider failover hides bad keys — log the resolved credential source per request.
- Track time-to-first-token, not just total duration.
- Cap attachment payloads server-side or you'll blow the context window unnoticed.

## Next
Connect your TransJules key to get a live, source-grounded briefing instead of this preview.`;
}

function scaffoldBody(topic: string): string {
  return `## Directory tree
\`\`\`text
${slug(topic)}/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── feature-panel.tsx
│   └── lib/
│       ├── errors.ts
│       └── service.ts
├── tests/
│   └── service.test.ts
├── package.json
└── README.md
\`\`\`

## File-by-file source
### src/lib/errors.ts
\`\`\`ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}
\`\`\`

### src/lib/service.ts
\`\`\`ts
import { AppError } from "./errors";

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export async function loadResource(id: string): Promise<Result<{ id: string }>> {
  if (!id.trim()) return { ok: false, error: new AppError("id required", "bad_request", 400) };
  return { ok: true, value: { id } };
}
\`\`\`

## Coding routines
- Return discriminated unions instead of throwing across module boundaries.
- One error taxonomy per service, mapped to HTTP status in exactly one place.
- Tests assert on \`Result\` shapes, never on stack traces.

## Unit tests
\`\`\`ts
import { describe, expect, it } from "vitest";
import { loadResource } from "../src/lib/service";

describe("loadResource", () => {
  it("rejects empty ids", async () => {
    const res = await loadResource(" ");
    expect(res.ok).toBe(false);
  });
});
\`\`\`

## Run instructions
\`\`\`bash
npm install
npm run dev
\`\`\`

## Module dependency graph
\`\`\`mermaid
flowchart LR
  Page[app/page.tsx] --> Panel[components/feature-panel]
  Panel --> Service[lib/service]
  Service --> Errors[lib/errors]
\`\`\`

Export this scaffold as a ZIP from the message toolbar to get real files on disk.`;
}

function diagramBody(topic: string): string {
  return `## ${topic}

\`\`\`mermaid
flowchart TD
  Client[Web Client] -->|SSE| Edge[API Route]
  Edge --> Resolve{Credential<br/>resolution}
  Resolve -->|x-user-api-key| BYOK[User Key Vault]
  Resolve -->|env fallback| Env[Server ENV]
  BYOK --> Engine[TransJules Engine]
  Env --> Engine
  Engine --> Stream[Token stream]
  Stream --> Client
\`\`\`

### Legend / reading guide
- **Solid boxes** are deployables; **diamonds** are decisions.
- The credential resolution node runs once per request, never per token.
- Streaming never buffers server-side.

### Design notes
- The edge keeps the API key out of the browser bundle entirely.
- A single resolution point means BYOK and deployment ENV cannot drift.
- Mermaid renders live here — use the canvas controls for zoom, pan and SVG/PNG export.

### Image prompt
Isometric technical illustration of a streaming AI gateway, obsidian background, cyan light trails, glassmorphic panels, cinematic.`;
}

function mathBody(topic: string): string {
  return `## Transcription
$$\text{Solve for } x:\quad 2x^2 - 5x - 3 = 0$$
_Reading of "${topic}": a quadratic in standard form. If your image shows something else, re-snap with the equation squarely inside the grid._

## Given / Find
- **Given:** $a=2,\; b=-5,\; c=-3$
- **Find:** real roots of $f(x)=0$

## Solution
**Step 1 — Discriminant.** *Quadratic formula prerequisite.*
$$\Delta = b^2 - 4ac = 25 + 24 = 49$$

**Step 2 — Root extraction.** *Quadratic formula.*
$$x = \frac{-b \pm \sqrt{\Delta}}{2a} = \frac{5 \pm 7}{4}$$

**Step 3 — Evaluate both branches.**
$$x_1 = \frac{12}{4} = 3,\qquad x_2 = \frac{-2}{4} = -\tfrac{1}{2}$$

## Verification
$f(3) = 18 - 15 - 3 = 0$ ✓ and $f(-\tfrac12) = \tfrac12 + \tfrac52 - 3 = 0$ ✓

\`\`\`answer
x = 3  or  x = -1/2
\`\`\`

## Common traps
- Dropping the sign of $b$ inside $-b$ — the most frequent quadratic slip.
- Forgetting that $\Delta=0$ yields one repeated root, not "no solution".`;
}

function dataBody(topic: string): string {
  return `## Dataset snapshot
Preview figures for **${topic}** — attach a CSV/JSON/PDF to replace these with real analysis.

| Metric | Value |
| --- | --- |
| Rows | — (no attachment in this preview) |
| Columns | — |
| Memory | — |

## Schema & types
| Column | Inferred type | Null rate | Example |
| --- | --- | --- | --- |
| id | string (uuid) | 0% | \`4f2a…\` |
| created_at | timestamp (UTC) | 0% | \`2026-11-14T09:14:00Z\` |
| amount | float | 1.2% | \`149.99\` |
| region | enum | 0% | \`eu-west\` |

## Statistical summary
- Numeric spread and outlier counts appear here once a file is attached.
- Timestamps are assumed UTC; mixed offsets are flagged as a quality issue.

## Data quality findings
- Duplicate primary keys would be reported first — they silently skew aggregates.
- PII columns are detected by name heuristics and flagged, never echoed raw.

## Insight candidates
1. Which regions grew fastest quarter-over-quarter?
2. Is there a latency/amount correlation worth pricing on?
3. Which records violate the freshest-schema contract?

## Ready-to-run analysis
\`\`\`python
import pandas as pd

df = pd.read_csv("data.csv")
print(df.shape)
print(df.dtypes)
print(df.describe(include="all").T.head(20))
\`\`\`

## Caveats
This is offline preview output: no file content was analysed.`;
}

function slug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "project"
  );
}

export function offlineStarters(mode: ModeId, attachments: string[]): { label: string; prompt: string }[] {
  if (attachments.length) {
    return [
      {
        label: "Audit this context",
        prompt: `Audit the attached context (${attachments.slice(0, 3).join(", ")}) for security vulnerabilities and correctness risks.`,
      },
      {
        label: "Map the architecture",
        prompt: "Render the architecture of this context as a Mermaid diagram and explain each boundary.",
      },
      {
        label: "Find the quickest win",
        prompt: "What single change to this context would have the highest impact? Justify it with evidence.",
      },
    ];
  }
  if (mode === "math") {
    return [
      { label: "Snap a problem", prompt: "I'll take a photo of a maths problem — transcribe it and solve it step by step." },
      { label: "Explain the method", prompt: "Explain completing the square with a worked example and common mistakes." },
      { label: "Quiz me", prompt: "Give me three quadratic equations of increasing difficulty, then check my answers." },
    ];
  }
  return [
    { label: "Compare frameworks", prompt: "Compare Next.js 15, Remix and SvelteKit for a multimodal AI product." },
    { label: "Design a system", prompt: "Design a streaming AI gateway on Vercel that supports BYOK and server fallback." },
    { label: "Scaffold a service", prompt: "Scaffold a production-grade FastAPI + Postgres service with tests." },
  ];
}

export function offlineFollowUps(mode: ModeId, attachments: string[]): { label: string; prompt: string }[] {
  const context = attachments.length ? `the attached ${attachments[0]}` : "the previous answer";
  return [
    { label: "Probe the risks", prompt: `What are the top three failure modes in ${context}, and how would I detect each one in production?` },
    {
      label: mode === "diagram" ? "Add sequence diagram" : "Generate the diagram",
      prompt: `Render ${context} as a Mermaid diagram with clear subsystem boundaries.`,
    },
    { label: "Ship an artefact", prompt: `Turn ${context} into a production-ready implementation with tests and error handling.` },
  ];
}
