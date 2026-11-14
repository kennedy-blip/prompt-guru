import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-300/70">404 · SIGNAL LOST</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          This corridor of the lab is empty
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400">
          The route you followed doesn&apos;t exist. Return to the workspace and keep the research going.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-400 px-4 py-2 text-[13px] font-semibold text-obsidian"
        >
          Back to workspace
        </Link>
      </div>
    </div>
  );
}
