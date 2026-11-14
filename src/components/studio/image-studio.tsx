"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  Expand,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { useSettings } from "@/context/settings-provider";
import { SpringButton } from "@/components/ui/spring-button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn, relativeTime } from "@/lib/utils";
import type { AspectRatio, GeneratedImage } from "@/lib/types";

const ASPECTS: { id: AspectRatio; label: string; box: string }[] = [
  { id: "1:1", label: "Square", box: "h-5 w-5" },
  { id: "16:9", label: "Wide", box: "h-3.5 w-6" },
  { id: "9:16", label: "Portrait", box: "h-6 w-3.5" },
  { id: "4:3", label: "Classic", box: "h-4 w-5.5" },
  { id: "3:2", label: "Photo", box: "h-4 w-6" },
];

const STYLE_PRESETS = [
  { label: "Cyber blueprint", prompt: "isometric technical blueprint of" },
  { label: "Obsidian render", prompt: "dark obsidian product render with cyan rim lighting of" },
  { label: "Editorial diagram", prompt: "clean editorial vector diagram of" },
  { label: "Cinematic", prompt: "cinematic 35mm photograph, shallow depth of field, of" },
];

const SUGGESTIONS = [
  "A glassmorphic AI gateway dashboard floating in obsidian space, cyan light trails",
  "Isometric cutaway of a vector database cluster with glowing shards",
  "Minimal editorial diagram of a transformer attention block, indigo accents",
];

