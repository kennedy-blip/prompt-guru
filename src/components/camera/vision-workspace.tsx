"use client";

import { motion } from "framer-motion";
import { Camera, ClipboardPaste, ImagePlus, ScanText, Sigma, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { CameraModal, type CameraCapture } from "@/components/camera/camera-modal";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { SpringButton } from "@/components/ui/spring-button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModeId } from "@/lib/types";

const MODES: { id: ModeId; label: string; hint: string; icon: React.ElementType }[] = [
  { id: "math", label: "Math reasoning", hint: "Transcribe → step-by-step → final answer callout", icon: Sigma },
  { id: "data", label: "Screenshot analysis", hint: "UI bugs, error dialogs, dashboards", icon: ScanText },
  { id: "research", label: "General vision", hint: "Anything else in the frame", icon: Sparkles },
];

export function VisionWorkspace() {
  const { sendMessage, messages, status, mode, setMode } = useWorkspace();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captures, setCaptures] = useState<CameraCapture[]>([]);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const latestAnswer = [...messages].reverse().find((m) => m.role === "assistant" && m.content);

  const analyze = async () => {
    if (!captures.length || status === "streaming") return;
    const prompt =
      note.trim() ||
      (mode === "math"
        ? "Transcribe the equation in this image exactly in LaTeX, then solve it step by step with the rules applied at each step, verify the result, and finish with a final answer block."
        : mode === "data"
          ? "Analyse this screenshot: what is broken, what is the likely root cause, and what is the minimal fix?"
          : "Describe and analyse this image in technical detail.");
    await sendMessage({
      prompt,
      mode,
      attachments: [],
      extraImages: captures.map((c) => c.dataUrl),
      attachedLabels: [`camera ×${captures.length}`],
    });
    setNote("");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    setCaptures((prev) => [
      ...prev,
      { dataUrl, width: 0, height: 0, capturedAt: Date.now() + prev.length },
    ]);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400">
              <Camera className="h-4 w-4 text-obsidian" />
            </span>
            Vision &amp; Math
          </h1>
          <Badge tone="cyan">camera · paste · upload</Badge>
        </div>

        <GlassPanel className="space-y-3 p-4">
          <div className="space-y-1.5">
            {MODES.map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl border p-2.5 text-left transition",
                  mode === item.id
                    ? "border-cyan-300/40 bg-cyan-400/[0.09]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
                )}
              >
                <item.icon className={cn("mt-0.5 h-4 w-4", mode === item.id ? "text-cyan-300" : "text-slate-500")} />
                <span>
                  <span className="block text-[12px] font-medium text-slate-100">{item.label}</span>
                  <span className="block text-[10.5px] leading-relaxed text-slate-500">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div
            onClick={() => setCameraOpen(true)}
            className="group relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-400/[0.04] py-8 transition hover:border-cyan-300/50 hover:bg-cyan-400/[0.08]"
          >
            <div className="animate-scanline absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
            <div className="relative text-center">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto grid h-12 w-12 place-items-center rounded-full border-2 border-cyan-300/50 bg-cyan-400/15"
              >
                <Camera className="h-5 w-5 text-cyan-200" />
              </motion.div>
              <p className="mt-2 text-[12.5px] font-medium text-cyan-50">Open camera</p>
              <p className="mt-0.5 text-[10.5px] text-cyan-200/60">
                front/back switch · grid guides · shutter flash
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            <SpringButton variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" /> Upload
            </SpringButton>
            <SpringButton
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={async () => {
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) {
                    const type = item.types.find((t) => t.startsWith("image/"));
                    if (!type) continue;
                    const blob = await item.getType(type);
                    await onFile(new File([blob], "pasted.png", { type }));
                    break;
                  }
                } catch {
                  /* clipboard read blocked */
                }
              }}
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste
            </SpringButton>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </div>

          {captures.length ? (
            <div className="grid grid-cols-2 gap-1.5">
              {captures.map((capture) => (
                <div key={capture.capturedAt} className="group relative overflow-hidden rounded-lg border border-white/12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capture.dataUrl} alt="capture" className="aspect-video w-full object-cover" />
                  <button
                    onClick={() => setCaptures((prev) => prev.filter((c) => c.capturedAt !== capture.capturedAt))}
                    className="absolute right-1 top-1 rounded bg-black/70 p-1 text-rose-300 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Optional instruction — e.g. 'solve question 4 only' or 'why is this build failing?'"
            className="w-full resize-none rounded-xl border border-white/12 bg-black/35 p-2.5 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none"
          />

          <SpringButton
            variant="primary"
            className="w-full"
            disabled={!captures.length || status === "streaming"}
            loading={status === "streaming"}
            onClick={() => void analyze()}
          >
            <Upload className="h-4 w-4" /> Analyse {captures.length ? `(${captures.length})` : ""}
          </SpringButton>
        </GlassPanel>
      </div>

      <GlassPanel className="flex min-h-[520px] flex-col p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12.5px] font-semibold text-slate-100">Reasoning output</h2>
          {latestAnswer?.model ? (
            <Badge tone="cyan" className="font-mono">
              {latestAnswer.model}
            </Badge>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
          {latestAnswer ? (
            <MarkdownRenderer content={latestAnswer.content} />
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Sigma className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-[12px] text-slate-400">No analysis yet</p>
                <p className="mx-auto mt-1 max-w-xs text-[10.5px] leading-relaxed text-slate-600">
                  Capture a maths problem and PromptGuru will transcribe it in LaTeX, walk every step with
                  the rule applied, verify, and highlight the final answer.
                </p>
              </div>
            </div>
          )}
        </div>
      </GlassPanel>

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(capture) => setCaptures((prev) => [...prev, capture])}
      />
    </div>
  );
}
