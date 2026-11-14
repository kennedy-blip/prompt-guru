# ⚡ PromptGuru

**AI tech research & multimodal workspace** — a next-generation lab for developers, researchers and students, connected to the self-hosted, OpenAI-compatible **TransJules** inference engine.

Research the tech world with structured briefings, scaffold entire projects and export them as ZIPs, render live Mermaid architecture diagrams, solve maths from your camera, ingest whole repositories, and work hands-free with live voice transcription — all in one obsidian-glass interface.

---

## ✨ Feature map

| Module | What it does |
| --- | --- |
| **1 · Research & text engine** | Streaming Markdown answers (SSE) with TL;DRs, trade-off matrices, pros/cons and implementation guides. Mode-aware system prompts. |
| **1b · Scaffold mode** | Production directory trees (`├──` glyphs), per-file source, coding routines, tests, run guide, Mermaid dependency graph. **One-click ZIP export** (`jszip`) parses the answer into real files. |
| **2 · Diagrams** | The model emits ```` ```mermaid ```` blocks; they render live with **zoom, pan, fullscreen, SVG & PNG download**. Dark-theme tuned. |
| **2b · Image studio** | Prompt enhancement, 5 aspect ratios, gallery history + lightbox. Calls the engine's image model, with a deterministic **local SVG synthesis fallback**. |
| **3 · File ingestion** | Drag/drop or pick **PDF** (per-page text, page-range select), **CSV** (PapaParse: types, null rates, preview table), **JSON** (shape inference), code/images, and **whole project folders** (`webkitdirectory` + `webkitGetAsEntry`) with `node_modules`/`.git`/`dist`/binaries filtered out and a checkbox file tree + live token counter. |
| **4 · Camera & maths** | `getUserMedia` capture with front/back switching, viewfinder grid, scan-line, **shutter flash**, rotate/zoom, upload or **paste (⌘/Ctrl+V)**. A maths system prompt enforces LaTeX transcription → numbered steps with named rules → verification → highlighted `answer` callout. |
| **5 · Voice** | Web Speech API dictation (continuous + interim), live **Web Audio `AnalyserNode`** amplitude driving a pulse halo and frequency bars, **auto-send on silence**, and TTS read-aloud of answers. |
| **6 · Proactive AI** | On the empty state and whenever context is added, PromptGuru analyses it and cascades **context-aware starter cards** (`staggerChildren: 0.08`); after every answer it generates **3 clickable follow-up prompts**. |

---

## 🧠 Dual-mode credential resolution (critical)

A **hybrid BYOK architecture** — the browser key vault always wins, with a transparent server fallback.

```
request → x-user-api-key header?  ──yes──► use browser credentials
                 │no
                 ▼
          OPENAI_API_KEY env set?  ──yes──► use server credentials
                 │no
                 ▼
          HTTP 401  →  UI opens Settings → Connection Vault
