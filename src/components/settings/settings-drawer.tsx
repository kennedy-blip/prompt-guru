"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Link2,
  Loader2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "@/context/settings-provider";
import { SpringButton } from "@/components/ui/spring-button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn, normaliseBaseUrl } from "@/lib/utils";

const MODEL_PRESETS = ["tj-qwen-dev", "tj-qwen-vl", "tj-deepseek-r1", "tj-llama-3.3-70b"];

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update, saveKey, clearKey, testConnection, status, probe, serverHasKey } = useSettings();
  const [keyInput, setKeyInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (open) setKeyInput(settings.apiKey);
  }, [open, settings.apiKey]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const persistKey = async () => {
    await saveKey(keyInput);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-60 flex justify-end bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
            className="relative flex h-full w-[min(96vw,480px)] flex-col border-l border-white/10 bg-[#0a0c12]/96 backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between border-b border-white/[0.07] p-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" /> Connection Vault
                </h2>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                  Credentials resolve in order: your browser key → server environment → offline preview.
                  Your key is encrypted with AES-GCM and never leaves this device except in request headers.
                </p>
              </div>
              <SpringButton size="icon" variant="ghost" onClick={onClose} aria-label="Close settings">
                <X className="h-4 w-4" />
              </SpringButton>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {/* ---------- API key ---------- */}
              <section className="space-y-2">
                <SectionTitle icon={KeyRound} title="TransJules API key" hint="BYOK · stored locally" />
                <div className="relative">
                  <input
                    type={reveal ? "text" : "password"}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                    onBlur={persistKey}
                    placeholder="tj_live_••••••••••••••••"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 w-full rounded-xl border border-white/12 bg-black/35 pl-9 pr-20 font-mono text-[12.5px] text-slate-100 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none"
                  />
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      aria-label={reveal ? "Hide key" : "Reveal key"}
                    >
                      {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {settings.apiKey ? (
                      <button
                        type="button"
                        onClick={() => {
                          clearKey();
                          setKeyInput("");
                        }}
                        className="rounded-md p-1.5 text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-200"
                        aria-label="Clear key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SpringButton size="sm" variant="soft" onClick={persistKey}>
                    {savedFlash ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {savedFlash ? "Saved to vault" : "Save key"}
                  </SpringButton>
                  <SpringButton
                    size="sm"
                    variant="outline"
                    loading={status === "testing"}
                    onClick={() => void testConnection()}
                  >
                    {status !== "testing" ? <Gauge className="h-3.5 w-3.5" /> : null}
                    Test connection
                  </SpringButton>
                  {settings.apiKey ? (
                    <Badge tone="emerald" dot>
                      key in vault
                    </Badge>
                  ) : serverHasKey ? (
                    <Badge tone="cyan" dot>
                      server key available
                    </Badge>
                  ) : (
                    <Badge tone="amber" dot>
                      no key yet
                    </Badge>
                  )}
                </div>

                <AnimatePresence>
                  {probe ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        "rounded-xl border p-2.5 text-[11.5px]",
                        probe.ok
                          ? "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100"
                          : "border-rose-300/25 bg-rose-400/[0.08] text-rose-100",
                      )}
                    >
                      <p className="flex items-center gap-1.5 font-medium">
                        {probe.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <TriangleAlert className="h-3.5 w-3.5" />
                        )}
                        {probe.ok
                          ? `Connected to ${probe.model ?? settings.model}`
                          : "Connection failed"}
                        {probe.latencyMs !== undefined ? (
                          <span className="ml-auto font-mono text-[10px] opacity-80">
                            {probe.latencyMs} ms
                          </span>
                        ) : null}
                      </p>
                      {!probe.ok && probe.error ? (
                        <p className="mt-1 leading-relaxed opacity-80">{probe.error}</p>
                      ) : null}
                      {probe.ok && probe.models?.length ? (
                        <p className="mt-1 font-mono text-[10px] opacity-70">
                          {probe.models.slice(0, 6).join(" · ")}
                        </p>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>

              {/* ---------- base url ---------- */}
              <section className="space-y-2">
                <SectionTitle icon={Link2} title="Base URL" hint="OpenAI-compatible endpoint" />
                <input
                  value={settings.baseUrl}
                  onChange={(event) => update({ baseUrl: event.target.value })}
                  onBlur={() => update({ baseUrl: normaliseBaseUrl(settings.baseUrl) })}
                  spellCheck={false}
                  className="h-10 w-full rounded-xl border border-white/12 bg-black/35 px-3 font-mono text-[11.5px] text-slate-200 focus:border-cyan-300/50 focus:outline-none"
                />
                <p className="font-mono text-[10px] text-slate-500">
                  resolves → {normaliseBaseUrl(settings.baseUrl) || "—"}
                </p>
              </section>

              {/* ---------- model ---------- */}
              <section className="space-y-2">
                <SectionTitle icon={Zap} title="Model" hint="TransJules deployment id" />
                <input
                  value={settings.model}
                  onChange={(event) => update({ model: event.target.value })}
                  spellCheck={false}
                  className="h-10 w-full rounded-xl border border-white/12 bg-black/35 px-3 font-mono text-[12px] text-slate-200 focus:border-cyan-300/50 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {MODEL_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => update({ model: preset })}
                      className={cn(
                        "rounded-lg border px-2 py-1 font-mono text-[10.5px] transition",
                        settings.model === preset
                          ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </section>

              {/* ---------- behaviour ---------- */}
              <section className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <SectionTitle icon={Gauge} title="Behaviour" hint="applies immediately" />
                <Switch
                  label="Offline preview mode"
                  description="Stream a locally generated demo answer instead of calling the engine. Useful for UI walkthroughs."
                  checked={settings.previewMode}
                  onChange={(checked) => update({ previewMode: checked })}
                />
                <div className="h-px bg-white/[0.06]" />
                <Switch
                  label="Auto-send on silence"
                  description="When voice capture stops hearing speech for 1.6 s, send the prompt automatically."
                  checked={settings.autoSendOnSilence}
                  onChange={(checked) => update({ autoSendOnSilence: checked })}
                />
                <div className="h-px bg-white/[0.06]" />
                <Switch
                  label="Read answers aloud"
                  description="Speak completed answers with the browser speech synthesis engine."
                  checked={settings.ttsEnabled}
                  onChange={(checked) => update({ ttsEnabled: checked })}
                />
                <div className="h-px bg-white/[0.06]" />
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-100">Temperature</span>
                    <span className="font-mono text-[11px] text-cyan-200">
                      {settings.temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.05}
                    value={settings.temperature}
                    onChange={(event) => update({ temperature: Number(event.target.value) })}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>precise</span>
                    <span>creative</span>
                  </div>
                </div>
              </section>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-400">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-200">
                  {status === "testing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
                  )}
                  Resolution priority
                </p>
                <ol className="list-decimal space-y-0.5 pl-4">
                  <li>
                    <code className="font-mono text-cyan-200">x-user-api-key</code> header from this browser
                    vault
                  </li>
                  <li>
                    <code className="font-mono text-cyan-200">OPENAI_API_KEY</code> from the deployment
                    environment
                  </li>
                  <li>No key → HTTP 401 and this drawer opens automatically</li>
                </ol>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-cyan-300/80" />
      <h3 className="text-[12px] font-semibold text-slate-100">{title}</h3>
      <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">{hint}</span>
    </div>
  );
}
