"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ConnectionStatus, StoredSettings } from "@/lib/types";
import {
  SETTINGS_STORAGE_KEY,
  clearVault,
  decryptSecret,
  encryptSecret,
  readEncryptedSecret,
  writeEncryptedSecret,
} from "@/lib/vault";
import { normaliseBaseUrl } from "@/lib/utils";

export const DEFAULT_SETTINGS: StoredSettings = {
  apiKey: "",
  baseUrl: "https://trans-jules-kmokaya864-5310.vercel.app/api/v1",
  model: "tj-qwen-dev",
  ttsEnabled: false,
  autoSendOnSilence: false,
  previewMode: false,
  temperature: 0.6,
};

export type ProbeResult = {
  ok: boolean;
  status: number;
  latencyMs?: number;
  model?: string;
  models?: string[];
  error?: string;
  source?: "user" | "server" | "none";
  baseUrl?: string;
  keyPresent?: boolean;
};

type SettingsContextValue = {
  settings: StoredSettings;
  ready: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  update: (patch: Partial<StoredSettings>) => void;
  saveKey: (key: string) => Promise<void>;
  clearKey: () => void;
  hasKey: boolean;
  status: ConnectionStatus;
  probe: ProbeResult | null;
  testConnection: () => Promise<ProbeResult>;
  credentialHeaders: () => Record<string, string>;
  serverHasKey: boolean | null;
  setServerHasKey: (value: boolean | null) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Hydrate: public settings from localStorage, API key from the AES-GCM vault.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<StoredSettings>) : {};
        const key = await decryptSecret(readEncryptedSecret());
        if (cancelled) return;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          apiKey: key,
          baseUrl: parsed.baseUrl || DEFAULT_SETTINGS.baseUrl,
        });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { hasKey?: boolean }) => {
        if (typeof data.hasKey === "boolean") setServerHasKey(data.hasKey);
      })
      .catch(() => setServerHasKey(null));

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist non-secret settings (the key never lives in plain localStorage).
  useEffect(() => {
    if (!ready) return;
    const { apiKey: _omit, ...safe } = settings;
    void _omit;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(safe));
    } catch {
      /* storage full or blocked */
    }
  }, [settings, ready]);

  const update = useCallback((patch: Partial<StoredSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      clearVault();
      setSettings((prev) => ({ ...prev, apiKey: "" }));
      setProbe(null);
      setStatus("idle");
      return;
    }
    const payload = await encryptSecret(trimmed);
    writeEncryptedSecret(payload);
    setSettings((prev) => ({ ...prev, apiKey: trimmed }));
  }, []);

  const clearKey = useCallback(() => {
    clearVault();
    setSettings((prev) => ({ ...prev, apiKey: "" }));
    setProbe(null);
    setStatus("idle");
  }, []);

  const credentialHeaders = useCallback(() => {
    const current = settingsRef.current;
    const headers: Record<string, string> = {};
    if (current.apiKey) headers["x-user-api-key"] = current.apiKey;
    if (current.baseUrl) headers["x-user-base-url"] = normaliseBaseUrl(current.baseUrl);
    if (current.model) headers["x-user-model"] = current.model;
    return headers;
  }, []);

  const testConnection = useCallback(async (): Promise<ProbeResult> => {
    setStatus("testing");
    try {
      const res = await fetch("/api/connection", {
        headers: credentialHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as ProbeResult;
      const result: ProbeResult = { ...data, ok: res.ok && data.ok, keyPresent: Boolean(settingsRef.current.apiKey) };
      setProbe(result);
      setStatus(result.ok ? "connected" : "error");
      return result;
    } catch (error) {
      const result: ProbeResult = {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "Network error",
      };
      setProbe(result);
      setStatus("error");
      return result;
    }
  }, [credentialHeaders]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      ready,
      open,
      setOpen,
      update,
      saveKey,
      clearKey,
      hasKey: Boolean(settings.apiKey) || serverHasKey === true,
      status,
      probe,
      testConnection,
      credentialHeaders,
      serverHasKey,
      setServerHasKey,
    }),
    [
      settings,
      ready,
      open,
      update,
      saveKey,
      clearKey,
      status,
      probe,
      testConnection,
      credentialHeaders,
      serverHasKey,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
