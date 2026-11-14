"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Check, Loader2 } from "lucide-react";
import type { ScaffoldFile } from "@/lib/scaffold";
import { cn } from "@/lib/utils";

export function ExportZipButton({
  files,
  children,
  className,
}: {
  files: ScaffoldFile[];
  children: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  const exportZip = async () => {
    if (state === "working") return;
    setState("working");
    try {
      const zip = new JSZip();
      const root = zip.folder("promptguru-scaffold") ?? zip;
      for (const file of files) root.file(file.path, file.content);
      root.file(
        "PROMPTGURU_EXPORT.md",
        [
          "# PromptGuru scaffold export",
          "",
          `Generated ${new Date().toISOString()}`,
          "",
          "## Files",
          ...files.map((f) => `- \`${f.path}\` (${f.content.split("\n").length} lines)`),
          "",
          "Review before running — AI-generated code should always be audited.",
        ].join("\n"),
      );
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `promptguru-scaffold-${Date.now().toString(36)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      onClick={() => void exportZip()}
      className={cn(
        "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-cyan-200",
        className,
      )}
    >
      {state === "working" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : state === "done" ? (
        <Check className="h-3 w-3 text-emerald-300" />
      ) : null}
      {state === "done" ? "ZIP downloaded" : children}
    </button>
  );
}