export function ImageStudio() {
  const { gallery, addGalleryImage, removeGalleryImage } = useWorkspace();
  const { settings, credentialHeaders } = useSettings();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [enhance, setEnhance] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GeneratedImage | null>(null);

  const generate = useCallback(async () => {
    const clean = prompt.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...credentialHeaders() },
        body: JSON.stringify({ prompt: clean, aspect, enhance }),
      });
      const data = (await response.json()) as {
        id?: string;
        url?: string;
        prompt?: string;
        enhancedPrompt?: string;
        source?: "model" | "synthesis";
        model?: string;
        warning?: string;
        error?: string;
      };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Generation failed. Check your key in Settings.");
        return;
      }
      if (data.warning) setWarning(data.warning);
      addGalleryImage({
        id: data.id ?? String(Date.now()),
        prompt: data.prompt ?? clean,
        enhancedPrompt: data.enhancedPrompt,
        url: data.url,
        aspect,
        createdAt: Date.now(),
        source: data.source ?? "synthesis",
        model: data.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }, [addGalleryImage, aspect, busy, credentialHeaders, enhance, prompt]);

  const download = (image: GeneratedImage) => {
    const link = document.createElement("a");
    link.href = image.url;
    link.download = `promptguru-${image.id}.${image.url.startsWith("data:image/svg") ? "svg" : "png"}`;
    link.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500">
            <ImageIcon className="h-4 w-4 text-white" />
          </span>
          Image Generation Studio
        </h1>
        <Badge tone="violet">{settings.model}</Badge>
        <span className="ml-auto text-[11px] text-slate-500">
          routes to your engine&apos;s image model, with a local SVG synthesis fallback
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ---------------- controls ---------------- */}
        <GlassPanel className="h-fit space-y-3.5 p-4">
          <div>
            <label className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-slate-200">
              Prompt
              <span className="font-mono text-[10px] text-slate-500">{prompt.length}/1200</span>
            </label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, 1200))}
              rows={4}
              placeholder="Describe the image — subject, composition, lighting, style…"
              className="w-full resize-none rounded-xl border border-white/12 bg-black/35 p-3 text-[12.5px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11.5px] font-medium text-slate-200">Quick style</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    setPrompt((prev) => (prev.startsWith(preset.prompt) ? prev.slice(preset.prompt.length).trim() : `${preset.prompt} ${prev}`.trim()))
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-300 transition hover:border-violet-300/40 hover:text-violet-100"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11.5px] font-medium text-slate-200">Aspect ratio</p>
            <div className="grid grid-cols-5 gap-1.5">
              {ASPECTS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setAspect(option.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border py-2 transition",
                    aspect === option.id
                      ? "border-cyan-300/45 bg-cyan-400/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20",
                  )}
                >
                  <span className={cn("rounded-[3px] border border-current opacity-70", option.box)} />
                  <span className="font-mono text-[9px]">{option.id}</span>
                </button>
              ))}
            </div>
          </div>

          <Switch
            label="Prompt enhancement"
            description="Ask the model to enrich your prompt before generation."
            checked={enhance}
            onChange={setEnhance}
          />

          <SpringButton
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy}
            onClick={() => void generate()}
            disabled={!prompt.trim()}
          >
            {!busy ? <Sparkles className="h-4 w-4" /> : null}
            {busy ? "Rendering…" : "Generate image"}
          </SpringButton>

          {error ? (
            <p className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-2 text-[11px] text-rose-100">{error}</p>
          ) : null}
          {warning ? (
            <p className="rounded-lg border border-amber-300/25 bg-amber-400/10 p-2 text-[11px] text-amber-100">
              {warning}
            </p>
          ) : null}

          <div>
            <p className="mb-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-slate-500">
              <Wand2 className="h-3 w-3" /> Try these
            </p>
            <div className="space-y-1">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setPrompt(suggestion)}
                  className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 text-left text-[10.5px] leading-relaxed text-slate-400 transition hover:border-violet-300/30 hover:text-slate-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* ---------------- gallery ---------------- */}
        <GlassPanel className="min-h-[420px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12.5px] font-semibold text-slate-100">
              Gallery <span className="ml-1 font-mono text-[10px] text-slate-500">{gallery.length}</span>
            </h2>
            {gallery.length ? (
              <span className="text-[10px] text-slate-500">hover a tile to download or remove</span>
            ) : null}
          </div>

          {busy ? (
            <div className={cn("mb-3 grid place-items-center overflow-hidden rounded-xl border border-cyan-300/20 bg-cyan-400/[0.04]", aspect === "9:16" ? "h-72" : "h-56")}>
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
                <p className="text-[11px] text-cyan-200/80">synthesising pixels…</p>
              </div>
            </div>
          ) : null}

          {gallery.length === 0 && !busy ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-20 text-center">
              <div>
                <ImageIcon className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-[12px] text-slate-400">No renders yet</p>
                <p className="mt-1 max-w-xs text-[10.5px] leading-relaxed text-slate-600">
                  Describe something and hit generate. Without an image-capable key, PromptGuru renders a
                  deterministic SVG poster locally so the pipeline stays testable.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {gallery.map((image) => (
                <motion.figure
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className={cn(
                      "w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                      image.aspect === "9:16" ? "aspect-[9/16]" : image.aspect === "1:1" ? "aspect-square" : "aspect-video",
                    )}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-80" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="line-clamp-2 text-[10.5px] leading-snug text-slate-100">{image.prompt}</p>
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                      <span className="rounded bg-cyan-400/15 px-1 text-cyan-200">{image.aspect}</span>
                      {image.source === "synthesis" ? "local synth" : image.model}
                      <span className="ml-auto">{relativeTime(image.createdAt)}</span>
                    </p>
                  </figcaption>
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <SpringButton size="icon" variant="outline" className="h-7 w-7 bg-black/60" onClick={() => setLightbox(image)}>
                      <Expand className="h-3 w-3" />
                    </SpringButton>
                    <SpringButton size="icon" variant="outline" className="h-7 w-7 bg-black/60" onClick={() => download(image)}>
                      <Download className="h-3 w-3" />
                    </SpringButton>
                    <SpringButton
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 bg-black/60 text-rose-300"
                      onClick={() => removeGalleryImage(image.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </SpringButton>
                  </div>
                </motion.figure>
              ))}
            </AnimatePresence>
          </div>
        </GlassPanel>
      </div>

      <AnimatePresence>
        {lightbox ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-70 grid place-items-center bg-black/90 p-5 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full w-full max-w-3xl"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="text-[12px] leading-relaxed text-slate-300">{lightbox.prompt}</p>
                <SpringButton size="icon" variant="ghost" onClick={() => setLightbox(null)}>
                  <X className="h-4 w-4" />
                </SpringButton>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.url} alt={lightbox.prompt} className="max-h-[74vh] w-full rounded-2xl object-contain" />
              {lightbox.enhancedPrompt ? (
                <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-slate-400">
                  <span className="font-semibold text-cyan-200">Enhanced prompt · </span>
                  {lightbox.enhancedPrompt}
                </p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
