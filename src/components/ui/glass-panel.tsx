"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type GlassPanelProps = HTMLMotionProps<"div"> & {
  glow?: "none" | "cyan" | "indigo" | "violet";
  inset?: boolean;
};

const GLOWS = {
  none: "",
  cyan: "shadow-[0_0_0_1px_rgba(34,211,238,0.16),0_24px_70px_-36px_rgba(34,211,238,0.55)]",
  indigo: "shadow-[0_0_0_1px_rgba(99,102,241,0.16),0_24px_70px_-36px_rgba(99,102,241,0.55)]",
  violet: "shadow-[0_0_0_1px_rgba(168,85,247,0.16),0_24px_70px_-36px_rgba(168,85,247,0.5)]",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { className, glow = "none", children, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn("glass relative rounded-2xl", GLOWS[glow], className)}
      {...props}
    >
      {children}
    </motion.div>
  );
});
