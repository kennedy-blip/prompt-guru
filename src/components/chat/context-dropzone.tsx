"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FolderUp, Loader2, UploadCloud } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { filesFromDataTransfer, ingestFiles, ingestFolder } from "@/lib/parsers";
import { cn } from "@/lib/utils";

/**
 * Unified drag-and-drop + picker surface for files and whole project folders.
 * Wraps the composer and overlays a drop veil while a drag is in progress.
 */
export function ContextDropzone({ children }: { children: React.ReactNode }) {
  const { addAttachments, setMode } = useWorkspace();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    async (files: File[], folders: File[] = []) => {
      setErrors([]);
      try {
        if (files.length) {
          setBusy(`Parsing ${files.length} file${files.length === 1 ? "" : "s"}…`);
          const result = await ingestFiles(files);
          if (result.attachments.length) {
            addAttachments(result.attachments);
            if (result.attachments.some((a) => a.kind === "csv" || a.kind === "json" || a.kind === "pdf")) {
              setMode("data");
            }
          }
          if (result.errors.length) setErrors(result.errors.map((e) => `${e.name}: ${e.message}`));
        }
        if (folders.length) {
          setBusy(`Reading project folder (${folders.length} files)…`);
          const attachment = await ingestFolder(folders as unknown as FileList);
          addAttachments([attachment]);
          setMode("scaffold");
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Ingestion failed"]);
      } finally {
        setBusy(null);
      }
    },
    [addAttachments, setMode],
  );

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const { files, folderEntries } = await filesFromDataTransfer(event.dataTransfer);
      await handleFiles(files, folderEntries);
    },
    [handleFiles],
  );

  const onFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await handleFiles(files);
  };

  const onFolderPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list?.length) return;
    const files = Array.from(list);
    event.target.value = "";
    await handleFiles([], files);
  };

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
      className="relative"
    >
      {children}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label>
          <input
            type="file"
            multiple
            hidden
            accept=".pdf,.csv,.tsv,.json,.txt,.md,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php,.sql,.yml,.yaml,image/*"
            onChange={onFilePick}
          />
          <motion.span
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-3 text-xs text-slate-200 transition hover:bg-white/[0.07] hover:border-cyan-300/40"
          >
            <UploadCloud className="h-3.5 w-3.5" /> Attach files
            <span className="hidden text-[10px] text-slate-500 sm:inline">PDF · CSV · JSON · code</span>
          </motion.span>
        </label>
        <label>
          <input
            type="file"
            hidden
            // @ts-expect-error — non-standard but widely supported directory picker attributes
            webkitdirectory="true"
            directory="true"
            onChange={onFolderPick}
          />
          <motion.span
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-3 text-xs text-slate-200 transition hover:bg-white/[0.07] hover:border-cyan-300/40"
          >
            <FolderUp className="h-3.5 w-3.5" /> Project folder
            <span className="hidden text-[10px] text-slate-500 sm:inline">ingests a whole repo</span>
          </motion.span>
        </label>
        {busy ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10.5px] text-cyan-100">
            <Loader2 className="h-3 w-3 animate-spin" /> {busy}
          </span>
        ) : null}
        {errors.length ? (
          <div className="flex flex-wrap gap-1">
            {errors.slice(0, 3).map((error) => (
              <span
                key={error}
                className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-100"
              >
                {error}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-[-12px] z-30 grid place-items-center rounded-3xl border-2 border-dashed border-cyan-300/50 bg-cyan-400/[0.07]"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <UploadCloud className="h-8 w-8 text-cyan-200" />
              </motion.div>
              <p className="text-sm font-medium text-cyan-50">Drop files or a project folder</p>
              <p className="text-[11px] text-cyan-200/70">
                node_modules, .git, dist and binaries are filtered automatically
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const dropzoneClass =
  "relative flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-xs text-slate-300 transition hover:bg-white/[0.07]";

export const dropzoneCn = cn;
