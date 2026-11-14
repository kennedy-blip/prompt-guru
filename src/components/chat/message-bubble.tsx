"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileArchive,
  MessageSquareQuote,
  RefreshCw,
  Volume2,
  Zap,
  Paperclip,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { extractScaffold } from "@/lib/scaffold";
import { cn } from "@/lib/utils";
import { ExportZipButton } from "./export-zip-button";

export function MessageBubble({
  message,
  isLast,
  streaming = false,
}: {
  message: ChatMessage;
  isLast: boolean;
  streaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { speak } = useSpeechSynthesis();
  const isUser = message.role === "user";
  const scaffoldFiles = useMemo(
    () => (isUser ? [] : extractScaffold(message.content)),
    [isUser, message.content],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] space-y-1.5">
          {message.images?.length ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.images.map((image, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={image}
                  alt="attachment"
                  className="max-h-40 rounded-xl border border-white/12 object-contain"
                />
              ))}
            </div>
          ) : null}
          {message.attachments?.length ? (
            <div className="flex flex-wrap justify-end gap-1">
              {message.attachments.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-400"
                >
                  <Paperclip className="h-2.5 w-2.5" /> {name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="rounded-2xl rounded-br-md border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.14] to-indigo-400/[0.08] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-cyan-50 shadow-[0_12px_34px_-22px_rgba(34,211,238,0.8)]">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="pr-1 text-right text-[9.5px] text-slate-600">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="group flex gap-2.5"
    >
      <div className="relative mt-0.5 hidden h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-indigo-500 shadow-[0_0_18px_-6px_rgba(34,211,238,0.9)] sm:grid">
        <Zap className="h-3.5 w-3.5 text-obsidian" strokeWidth={2.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11.5px] font-semibold tracking-wide text-slate-200">PromptGuru</span>
          {message.model ? (
            <Badge tone="cyan" className="font-mono">
              {message.model}
            </Badge>
          ) : null}
          {message.error ? (
            <Badge tone="rose" dot>
              error
            </Badge>
          ) : null}
          {isLast && streaming && !message.content ? (
            <span className="flex items-center gap-1 text-[10px] text-cyan-300">
              <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300" /> thinking
            </span>
          ) : null}
        </div>

        {message.error ? (
          <div className="rounded-xl border border-rose-300/25 bg-rose-400/[0.08] p-3 text-[12.5px] text-rose-100">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> Request failed
            </p>
            <p className="mt-1 leading-relaxed text-rose-100/80">{message.content}</p>
          </div>
        ) : (
          <div className="relative rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.022] px-3.5 py-2.5">
            <MarkdownRenderer content={message.content || "▍"} />
            {isLast && streaming && message.content ? (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-blink rounded-sm bg-cyan-300/80 align-middle" />
            ) : null}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Tooltip label={copied ? "Copied" : "Copy answer"}>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-cyan-200"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </Tooltip>
          <Tooltip label="Read aloud">
            <button
              onClick={() => speak(message.content)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-cyan-200"
            >
              <Volume2 className="h-3 w-3" /> Speak
            </button>
          </Tooltip>
          {scaffoldFiles.length ? (
            <ExportZipButton files={scaffoldFiles}>
              <Download className="h-3 w-3" /> Export scaffold ZIP
              <span className="font-mono text-[9px] text-cyan-300/80">{scaffoldFiles.length}</span>
            </ExportZipButton>
          ) : null}
          {message.model ? (
            <span className="ml-auto flex items-center gap-1 text-[9.5px] text-slate-600">
              <MessageSquareQuote className="h-2.5 w-2.5" />
              {message.content.split(/\s+/).filter(Boolean).length} words
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function RegenerateButton({ onRegenerate }: { onRegenerate: () => void }) {
  return (
    <button
      onClick={onRegenerate}
      className={cn(
        "mx-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-200",
      )}
    >
      <RefreshCw className="h-3 w-3" /> Regenerate response
    </button>
  );
}

export const ArchiveIcon = FileArchive;
