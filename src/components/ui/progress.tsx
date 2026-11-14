"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TONES = {
  cyan: "from-cyan-400 to-cyan-200",
  indigo: "from-indigo-400 to-indigo-200",
  amber: "from-amber-400 to-amber-200",
  rose: "from-rose-400 to-rose-200",
  emerald: "from-emerald-400 to-emerald-200",
};

export function Progress({
  value,
  tone = "cyan",
  className,
}: {
  value: number;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={cn("h-full rounded-full bg-gradient-to-r", TONES[tone])}
      />
    </div>
  );
}
