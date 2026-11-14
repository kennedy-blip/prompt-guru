"use client";

import { useCallback, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { filesFromDataTransfer, ingestFiles, ingestFolder } from "@/lib/parsers";

/**
 * Shared ingestion pipeline for the drag-and-drop dropzone and the composer's
 * attach buttons: parse files in-browser, auto-select a sensible mode, and
 * surface per-file errors.
 */
export function useAttachmentIngest() {
  const { addAttachments, setMode } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = useCallback(
    async (files: File[], folders: File[] = []) => {
      setErrors([]);
      try {
        if (files.length) {
          setBusy(`Parsing ${files.length} file${files.length === 1 ? "" : "s"}…`);
          const result = await ingestFiles(files);
          if (result.attachments.length) {
            addAttachments(result.attachments);
            if (result.attachments.some((a) => ["csv", "json", "pdf"].includes(a.kind))) {
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

  const ingestTransfer = useCallback(
    async (dataTransfer: DataTransfer) => {
      const { files, folderEntries } = await filesFromDataTransfer(dataTransfer);
      await handleFiles(files, folderEntries);
    },
    [handleFiles],
  );

  return { handleFiles, ingestTransfer, busy, errors, setErrors };
}
