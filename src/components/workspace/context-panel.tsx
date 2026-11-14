"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { useSettings } from "@/context/settings-provider";
import { SpringButton } from "@/components/ui/spring-button";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes } from "@/lib/utils";
import type { AttachmentKind, ParsedAttachment } from "@/lib/types";

const KIND_ICON: Record<AttachmentKind, React.ElementType> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  json: FileJson,
  code: FileText,
  image: ImageIcon,
  text: FileText,
  folder: FolderTree,
};

const CONTEXT_BUDGET = 128_000;

export function ContextPanel() {
  const {
    attachments,
    removeAttachment,
    toggleAttachment,
    toggleProjectFile,
    updatePdfRange,
    clearAttachments,
    contextTokens,
    messages,
  } = useWorkspace();
  const { settings } = useSettings();

  const pct = Math.min(100, (contextTokens / CONTEXT_BUDGET) * 100);
  const tone = pct > 85 ? "rose" : pct > 60 ? "amber" : "cyan";

  return (
    <div className="space-y-3">
      <GlassPanel className="p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-slate-100">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-300" /> Context budget
          </h3>
          <Badge tone={tone === "rose" ? "rose" : tone === "amber" ? "amber" : "cyan"}>
            {pct.toFixed(0)}%
          </Badge>
        </div>
        <Progress value={pct} tone={tone} />
        <div className="mt-2 flex items-baseline justify-between font-mono text-[10.5px] text-slate-400">
          <span className="text-cyan-200">{contextTokens.toLocaleString()} tok</span>
          <span>/ {CONTEXT_BUDGET.toLocaleString()} window</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-2.5 text-center">
          <Stat label="files" value={String(attachments.length)} />
          <Stat label="turns" value={String(messages.length)} />
          <Stat label="model" value={settings.model.replace(/^tj-/, "")} mono />
        </dl>
      </GlassPanel>

      <GlassPanel className="p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-slate-100">
            <Paperclip className="h-3.5 w-3.5 text-cyan-300" /> Attached context
          </h3>
          {attachments.length ? (
            <SpringButton size="xs" variant="ghost" onClick={clearAttachments} className="text-rose-300">
              <Trash2 className="h-3 w-3" /> Clear
            </SpringButton>
          ) : null}
        </div>

        {attachments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] leading-relaxed text-slate-500">
            Drop PDFs, CSVs, JSON, images or an entire project folder into the composer to build context.
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {attachments.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() => removeAttachment(attachment.id)}
                  onToggle={() => toggleAttachment(attachment.id)}
                  onToggleFile={(path) => toggleProjectFile(attachment.id, path)}
                  onPdfRange={(from, to) => updatePdfRange(attachment.id, from, to)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </GlassPanel>

      <GlassPanel className="p-3.5">
        <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-slate-100">
          <TriangleAlert className="h-3.5 w-3.5 text-amber-300" /> Workspace notes
        </h3>
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
          <li>· Everything is parsed in your browser — files never touch a server until you send.</li>
          <li>· Keys live in an AES-GCM vault in <code className="font-mono text-cyan-200">localStorage</code>.</li>
          <li>· Diagrams render client-side with Mermaid; export as SVG or PNG.</li>
          <li>· Voice uses the Web Speech API; audio is never recorded or stored.</li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={cn("truncate text-[11.5px] font-medium text-slate-200", mono && "font-mono text-[10px]")}>
        {value}
      </dd>
    </div>
  );
}

function AttachmentRow({
  attachment,
  onRemove,
  onToggle,
  onToggleFile,
  onPdfRange,
}: {
  attachment: ParsedAttachment;
  onRemove: () => void;
  onToggle: () => void;
  onToggleFile: (path: string) => void;
  onPdfRange: (from: number, to: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICON[attachment.kind];
  const files = attachment.meta.files ?? [];
  const enabledFiles = files.filter((f) => f.enabled);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        attachment.enabled
          ? "border-white/12 bg-white/[0.035]"
          : "border-white/[0.06] bg-white/[0.015] opacity-55",
      )}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 shrink-0 text-slate-500 transition hover:text-cyan-200"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-400/10">
          <Icon className="h-3.5 w-3.5 text-cyan-200" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-slate-100">{attachment.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
            <span className="uppercase tracking-wide text-cyan-300/70">{attachment.kind}</span>
            <span>{formatBytes(attachment.size)}</span>
            {attachment.meta.pages ? <span>{attachment.meta.pages}p</span> : null}
            {attachment.meta.rows !== undefined ? <span>{attachment.meta.rows} rows</span> : null}
            {attachment.meta.fileCount ? (
              <span>
                {enabledFiles.length}/{attachment.meta.fileCount} files
              </span>
            ) : null}
            <span className="font-mono">{(attachment.meta.tokenEstimate ?? 0).toLocaleString()} tok</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={onToggle}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide transition",
              attachment.enabled
                ? "bg-emerald-400/12 text-emerald-200 hover:bg-emerald-400/20"
                : "bg-white/5 text-slate-400 hover:bg-white/10",
            )}
          >
            {attachment.enabled ? "on" : "off"}
          </button>
          <button
            onClick={onRemove}
            className="rounded-md p-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
            aria-label="Remove attachment"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-2.5">
              <AttachmentDetail
                attachment={attachment}
                enabledFiles={enabledFiles}
                onToggleFile={onToggleFile}
                onPdfRange={onPdfRange}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}