```

1. **Browser key vault** — Settings → *Connection Vault*. The key is encrypted with **AES-GCM via the Web Crypto API** and stored in `localStorage` (never in plain text, never in a cookie). Includes **Clear key**, latency-ms **Test Connection**, and model presets.
2. **Server env** — `.env.local` / Vercel env vars are read by the route handlers.
3. **Neither** — routes return `401 { code: "missing_credentials" }` and the UI prompts the user to open Settings.
4. Set `JULES_LLM_FALLBACK=true` to stream a clearly-labelled **offline preview** answer instead of erroring when the engine is unreachable.

### Environment variables

```env
JULES_LLM_PROVIDER=openai
OPENAI_BASE_URL=https://trans-jules-kmokaya864-5310.vercel.app/api/v1
OPENAI_API_KEY=your-trans-jules-developer-api-key
OPENAI_MODEL=tj-qwen-dev
JULES_LLM_FALLBACK=false
# optional: model id used by /api/generate-image
OPENAI_IMAGE_MODEL=
```

Copy `.env.example` → `.env.local` and fill in your key.

---

## 🚀 Getting started

```bash
npm install          # also copies the pdf.js worker into /public
npm run dev          # http://localhost:3000  (binds 0.0.0.0)
npm run build        # production build
npm run typecheck    # tsc --noEmit (strict mode)
```

Add your key in the app (Settings → Connection Vault) **or** put it in `.env.local`.

### Deploying to Vercel

```bash
vercel            # or import the repo in the Vercel dashboard
vercel env add OPENAI_API_KEY
```

`vercel.json` sets the streaming chat function to 120 s and image generation to 90 s.
The chat route streams via `ReadableStream` + SSE with `X-Accel-Buffering: no`, so tokens arrive incrementally.

---

## 🏗 Architecture

```
src/
├── app/
│   ├── page.tsx                 # workspace (chat)
│   ├── studio/                  # image generation studio
│   ├── camera/                  # vision & maths workspace
│   ├── library/                 # prompt routine library
│   └── api/
│       ├── chat/                # SSE streaming, credential resolution
│       ├── connection/          # Test Connection probe (latency + models)
│       ├── suggestions/         # proactive starters & follow-ups
│       ├── generate-image/      # image model + SVG synthesis fallback
│       └── health/              # capability + credential source report
├── components/
│   ├── chat/                    # composer, voice, bubble, starters, ZIP export
│   ├── camera/                  # capture modal + vision workspace
│   ├── markdown/                # react-markdown + KaTeX + shiki-style code + Mermaid
│   ├── studio/  library/  settings/  ui/
├── context/                     # SettingsProvider (vault) + WorkspaceProvider (chat)
├── hooks/                       # speech recognition, speech synthesis
└── lib/
    ├── server/                  # credentials, openai client, offline engine, SVG synth
    ├── parsers/                 # pdf.js, PapaParse, JSON, folder ingestion
    ├── prompts.ts               # mode-aware system prompts
    ├── scaffold.ts              # answer → real file tree parser
    └── vault.ts                 # AES-GCM browser key vault
```

**Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · framer-motion · lucide-react · openai SDK · pdfjs-dist · papaparse · jszip · mermaid · react-markdown + remark-gfm/math + rehype-katex · prism-react-renderer.

---

## 🎨 Design language — “Cyber-Editorial Lab”

- **Obsidian** `#090A0F` base with layered radial glows, a masked grid veil and drifting ambient blobs.
- Glassmorphic surfaces (`backdrop-blur-2xl`, 1 px specular borders, inset hairlines).
- Electric cyan → indigo → violet accents; Geist/Inter sans + JetBrains Mono for code.
- **Signature motion:** spring micro-interactions (`stiffness: 400, damping: 28`), layout-animated nav/mode pills, mic pulse halo synced to real volume, camera shutter flash + scan-line, staggered card/message reveals, hover glow tracking.
- Full `prefers-reduced-motion` support, focus-visible rings and ARIA states on toggles.

---

## 🔐 Privacy notes

- Files are parsed **in the browser**; only the extracted text you choose to include is sent to your own inference endpoint.
- The API key is AES-GCM encrypted at rest in `localStorage`; it is only ever transmitted as a request header to PromptGuru's own API routes, which proxy to your engine.
- Voice audio is never recorded or stored — only the on-device transcript is used.
- Nothing is persisted to a database; there is no telemetry beyond Vercel's platform metrics.

---

## ⌨️ Shortcuts

| Keys | Action |
| --- | --- |
| `⌘/Ctrl + K` | Focus the prompt composer |
| `⌘/Ctrl + Enter` | Send the prompt |
| `Enter` / `Shift + Enter` | Send / newline |
| `⌘/Ctrl + V` (in camera) | Paste a screenshot |
| `Esc` | Close settings drawer |

---

Built with ⚡ by the PromptGuru lab. AI-generated code should always be reviewed before shipping.
