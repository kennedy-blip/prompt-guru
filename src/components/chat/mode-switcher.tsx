"use client";

import { motion } from "framer-motion";
import { BarChart3, Blocks, Network, Sigma, Telescope } from "lucide-react";
import { useWorkspace } from "@/context/workspace-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ModeId } from "@/lib/types";

const MODES: { id: ModeId; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "research", label: "Research", icon: Telescope, hint: "Deep briefings with trade-off matrices" },
  { id: "scaffold", label: "Scaffold", icon: Blocks, hint: "Project trees, code & tests — exportable as ZIP" },
  { id: "diagram", label: "Diagram", icon: Network, hint: "Live Mermaid architecture diagrams" },
  { id: "math", label: "Math", icon: Sigma, hint: "Step-by-step LaTeX reasoning from camera or text" },
  { id: "data", label: "Data", icon: BarChart3, hint: "PDF / CSV / JSON / repo analysis" },
];

export function ModeSwitcher() {
  const { mode, setMode } = useWorkspace();

  return (
    <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] p-1">
      {MODES.map((item) => {
        const active = mode === item.id;
        return (
          <Tooltip key={item.id} label={item.hint}>
            <button
              onClick={() => setMode(item.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                active ? "text-white" : "text-slate-400 hover:text-slate-100",
              )}
              aria-pressed={active}
            >
              {active ? (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 rounded-xl border border-cyan-300/25 bg-gradient-to-b from-cyan-400/20 to-indigo-400/10 shadow-[0_6px_20px_-10px_rgba(34,211,238,0.9)]"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
              <item.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{item.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
