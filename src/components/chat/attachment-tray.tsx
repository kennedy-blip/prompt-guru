"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileJson, FileSpreadsheet, FileText, FolderTree, Image as ImageIcon, X } from "lucide-react";
import { useWorkspace } from "@/context/workspace-provider";
import { formatBytes } from "@/lib/utils";
import type { AttachmentKind } from "@/lib/types";

const ICONS: Record<AttachmentKind, React.ElementType> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  json: FileJson,
  code: FileText,
  image: ImageIcon,
  text: FileText,
  folder: FolderTree,
};

export function AttachmentTray() {
  const { attachments, removeAttachment, toggleAttachment } = useWorkspace();
  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2">
      <AnimatePresence initial={false}>
        {attachments.map((attachment) => {
          const Icon = ICONS[attachment.kind];
          return (
            <motion.div
              key={attachment.id}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -6 }}
              whileHover={{ scale: 1.03, y: -1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="group flex max-w-[240px] items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] py-1 pl-2 pr-1 backdrop-blur"
            >
              {attachment.kind === "image" && attachment.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.images[0]} alt="" className="h-5 w-5 rounded object-cover" />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
              )}
              <button
                onClick={() => toggleAttachment(attachment.id)}
                className="min-w-0 text-left"
                title={`${attachment.name} — ${formatBytes(attachment.size)} (click to ${attachment.enabled ? "exclude" : "include"})`}
              >
                <span
                  className={`block truncate text-[11px] ${attachment.enabled ? "text-slate-200" : "text-slate-500 line-through"}`}
                >
                  {attachment.name}
                </span>
              </button>
              <span className="hidden shrink-0 font-mono text-[9px] text-slate-500 sm:inline">
                {(attachment.meta.tokenEstimate ?? 0).toLocaleString()}t
              </span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="rounded-md p-0.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
