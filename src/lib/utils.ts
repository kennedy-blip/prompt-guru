import { clsx, type ClassValue } from "./clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Cheap, dependency-free token estimate (~4 chars per token, corrected for code). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const codeish = (text.match(/[{}()[\];=<>]|=>/g) || []).length;
  return Math.max(1, Math.round((chars / 4 + words * 0.35 + codeish * 0.5) / 1.15));
}

export function truncateMiddle(text: string, max = 60): string {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

export function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Normalises a base URL to always include the OpenAI-compatible `/v1` segment. */
export function normaliseBaseUrl(raw: string): string {
  const base = stripTrailingSlash(raw.trim());
  if (!base) return "";
  try {
    const url = new URL(base);
    if (/\/v\d+(\/)?$/.test(url.pathname)) return stripTrailingSlash(url.toString());
    return `${stripTrailingSlash(url.toString())}/v1`;
  } catch {
    return base;
  }
}

export function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Extracts the first fenced code block for a given language from markdown. */
export function extractFencedBlock(markdown: string, language?: string): string | null {
  const pattern = language
    ? new RegExp("```" + language + "\\s*\\n([\\s\\S]*?)```", "i")
    : /```[a-zA-Z0-9]*\s*\n([\s\S]*?)```/;
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
