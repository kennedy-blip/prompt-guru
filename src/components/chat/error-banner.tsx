"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  KeyRound,
  PlugZap,
  RefreshCw,
  ServerCrash,
  WifiOff,
  X,
} from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { useSettings } from "@/context/settings-provider";
import { SpringButton } from "@/components/ui/spring-button";
import { cn } from "@/lib/utils";
import type { ChatErrorInfo } from "@/lib/types";

const ICONS: Record<string, React.ElementType> = {
  auth: KeyRound,
  capacity: ServerCrash,
  upstream_interrupt: PlugZap,
  network: WifiOff,
  timeout: Clock,
  rate_limit: Clock,
  quota: KeyRound,
  endpoint_missing: PlugZap,
};

export function ErrorBanner() {
  const { errorInfo, dismissError, retryLast, status, retryNotice } = useWorkspace();
  const { setOpen, hasKey } = useSettings();
  const [showDetail, setShowDetail] = useState(false);

  return (
    <AnimatePresence>
      {retryNotice ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-2 flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/[0.08] px-3 py-2"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-300" />
          <p className="text-[11.5px] text-cyan-100">{retryNotice}</p>
        </motion.div>
      ) : null}

      {errorInfo ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "mb-3 overflow-hidden rounded-xl border",
            errorInfo.errorClass === "auth" || errorInfo.errorClass === "quota"
              ? "border-amber-300/30 bg-amber-400/[0.08]"
              : "border-rose-300/25 bg-rose-400/[0.07]",
          )}
        >
          <div className="flex items-start gap-2 p-2.5">
            {(() => {
              const Icon = ICONS[errorInfo.errorClass ?? ""] ?? AlertTriangle;
              return (
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    errorInfo.errorClass === "auth" || errorInfo.errorClass === "quota"
                      ? "text-amber-300"
                      : "text-rose-300",
                  )}
                />
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-100">{errorInfo.message}</p>
              {errorInfo.description ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{errorInfo.description}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {errorInfo.retryable ? (
                  <SpringButton
                    size="xs"
                    variant="soft"
                    loading={status === "streaming"}
                    onClick={() => void retryLast()}
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </SpringButton>
                ) : null}
                {errorInfo.errorClass === "auth" || !hasKey ? (
                  <SpringButton size="xs" variant="outline" onClick={() => setOpen(true)}>
                    <KeyRound className="h-3 w-3" /> Open Connection Vault
                  </SpringButton>
                ) : null}
                {errorInfo.errorClass === "endpoint_missing" ||
                errorInfo.errorClass === "capacity" ? (
                  <SpringButton size="xs" variant="ghost" onClick={() => setOpen(true)}>
                    Switch model
                  </SpringButton>
                ) : null}
                {(errorInfo.description || errorInfo.errorClass) ? (
                  <button
                    onClick={() => setShowDetail((value) => !value)}
                    className="ml-auto flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    details
                    <ChevronDown className={cn("h-2.5 w-2.5 transition", showDetail && "rotate-180")} />
                  </button>
                ) : null}
              </div>

              <AnimatePresence>
                {showDetail ? (
                  <motion.dl
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 overflow-hidden rounded-lg border border-white/[0.07] bg-black/30 p-2 font-mono text-[10px] text-slate-400"
                  >
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">class</dt>
                      <dd>{errorInfo.errorClass ?? "unknown"}</dd>
                    </div>
                    {errorInfo.status ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">http status</dt>
                        <dd>{errorInfo.status}</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">retryable</dt>
                      <dd>{errorInfo.retryable ? "yes" : "no"}</dd>
                    </div>
                    {errorInfo.detail ? (
                      <div className="mt-1 border-t border-white/[0.07] pt-1 text-slate-400">
                        <dt className="text-slate-500">engine said</dt>
                        <dd className="mt-0.5 break-words">{errorInfo.detail}</dd>
                      </div>
                    ) : null}
                  </motion.dl>
                ) : null}
              </AnimatePresence>
            </div>
            <button onClick={dismissError} className="shrink-0 text-slate-500 hover:text-slate-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Inline chip rendered inside an assistant bubble when a stream was interrupted. */
export function InterruptedNotice({ info }: { info?: ChatErrorInfo }) {
  const { retryLast, regenerate, status } = useWorkspace();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-300/25 bg-amber-400/[0.07] px-2.5 py-1.5">
      <PlugZap className="h-3 w-3 shrink-0 text-amber-300" />
      <p className="text-[10.5px] text-amber-100">
        {info?.message ?? "The engine's stream was interrupted."} Partial answer kept.
      </p>
      <SpringButton
        size="xs"
        variant="ghost"
        className="ml-auto"
        loading={status === "streaming"}
        onClick={() => (info ? void retryLast() : void regenerate())}
      >
        <RefreshCw className="h-3 w-3" /> Regenerate
      </SpringButton>
    </div>
  );
}
