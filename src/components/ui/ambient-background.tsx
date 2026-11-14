"use client";

/** Ambient drifting shader blobs + grid veil behind the whole workspace. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-veil opacity-60" />
      <div className="animate-drift absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-cyan-500/12 blur-[120px]" />
      <div
        className="animate-drift absolute -right-32 top-[18%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/14 blur-[130px]"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="animate-drift absolute bottom-[-12%] left-1/3 h-[30rem] w-[30rem] rounded-full bg-violet-500/10 blur-[140px]"
        style={{ animationDelay: "-14s" }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
    </div>
  );
}
