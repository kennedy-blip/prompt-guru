"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Concentric acoustic ripples synced to live microphone volume.
 * `level` is a 0..1 normalised amplitude.
 */
export function VoiceHalo({ level, active, className }: { level: number; active: boolean; className?: string }) {
  const clamped = Math.min(1, Math.max(0, level));
  const base = 1 + clamped * 0.55;

  return (
    <div className={cn("pointer-events-none absolute inset-0 grid place-items-center", className)} aria-hidden>
      <AnimatePresence>
        {active ? (
          <>
            {[0, 1, 2].map((ring) => (
              <motion.span
                key={ring}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{
                  opacity: [0.5, 0.18, 0],
                  scale: [base + ring * 0.32, base + ring * 0.32 + 0.85],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: ring * 0.28,
                  ease: "easeOut",
                }}
                className="absolute h-12 w-12 rounded-full border border-cyan-300/70 bg-cyan-400/10"
              />
            ))}
            <motion.span
              animate={{ scale: base, opacity: 0.35 + clamped * 0.6 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="absolute h-9 w-9 rounded-full bg-cyan-400/25 blur-md"
            />
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function FrequencyBars({
  level,
  active,
  bars = 22,
  className,
}: {
  level: number;
  active: boolean;
  bars?: number;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, level));
  return (
    <div className={cn("flex h-8 items-center justify-center gap-[2px]", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const center = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const wobble = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7 + clamped * 9));
        const height = active ? 4 + center * (8 + clamped * 26) * wobble : 3;
        return (
          <motion.span
            key={i}
            animate={{ height }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className={cn(
              "w-[2.5px] rounded-full",
              active ? "bg-gradient-to-t from-cyan-400/50 via-cyan-300 to-cyan-100" : "bg-slate-600",
            )}
          />
        );
      })}
    </div>
  );
}
