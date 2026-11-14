"use client";

import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useAttachmentIngest } from "@/hooks/use-attachment-ingest";

/**
 * Drag-and-drop surface for files and whole project folders.
 * Renders the attach buttons as a child slot so they can live inside the composer.
 */
export function ContextDropzone({ children }: { children: React.ReactNode }) {
  const { ingestTransfer } = useAttachmentIngest();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

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
      onDrop={async (event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        await ingestTransfer(event.dataTransfer);
      }}
      className="relative"
    >
      {children}

      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-[-10px] z-40 grid place-items-center rounded-3xl border-2 border-dashed border-cyan-300/55 bg-[#070910]/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className="flex flex-col items-center gap-1.5 px-6 text-center"
            >
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <UploadCloud className="h-9 w-9 text-cyan-200" />
              </motion.div>
              <p className="text-sm font-medium text-cyan-50">Drop files or a project folder</p>
              <p className="max-w-xs text-[11px] leading-relaxed text-cyan-200/70">
                PDF · CSV · JSON · code · images — or an entire repo. node_modules, .git, dist and
                binaries are filtered automatically.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Attach buttons + busy/error feedback, sized for the composer footer. */
export function AttachButtons() {
  const { handleFiles, busy, errors, setErrors } = useAttachmentIngest();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label>
        <input
          type="file"
          multiple
          hidden
          accept=".pdf,.csv,.tsv,.json,.txt,.md,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php,.sql,.yml,.yaml,image/*"
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            await handleFiles(files);
          }}
        />
        <motion.span
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
        >
          <UploadCloud className="h-3 w-3" /> Files
        </motion.span>
      </label>
      <label>
        <input
          type="file"
          hidden
          // @ts-expect-error — non-standard but widely supported directory picker attributes
          webkitdirectory="true"
          directory="true"
          onChange={async (event) => {
            const list = event.target.files;
            if (!list?.length) return;
            const files = Array.from(list);
            event.target.value = "";
            await handleFiles([], files);
          }}
        />
        <motion.span
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
        >
          <UploadCloud className="h-3 w-3 rotate-90" /> Folder
        </motion.span>
      </label>
      {busy ? (
        <span className="flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-100">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-cyan-300/40 border-t-cyan-200" />
          {busy}
        </span>
      ) : null}
      {errors.length ? (
        <button
          onClick={() => setErrors([])}
          title={errors.join("\n")}
          className="rounded-md border border-rose-300/25 bg-rose-400/10 px-1.5 py-0.5 text-[10px] text-rose-100"
        >
          {errors.length} file{errors.length === 1 ? "" : "s"} rejected
        </button>
      ) : null}
    </div>
  );
}