function AttachmentDetail({
  attachment,
  enabledFiles,
  onToggleFile,
  onPdfRange,
}: {
  attachment: ParsedAttachment;
  enabledFiles: NonNullable<ParsedAttachment["meta"]["files"]>;
  onToggleFile: (path: string) => void;
  onPdfRange: (from: number, to: number) => void;
}) {
  if (attachment.kind === "folder") {
    return (
      <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
        {attachment.meta.projectSummary ? (
          <p className="mb-1.5 rounded-lg bg-cyan-400/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-cyan-100/80">
            {attachment.meta.projectSummary}
          </p>
        ) : null}
        {(attachment.meta.files ?? []).map((file) => (
          <label
            key={file.path}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] transition hover:bg-white/5",
              !file.text && "cursor-not-allowed opacity-40",
            )}
          >
            <input
              type="checkbox"
              checked={file.enabled}
              disabled={!file.text}
              onChange={() => onToggleFile(file.path)}
              className="h-3 w-3 accent-cyan-400"
            />
            <span className="truncate font-mono text-slate-300">{file.path}</span>
            <span className="ml-auto shrink-0 font-mono text-[9px] text-slate-600">
              {formatBytes(file.size)}
            </span>
          </label>
        ))}
        {enabledFiles.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-amber-300/80">No files selected</p>
        ) : null}
      </div>
    );
  }

  if (attachment.kind === "csv" || attachment.kind === "json") {
    const columns = attachment.meta.columns ?? [];
    const rows = attachment.meta.sampleRows ?? [];
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {columns.slice(0, 8).map((column) => (
            <span
              key={column}
              className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-slate-300"
            >
              {column}
              <span className="ml-1 text-cyan-300/70">{attachment.meta.columnTypes?.[column] ?? ""}</span>
            </span>
          ))}
          {columns.length > 8 ? <span className="text-[9.5px] text-slate-500">+{columns.length - 8}</span> : null}
        </div>
        <div className="max-h-44 overflow-auto rounded-lg border border-white/10">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-[#12161f]">
              <tr>
                {columns.slice(0, 6).map((column) => (
                  <th key={column} className="whitespace-nowrap px-1.5 py-1 text-left font-semibold text-cyan-100">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-white/[0.05] hover:bg-white/[0.03]">
                  {columns.slice(0, 6).map((column) => (
                    <td key={column} className="max-w-[110px] truncate px-1.5 py-0.5 font-mono text-slate-400">
                      {row[column] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (attachment.kind === "pdf") {
    const pageCount = attachment.meta.pageCount ?? attachment.meta.pages ?? 1;
    const range = attachment.meta.pageRange ?? { from: 1, to: pageCount };
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10.5px] text-slate-400">
          <span>Pages</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={range.from}
            onChange={(event) => onPdfRange(Number(event.target.value) || 1, range.to)}
            className="h-7 w-14 rounded-md border border-white/12 bg-black/40 px-1.5 font-mono text-[11px] text-slate-200 focus:border-cyan-300/50 focus:outline-none"
          />
          <span>→</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={range.to}
            onChange={(event) => onPdfRange(range.from, Number(event.target.value) || pageCount)}
            className="h-7 w-14 rounded-md border border-white/12 bg-black/40 px-1.5 font-mono text-[11px] text-slate-200 focus:border-cyan-300/50 focus:outline-none"
          />
          <span className="text-slate-500">of {pageCount}</span>
        </div>
        <p className="line-clamp-6 max-h-32 overflow-y-auto rounded-lg bg-black/30 p-2 font-mono text-[9.5px] leading-relaxed text-slate-500">
          {attachment.text.slice(0, 700)}
        </p>
      </div>
    );
  }

  if (attachment.kind === "image" && attachment.images?.[0]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={attachment.images[0]} alt={attachment.name} className="w-full rounded-lg border border-white/10" />;
  }

  return (
    <pre className="max-h-40 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[9.5px] leading-relaxed text-slate-500">
      {attachment.text.slice(0, 900)}
    </pre>
  );
}
