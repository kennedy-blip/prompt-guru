"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Blocks,
  Clock3,
  History,
  MessageSquare,
  Network,
  Search,
  Sigma,
  Telescope,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import {
  clearSessions,
  deleteSession,
  groupSessions,
  listSessions,
  type SessionRecord,
} from "@/lib/history";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Badge } from "@/components/ui/badge";
import { SpringButton } from "@/components/ui/spring-button";
import { cn, relativeTime } from "@/lib/utils";
import type { ModeId } from "@/lib/types";

const MODE_ICON: Record<ModeId, React.ElementType> = {
  research: Telescope,
  scaffold: Blocks,
  diagram: Network,
  math: Sigma,
  data: BarChart3,
};

const MODE_LABEL: Record<ModeId, string> = {
  research: "Research",
  scaffold: "Scaffold",
  diagram: "Diagram",
  math: "Math",
  data: "Data",
};

export function SessionList({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { loadSession, sessionId } = useWorkspace();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => setSessions(listSessions()), []);

  useEffect(() => {
    refresh();
    // Pick up changes written by other tabs / pages.
    const onStorage = (event: StorageEvent) => {
      if (event.key === "promptguru.sessions.v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    const timer = setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(timer);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const needle = query.toLowerCase();
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(needle) ||
        session.messages.some((m) => m.content.toLowerCase().includes(needle)),
    );
  }, [sessions, query]);

  const groups = useMemo(() => groupSessions(filtered), [filtered]);

  const open = (session: SessionRecord) => {
    loadSession(session);
    router.push("/");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        {!compact ? (
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500">
              <History className="h-4 w-4 text-obsidian" />
            </span>
            Recent chats
          </h1>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
            <History className="h-3 w-3" /> Recent
          </p>
        )}
        <Badge tone="cyan">{sessions.length}</Badge>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            className="h-7 w-36 rounded-lg border border-white/12 bg-black/35 pl-7 pr-2 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none sm:w-44"
          />
        </div>
        {sessions.length ? (
          <button
            onClick={() => {
              if (confirmClear) {
                clearSessions();
                setConfirmClear(false);
                refresh();
              } else {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 3200);
              }
            }}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10px] transition",
              confirmClear
                ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-rose-200",
            )}
          >
            {confirmClear ? "Confirm clear all" : "Clear all"}
          </button>
        ) : null}
      </div>

      {!compact ? (
        <p className="px-1 text-[11px] leading-relaxed text-slate-500">
          Conversations are stored locally in this browser. Open one to continue where you left off — the
          full message thread and mode are restored.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <GlassPanel className="p-6 text-center">
          <MessageSquare className="mx-auto h-7 w-7 text-slate-600" />
          <p className="mt-2 text-[12px] text-slate-400">
            {sessions.length ? "No chats match that search." : "No saved conversations yet."}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-[10.5px] leading-relaxed text-slate-600">
            Every message you send is saved here automatically — you can come back and continue any thread.
          </p>
          {!compact ? (
            <SpringButton
              size="sm"
              variant="soft"
              className="mt-3"
              onClick={() => router.push("/")}
            >
              Start a conversation <ArrowRight className="h-3 w-3" />
            </SpringButton>
          ) : null}
        </GlassPanel>
      ) : (
        <div className={cn("space-y-3", compact && "space-y-2")}>
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {group.items.map((session) => {
                    const Icon = MODE_ICON[session.mode] ?? MessageSquare;
                    const active = session.id === sessionId;
                    return (
                      <motion.li
                        key={session.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      >
                        <div
                          className={cn(
                            "group flex items-start gap-2 rounded-xl border p-2.5 transition-colors",
                            active
                              ? "border-cyan-300/40 bg-cyan-400/[0.08]"
                              : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-300/25 hover:bg-white/[0.05]",
                          )}
                        >
                          <button
                            onClick={() => open(session)}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          >
                            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-cyan-300/15 bg-cyan-400/10">
                              <Icon className="h-3 w-3 text-cyan-200" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-medium text-slate-100">
                                {session.title}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-slate-500">
                                <span className="uppercase tracking-wide text-cyan-300/70">
                                  {MODE_LABEL[session.mode]}
                                </span>
                                <span>{session.turnCount} turn{session.turnCount === 1 ? "" : "s"}</span>
                                <span className="flex items-center gap-0.5">
                                  <Clock3 className="h-2.5 w-2.5" />
                                  {relativeTime(session.updatedAt)}
                                </span>
                                {session.model ? (
                                  <span className="font-mono text-[9px] text-slate-600">{session.model}</span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={() => open(session)}
                              className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-cyan-400/10 hover:text-cyan-200"
                              aria-label="Continue conversation"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                deleteSession(session.id);
                                refresh();
                              }}
                              className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
                              aria-label="Delete conversation"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecentSessions() {
  return (
    <div className="mx-auto max-w-3xl">
      <SessionList />
    </div>
  );
}
