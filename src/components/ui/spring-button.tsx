"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 28 };

type Variant = "primary" | "ghost" | "outline" | "soft" | "danger";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-obsidian bg-gradient-to-br from-cyan-300 via-cyan-400 to-indigo-400 font-semibold shadow-[0_10px_30px_-12px_rgba(34,211,238,0.75)] hover:brightness-110",
  ghost: "text-slate-300 hover:text-white hover:bg-white/[0.06]",
  outline:
    "text-slate-200 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-cyan-300/40",
  soft: "text-cyan-100 bg-cyan-400/10 border border-cyan-300/20 hover:bg-cyan-400/16",
  danger: "text-rose-100 bg-rose-500/12 border border-rose-400/25 hover:bg-rose-500/20",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1 rounded-lg",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-sm gap-2.5 rounded-2xl",
  icon: "h-9 w-9 rounded-xl justify-center",
};

export type SpringButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
};

export const SpringButton = forwardRef<HTMLButtonElement, SpringButtonProps>(function SpringButton(
  { className, variant = "outline", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileHover={disabled ? undefined : { scale: 1.025 }}
      whileTap={disabled ? undefined : { scale: 0.965 }}
      transition={SPRING}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : null}
      {children as React.ReactNode}
    </motion.button>
  );
});
