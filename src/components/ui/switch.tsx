"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  compact?: boolean;
};

export function Switch({ checked, onChange, label, description, disabled, compact }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition-colors",
        compact ? "h-5 w-9" : "h-6 w-11",
        checked
          ? "border-cyan-300/40 bg-cyan-400/25"
          : "border-white/12 bg-white/[0.06] hover:bg-white/[0.1]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "block rounded-full shadow-md",
          compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5",
          checked ? "bg-cyan-300" : "bg-slate-400",
        )}
        style={{ margin: compact ? 2.5 : 3, marginLeft: checked ? (compact ? 18 : 23) : compact ? 2.5 : 3 }}
      />
    </button>
  );

  if (!label && !description) return control;

  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed")}>
      <span className="min-w-0">
        {label ? <span className="block text-[13px] font-medium text-slate-100">{label}</span> : null}
        {description ? (
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-400">{description}</span>
        ) : null}
      </span>
      {control}
    </label>
  );
}
