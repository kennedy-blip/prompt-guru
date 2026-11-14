"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Compass, GitBranch, ShieldQuestion, Sparkles } from "lucide-react";
import { useWorkspace } from "@/context/workspace-provider";

const ICONS = [ShieldQuestion, GitBranch, Compass];

/** Post-answer proactive follow-up engine. */
export function FollowUpChips() {
  const { followUps, followUpsLoading, attachments, mode, sendMessage, status, messages } = useWorkspace();
  const hasAnswer = messages.some((m) => m.role === "assistant" && m.content && !m.error);
  if (!hasAnswer && !followUpsLoading) return null;

  return (
    <div className="mt-3">
      <AnimatePresence mode="popLayout">
        {followUpsLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[10.5px] text-slate-500"
          >
            <Sparkles className="h-3 w-3 animate-pulse text-cyan-300" /> generating follow-ups…
          </motion.div>
        ) : (
          <motion.div
            key="items"
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-1.5"
          >
            {followUps.slice(0, 3).map((item, index) => {
              const Icon = ICONS[index % ICONS.length];
              return (
                <motion.button
                  key={`${item.label}-${index}`}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { delay: index * 0.08 } },
                  }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  disabled={status === "streaming"}
                  onClick={() =>
                    void sendMessage({
                      prompt: item.prompt,
                      mode,
                      attachments: attachments.filter((a) => a.enabled),
                    })
                  }
                  className="group flex max-w-full items-center gap-1.5 rounded-full border border-indigo-300/20 bg-indigo-400/[0.08] px-2.5 py-1 text-[11px] text-indigo-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                >
                  <Icon className="h-3 w-3 shrink-0 text-cyan-300/80" />
                  <span className="truncate">{item.label}</span>
                  <ArrowUpRight className="h-2.5 w-2.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
