"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "right";
  className?: string;
};

export function Tooltip({ label, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: side === "bottom" ? -4 : 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-white/10 bg-[#0b0e15]/95 px-2 py-1 text-[11px] font-medium text-slate-200 shadow-xl backdrop-blur-xl",
              side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
              side === "bottom" && "top-full left-1/2 mt-2 -translate-x-1/2",
              side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
              className,
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
