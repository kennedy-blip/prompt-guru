"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Blocks,
  FileSearch,
  Network,
  ShieldAlert,
  Sigma,
  Sparkles,
  Telescope,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { useSettings } from "@/context/settings-provider";
import { cn } from "@/lib/utils";
import type { ModeId } from "@/lib/types";

const STAGGER = {
  hidden: { opacity: 0, y: 14 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 + index * 0.08, type: "spring" as const, stiffness: 320, damping: 28 },
  }),
};

const MODE_ICON: Record<ModeId, React.ElementType> = {
  research: Telescope,
  scaffold: Blocks,
  diagram: Network,
  math: Sigma,
  data: BarChart3,
};

const DEFAULT_STARTERS = [
  {
    label: "Compare frameworks",
    prompt: "Compare Next.js 15, Remix and SvelteKit for a multimodal AI product with streaming.",
  },
  {
    label: "Design a system",
    prompt: "Design a streaming AI gateway on Vercel with BYOK, server fallback and per-user rate limits.",
  },
  {
    label: "Scaffold a service",
    prompt: "Scaffold a production-grade FastAPI + Postgres service with typed errors, tests and Docker.",
  },
];

/** Proactive conversation initiator shown on the empty state. */
export function StarterCards() {
  const { starters, startersLoading, refreshStarters, attachments, mode, sendMessage, status } = useWorkspace();
  const { hasKey, setOpen } = useSettings();
  const requested = useRef(false);

  useEffect(() => {
    if (!requested.current && starters.length === 0 && attachments.length === 0) {
      requested.current = true;
      void refreshStarters();
    }
  }, [attachments.length, refreshStarters, starters.length]);

  const items = starters.length ? starters : attachments.length ? [] : DEFAULT_STARTERS;
  const hasContext = attachments.length > 0;
  const ModeIcon = MODE_ICON[mode];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-2 pt-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative mb-4"
      >
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-indigo-500 shadow-[0_0_60px_-12px_rgba(34,211,238,0.85)]">
          <Sparkles className="h-7 w-7 text-obsidian" strokeWidth={2.2} />
          <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30" />
        </div>
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-2 rounded-[20px] border border-dashed border-cyan-300/25"
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl"
      >
        What are we building{" "}
        <span className="text-gradient-cyan">today?</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mt-2 max-w-xl text-[13px] leading-relaxed text-slate-400"
      >
        Research the tech world, scaffold whole projects, render live architecture diagrams, solve maths
        from your camera and ingest entire repositories — all in one multimodal workspace.
      </motion.p>

      {!hasKey ? (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => setOpen(true)}
          className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/[0.08] px-3 py-2 text-[12px] text-amber-100 transition hover:bg-amber-400/14"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Add your TransJules key to go live — or explore in offline preview
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.button>
      ) : null}

      <div className="mt-6 w-full">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[10.5px] uppercase tracking-[0.2em] text-slate-500">
          {hasContext ? (
            <>
              <FileSearch className="h-3 w-3 text-cyan-300" />
              {startersLoading ? "analysing your context…" : "proactive suggestions from your context"}
            </>
          ) : (
            <>
              <ModeIcon className="h-3 w-3 text-cyan-300" />
              start with one of these
            </>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {startersLoading && !items.length ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[72px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                />
              ))}
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" className="grid gap-2 sm:grid-cols-3">
              {items.map((item, index) => (
                <motion.button
                  key={`${item.label}-${index}`}
                  custom={index}
                  variants={STAGGER}
                  whileHover={{ y: -3, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  onClick={() =>
                    void sendMessage({
                      prompt: item.prompt,
                      mode,
                      attachments: attachments.filter((a) => a.enabled),
                    })
                  }
                  disabled={status === "streaming"}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-left transition-colors hover:border-cyan-300/30 hover:bg-cyan-400/[0.06]",
                  )}
                >
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_var(--x,50%)_0%,rgba(34,211,238,0.16),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <p className="relative flex items-center gap-1 text-[12px] font-medium text-slate-100">
                    {item.label}
                    <ArrowRight className="h-3 w-3 -translate-x-1 text-cyan-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </p>
                  <p className="relative mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-slate-400">
                    {item.prompt}
                  </p>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
