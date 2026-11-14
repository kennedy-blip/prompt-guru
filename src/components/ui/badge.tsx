import { cn } from "@/lib/utils";

type Tone = "cyan" | "indigo" | "violet" | "emerald" | "amber" | "rose" | "slate";

const TONES: Record<Tone, string> = {
  cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
  indigo: "border-indigo-300/25 bg-indigo-400/10 text-indigo-100",
  violet: "border-violet-300/25 bg-violet-400/10 text-violet-100",
  emerald: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  rose: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  slate: "border-white/12 bg-white/[0.05] text-slate-300",
};

export function Badge({
  children,
  tone = "slate",
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
