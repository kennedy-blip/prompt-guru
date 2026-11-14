"use client";

import type { ChatMessage, ModeId } from "@/lib/types";

const STORAGE_KEY = "promptguru.sessions.v1";
const MAX_SESSIONS = 60;
const MAX_STORED_MESSAGES = 200;

export type SessionRecord = {
  id: string;
  title: string;
  mode: ModeId;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model?: string;
  /** Small counters for the list UI. */
  turnCount: number;
};

function canStore(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readAll(): SessionRecord[] {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionRecord[];
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.id && Array.isArray(s.messages)) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SessionRecord[]): void {
  if (!canStore()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // Quota exceeded (large image data URLs) — drop oldest half and retry once.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, Math.ceil(MAX_SESSIONS / 2))));
    } catch {
      /* give up silently; history is a convenience, not critical path */
    }
  }
}

export function deriveTitle(messages: ChatMessage[], fallback = "Untitled session"): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return fallback;
  const text = firstUser.content.replace(/```[\s\S]*?```/g, " code ").replace(/\s+/g, " ").trim();
  return text.length > 72 ? `${text.slice(0, 71).trimEnd()}…` : text || fallback;
}

/** Strips heavy base64 vision payloads before persisting (kept in memory only). */
function truncateForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
    ...message,
    images: message.images?.filter((url) => url.length < 200_000).slice(0, 2),
  }));
}

export function saveSession(input: {
  id: string;
  mode: ModeId;
  messages: ChatMessage[];
  model?: string;
}): SessionRecord | null {
  if (!input.messages.length) return null;
  const sessions = readAll();
  const existing = sessions.find((session) => session.id === input.id);
  const record: SessionRecord = {
    id: input.id,
    title: deriveTitle(input.messages),
    mode: input.mode,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    messages: truncateForStorage(input.messages),
    model: input.model ?? existing?.model,
    turnCount: input.messages.filter((m) => m.role === "user").length,
  };
  const next = [record, ...sessions.filter((session) => session.id !== input.id)].slice(0, MAX_SESSIONS);
  writeAll(next);
  return record;
}

export function listSessions(): SessionRecord[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): SessionRecord | null {
  return readAll().find((session) => session.id === id) ?? null;
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter((session) => session.id !== id));
}

export function clearSessions(): void {
  if (!canStore()) return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Groups sessions into Today / Yesterday / Previous 7 days / Older. */
export function groupSessions(sessions: SessionRecord[]): { label: string; items: SessionRecord[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const weekAgo = startOfToday - 6 * 86_400_000;

  const buckets: Record<string, SessionRecord[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const session of sessions) {
    if (session.updatedAt >= startOfToday) buckets.Today.push(session);
    else if (session.updatedAt >= startOfYesterday) buckets.Yesterday.push(session);
    else if (session.updatedAt >= weekAgo) buckets["Previous 7 days"].push(session);
    else buckets.Older.push(session);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
