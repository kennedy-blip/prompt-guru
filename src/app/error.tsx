"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PromptGuru]", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="max-w-md">
        <TriangleAlert className="mx-auto h-8 w-8 text-amber-300" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">Something broke in the lab</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          {error.message || "An unexpected client error occurred."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-400 px-4 py-2 text-[13px] font-semibold text-obsidian"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.assign("/")}
            className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[13px] text-slate-200"
          >
            Reset session
          </button>
        </div>
      </div>
    </div>
  );
}
