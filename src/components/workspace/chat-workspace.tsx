"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { useSettings } from "@/context/settings-provider";
import { Composer } from "@/components/chat/composer";
import { ContextDropzone } from "@/components/chat/context-dropzone";
import { MessageBubble, RegenerateButton } from "@/components/chat/message-bubble";
import { StarterCards } from "@/components/chat/starter-cards";
import { FollowUpChips } from "@/components/chat/follow-up-chips";
import { ModeSwitcher } from "@/components/chat/mode-switcher";
import { SpringButton } from "@/components/ui/spring-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ChatWorkspace() {
  const {
    messages,
    status,
    reset,
    regenerate,
    errorBanner,
    dismissError,
    simulated,
    lastModel,
    contextTokens,
  } = useWorkspace();
  const { setOpen, hasKey } = useSettings();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    if (!pinned) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  const empty = messages.length === 0;

  return (
    <ContextDropzone>
      <div className="flex h-[calc(100dvh-9.5rem)] min-h-[520px] flex-col">
        {/* toolbar */}
        <div className="mb-2 flex items-center gap-2 px-0.5">
          <ModeSwitcher />
          <div className="ml-auto flex items-center gap-1.5">
            {simulated ? (
              <Badge tone="amber" className="hidden sm:inline-flex">
                preview engine
              </Badge>
            ) : lastModel ? (
              <Badge tone="cyan" className="hidden font-mono sm:inline-flex">
                {lastModel}
              </Badge>
            ) : null}
            {contextTokens > 0 ? (
              <Badge tone="slate" className="hidden font-mono md:inline-flex">
                {contextTokens.toLocaleString()} ctx tok
              </Badge>
            ) : null}
            {messages.length ? (
              <SpringButton size="sm" variant="ghost" onClick={reset} aria-label="New session">
                <RotateCcw className="h-3.5 w-3.5" /> New
              </SpringButton>
            ) : null}
          </div>
        </div>

        {/* conversation */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="relative min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.012] px-2.5 py-3 sm:px-4"
        >
          <AnimatePresence>
            {errorBanner ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-400/[0.08] p-2.5"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] leading-relaxed text-amber-100">{errorBanner}</p>
                  {!hasKey ? (
                    <button
                      onClick={() => setOpen(true)}
                      className="mt-1 text-[11px] font-medium text-amber-200 underline decoration-amber-300/40 underline-offset-2"
                    >
                      Open Connection Vault →
                    </button>
                  ) : null}
                </div>
                <button onClick={dismissError} className="text-amber-300/60 hover:text-amber-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {empty ? (
            <StarterCards />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4 pb-2">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                  streaming={status === "streaming"}
                />
              ))}
              {status === "idle" && messages.some((m) => m.role === "assistant" && m.content) ? (
                <RegenerateButton onRegenerate={() => void regenerate()} />
              ) : null}
              <FollowUpChips />
            </div>
          )}

          <AnimatePresence>
            {!pinned && !empty ? (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setPinned(true);
                  scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }}
                className="sticky bottom-2 mx-auto flex items-center gap-1 rounded-full border border-white/12 bg-[#0b0e15]/90 px-2.5 py-1 text-[10.5px] text-slate-300 backdrop-blur"
              >
                <ArrowDown className="h-3 w-3" /> jump to latest
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>

        <div className={cn("mt-2", empty && "pt-1")}>
          <Composer />
        </div>
      </div>
    </ContextDropzone>
  );
}
