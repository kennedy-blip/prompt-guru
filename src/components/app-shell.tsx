"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  Boxes,
  Camera,
  Command,
  GitBranch,
  History,
  Image as ImageIcon,
  Menu,
  PanelRightOpen,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/context/settings-provider";
import { useWorkspace } from "@/context/workspace-provider";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { SpringButton } from "@/components/ui/spring-button";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { ContextPanel } from "@/components/workspace/context-panel";
import { SessionList } from "@/components/history/recent-sessions";
import { GlassPanel } from "@/components/ui/glass-panel";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

const NAV = [
  { href: "/", label: "Workspace", icon: Sparkles },
  { href: "/studio", label: "Image Studio", icon: ImageIcon },
  { href: "/camera", label: "Vision", icon: Camera },
  { href: "/library", label: "Library", icon: BookOpenCheck },
  { href: "/recent", label: "Recent", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings, update, hasKey, status, open, setOpen, serverHasKey } = useSettings();
  const { messages, simulated, lastModel } = useWorkspace();
  const [mobileNav, setMobileNav] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const { speak } = useSpeechSynthesis();
  const [lastSpokenId, setLastSpokenId] = useState<string | null>(null);

  // Read the latest completed assistant answer aloud when TTS is enabled.
  useEffect(() => {
    if (!settings.ttsEnabled) return;
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.content && !m.error);
    if (!last || last.id === lastSpokenId) return;
    const isComplete = !last.content.endsWith("▍");
    if (!isComplete) return;
    setLastSpokenId(last.id);
    speak(last.content.replace(/```[\s\S]*?```/g, " code block ").slice(0, 2600));
  }, [messages, settings.ttsEnabled, lastSpokenId, speak]);

  const connectionTone = status === "connected" ? "emerald" : status === "error" ? "rose" : hasKey ? "cyan" : "amber";
  const connectionLabel =
    status === "connected"
      ? `Connected · ${lastModel ?? settings.model}`
      : status === "testing"
        ? "Testing connection…"
        : hasKey
          ? "Key ready · verify"
          : serverHasKey
            ? "Server key detected"
            : "No key configured";

  return (
    <>
      <AmbientBackground />
      <div className="flex min-h-screen flex-col">
        {/* ---------------- top bar ---------------- */}
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090a0f]/72 backdrop-blur-2xl">
          <div className="mx-auto flex h-14 w-full max-w-[1680px] items-center gap-3 px-3 sm:px-5">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <motion.span
                whileHover={{ rotate: 8, scale: 1.06 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-indigo-500 shadow-[0_0_22px_-6px_rgba(34,211,238,0.9)]"
              >
                <Zap className="h-4 w-4 text-obsidian" strokeWidth={2.6} />
                <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
              </motion.span>
              <span className="hidden flex-col leading-none sm:flex">
                <span className="text-[15px] font-semibold tracking-tight text-white">
                  Prompt<span className="text-gradient-cyan">Guru</span>
                </span>
                <span className="mt-0.5 text-[9px] font-medium tracking-[0.22em] text-slate-500">
                  TRANSJULES LAB
                </span>
              </span>
            </Link>

            <nav className="ml-2 hidden items-center gap-0.5 md:flex">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.span
                      whileTap={{ scale: 0.96 }}
                      className={cn(
                        "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                        active ? "text-white" : "text-slate-400 hover:text-slate-100",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg border border-cyan-300/20 bg-cyan-400/10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      ) : null}
                      <item.icon className="relative h-3.5 w-3.5" />
                      <span className="relative">{item.label}</span>
                    </motion.span>
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <Tooltip label={hasKey ? "Read answers aloud" : "Add a key to enable voice"}>
                <SpringButton
                  size="icon"
                  variant={settings.ttsEnabled ? "soft" : "ghost"}
                  onClick={() => update({ ttsEnabled: !settings.ttsEnabled })}
                  aria-label="Toggle text to speech"
                >
                  {settings.ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </SpringButton>
              </Tooltip>

              <button
                onClick={() => setOpen(true)}
                className={cn(
                  "group hidden items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-medium transition sm:flex",
                  status === "connected"
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                    : status === "error"
                      ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
                      : hasKey
                        ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
                        : "border-amber-300/25 bg-amber-400/[0.08] text-amber-100 hover:bg-amber-400/12",
                )}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
                      status === "connected" ? "bg-emerald-300" : hasKey ? "bg-cyan-300" : "bg-amber-300",
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex h-1.5 w-1.5 rounded-full",
                      status === "connected" ? "bg-emerald-300" : hasKey ? "bg-cyan-300" : "bg-amber-300",
                    )}
                  />
                </span>
                <span className="max-w-[190px] truncate">{connectionLabel}</span>
                <Badge tone={connectionTone as "emerald"} className="hidden lg:inline-flex">
                  {settings.model}
                </Badge>
              </button>

              <Tooltip label="Connection & context">
                <SpringButton
                  size="icon"
                  variant="outline"
                  onClick={() => setContextOpen(true)}
                  className="lg:hidden"
                  aria-label="Open context panel"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </SpringButton>
              </Tooltip>

              <Tooltip label="Settings & key vault">
                <SpringButton size="icon" variant="outline" onClick={() => setOpen(true)} aria-label="Open settings">
                  <Settings2 className="h-4 w-4" />
                </SpringButton>
              </Tooltip>

              <SpringButton
                size="icon"
                variant="ghost"
                className="md:hidden"
                onClick={() => setMobileNav((v) => !v)}
                aria-label="Toggle navigation"
              >
                {mobileNav ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </SpringButton>
            </div>
          </div>

          <AnimatePresence>
            {mobileNav ? (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-white/[0.06] md:hidden"
              >
                <div className="flex flex-col gap-1 p-3">
                  {NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNav(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                        pathname === item.href
                          ? "bg-cyan-400/10 text-cyan-100"
                          : "text-slate-300 hover:bg-white/5",
                      )}
                    >
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  ))}
                </div>
              </motion.nav>
            ) : null}
          </AnimatePresence>
        </header>

        {/* ---------------- body ---------------- */}
        <div className="mx-auto flex w-full max-w-[1680px] flex-1 gap-4 px-2 py-3 sm:px-4">
          <main className="min-w-0 flex-1">{children}</main>
          <aside className="hidden w-[330px] shrink-0 xl:block">
            <div className="sticky top-[4.5rem] max-h-[calc(100vh-5.5rem)] space-y-3 overflow-y-auto scrollbar-none">
              <ContextPanel />
              <GlassPanel className="p-3">
                <SessionList compact />
              </GlassPanel>
            </div>
          </aside>
        </div>

        {/* ---------------- footer status strip ---------------- */}
        <footer className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-[10.5px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Command className="h-3 w-3" /> Press{" "}
            <kbd className="rounded border border-white/12 bg-white/5 px-1 font-mono text-[9px]">⌘K</kbd> for the
            command palette
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" /> TransJules · OpenAI-compatible
          </span>
          <span className="flex items-center gap-1.5">
            <Boxes className="h-3 w-3" /> BYOK or server-held credentials
          </span>
          {simulated ? (
            <Badge tone="amber" className="ml-auto">
              offline preview engine active
            </Badge>
          ) : null}
        </footer>
      </div>

      <SettingsDrawer open={open} onClose={() => setOpen(false)} />

      <AnimatePresence>
        {contextOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm xl:hidden"
            onClick={() => setContextOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={(event) => event.stopPropagation()}
              className="absolute right-0 top-0 h-full w-[min(92vw,380px)] overflow-y-auto border-l border-white/10 bg-[#0a0d14] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80">CONTEXT</p>
                <SpringButton size="icon" variant="ghost" onClick={() => setContextOpen(false)}>
                  <X className="h-4 w-4" />
                </SpringButton>
              </div>
              <ContextPanel />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
