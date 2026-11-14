"use client";

import { motion } from "framer-motion";
import {
  ArrowUp,
  AudioLines,
  Camera,
  CircleStop,
  CornerDownLeft,
  Mic,
  MicOff,
  ScanText,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { useSettings } from "@/context/settings-provider";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { CameraModal, type CameraCapture } from "@/components/camera/camera-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { VoiceHalo } from "./voice-halo";
import { AttachmentTray } from "./attachment-tray";
import { cn } from "@/lib/utils";

const PLACEHOLDERS: Record<string, string> = {
  research: "Ask anything — architectures, framework trade-offs, migrations…",
  scaffold: "Describe the project to scaffold — stack, features, constraints…",
  diagram: "Describe the system to visualise — 'auth flow with OAuth + refresh tokens'…",
  math: "Type a problem, snap a photo, or say it aloud…",
  data: "Ask a question about your attachments, or drop files here…",
};

export function Composer() {
  const {
    mode,
    sendMessage,
    status,
    stopStreaming,
    attachments,
    addAttachments,
  } = useWorkspace();
  const { settings, setOpen } = useSettings();
  const [value, setValue] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captured, setCaptured] = useState<CameraCapture[]>([]);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streaming = status === "streaming";

  const voice = useSpeechRecognition({
    autoSendOnSilence: settings.autoSendOnSilence,
    onSilence: () => void submitRef.current(),
  });
  const submitRef = useRef<(text?: string) => Promise<void>>(async () => undefined);

  const submit = useCallback(
    async (text?: string) => {
      const content = (text ?? value).trim();
      const extraImages = captured.map((c) => c.dataUrl);
      if ((!content && !extraImages.length && !attachments.length) || streaming) return;
      setValue("");
      setCaptured([]);
      voice.reset();
      voice.stop();
      const prompt =
        content ||
        (extraImages.length
          ? mode === "math"
            ? "Solve the problem in this image step by step."
            : "Analyse this image in detail."
          : "Analyse the attached context.");
      await sendMessage({
        prompt,
        mode,
        attachments: attachments.filter((a) => a.enabled),
        extraImages,
        attachedLabels: [
          ...attachments.filter((a) => a.enabled).map((a) => a.name),
          ...(extraImages.length ? [`camera capture ×${extraImages.length}`] : []),
        ],
      });
    },
    [attachments, captured, mode, sendMessage, streaming, value, voice],
  );

  submitRef.current = submit;

  // Mirror live transcription into the textarea as the user speaks.
  useEffect(() => {
    if (!voice.listening) return;
    const composed = `${voice.finalText} ${voice.interim}`.trim();
    if (composed) setValue(composed);
  }, [voice.finalText, voice.interim, voice.listening]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // Global ⌘K → focus composer; ⌘V image paste is handled in the camera modal.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submit]);

  const onCapture = (capture: CameraCapture) => {
    setCaptured((prev) => [...prev, capture].slice(0, 4));
    if (mode !== "math" && mode !== "data") {
      // keep the user's mode; vision works in every mode
    }
  };

  return (
    <>
      <div className="sticky bottom-0 z-20 -mx-1 px-1 pb-2 pt-3">
        <div
          className={cn(
            "glass relative rounded-2xl p-2 transition-shadow duration-300",
            focused ? "shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_24px_60px_-30px_rgba(34,211,238,0.7)]" : "",
            voice.listening ? "shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_0_60px_-20px_rgba(34,211,238,0.8)]" : "",
          )}
        >
          <AttachmentTray />

          {captured.length ? (
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {captured.map((capture) => (
                <motion.div
                  key={capture.capturedAt}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative overflow-hidden rounded-lg border border-cyan-300/25"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capture.dataUrl} alt="capture" className="h-14 w-20 object-cover" />
                  <button
                    onClick={() => setCaptured((prev) => prev.filter((c) => c.capturedAt !== capture.capturedAt))}
                    className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove capture"
                  >
                    <MicOff className="h-2.5 w-2.5" />
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[8px] text-cyan-200">
                    vision
                  </span>
                </motion.div>
              ))}
            </div>
          ) : null}

          <div className="relative flex items-end gap-1.5 px-1">
            <Tooltip label="Capture or upload an image (vision)">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={() => setCameraOpen(true)}
                className="relative mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
                aria-label="Open camera"
              >
                <Camera className="h-4 w-4" />
                {mode === "math" ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-300" />
                ) : null}
              </motion.button>
            </Tooltip>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              placeholder={PLACEHOLDERS[mode] ?? PLACEHOLDERS.research}
              className="max-h-[200px] min-h-[36px] w-full resize-none bg-transparent px-1 py-2 text-[13.5px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />

            <div className="relative mb-0.5 flex shrink-0 items-center gap-1">
              <Tooltip
                label={
                  voice.supported
                    ? voice.listening
                      ? "Stop listening"
                      : "Dictate with your voice"
                    : "Speech recognition unavailable in this browser"
                }
              >
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  onClick={() => (voice.listening ? voice.stop() : void voice.start())}
                  disabled={!voice.supported}
                  className={cn(
                    "relative grid h-9 w-9 place-items-center rounded-xl border transition disabled:opacity-40",
                    voice.listening
                      ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200",
                  )}
                  aria-label={voice.listening ? "Stop dictation" : "Start dictation"}
                  aria-pressed={voice.listening}
                >
                  <VoiceHalo level={voice.level} active={voice.listening} />
                  {voice.listening ? <AudioLines className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </motion.button>
              </Tooltip>

              {streaming ? (
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={stopStreaming}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/40 bg-rose-500/20 text-rose-100"
                  aria-label="Stop generating"
                >
                  <CircleStop className="h-4 w-4" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  onClick={() => void submit()}
                  disabled={!value.trim() && !captured.length && !attachments.length}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-indigo-400 text-obsidian shadow-[0_8px_24px_-10px_rgba(34,211,238,0.9)] disabled:from-slate-700 disabled:via-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none"
                  aria-label="Send prompt"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.8} />
                </motion.button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-1.5">
            {voice.listening ? (
              <span className="flex items-center gap-1.5 text-[10.5px] text-cyan-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
                </span>
                Listening… {voice.interim ? `“${voice.interim.slice(-48)}”` : "speak now"}
                {settings.autoSendOnSilence ? (
                  <span className="rounded bg-cyan-400/15 px-1 text-[9px]">auto-send on</span>
                ) : null}
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <CornerDownLeft className="h-2.5 w-2.5" /> send
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <ScanText className="h-2.5 w-2.5" /> shift+enter newline
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Wand2 className="h-2.5 w-2.5" /> ⌘K focus
                </span>
                {settings.previewMode ? (
                  <span className="flex items-center gap-1 rounded bg-amber-400/12 px-1.5 py-0.5 text-[9.5px] text-amber-200">
                    <Sparkles className="h-2.5 w-2.5" /> preview mode
                  </span>
                ) : null}
                {voice.error ? (
                  <span className="text-[10px] text-rose-300">{voice.error}</span>
                ) : !voice.supported ? (
                  <span className="text-[10px] text-slate-600">voice needs Chrome/Edge/Safari</span>
                ) : null}
                {!settings.apiKey ? (
                  <button
                    onClick={() => setOpen(true)}
                    className="ml-auto text-[10px] text-amber-300/90 underline decoration-amber-300/30 underline-offset-2 hover:text-amber-200"
                  >
                    add API key
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={onCapture} />
    </>
  );
}
