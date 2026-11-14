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
import type {
  ChatErrorInfo,
  ChatMessage,
  FollowUpSuggestion,
  GeneratedImage,
  ModeId,
  ParsedAttachment,
  StreamEvent,
} from "@/lib/types";
import { collectImages, totalTokens } from "@/lib/parsers";
import { estimateTokens, uid } from "@/lib/utils";
import { useSettings } from "./settings-provider";
import { saveSession } from "@/lib/history";

type ChatStatus = "idle" | "streaming" | "error";

type StreamPayload = {
  prompt: string;
  mode: ModeId;
  attachments: ParsedAttachment[];
  extraImages?: string[];
  displayText?: string;
  attachedLabels?: string[];
};

type WorkspaceContextValue = {
  messages: ChatMessage[];
  status: ChatStatus;
  mode: ModeId;
  setMode: (mode: ModeId) => void;
  attachments: ParsedAttachment[];
  addAttachments: (items: ParsedAttachment[]) => void;
  removeAttachment: (id: string) => void;
  toggleAttachment: (id: string) => void;
  toggleProjectFile: (attachmentId: string, path: string) => void;
  updatePdfRange: (attachmentId: string, from: number, to: number) => void;
  clearAttachments: () => void;
  contextTokens: number;
  sendMessage: (payload: StreamPayload & { clearAttachmentsOnSend?: boolean }) => Promise<void>;
  loadSession: (session: { id: string; mode: ModeId; messages: ChatMessage[]; title: string; model?: string }) => void;
  stopStreaming: () => void;
  regenerate: () => Promise<void>;
  reset: () => void;
  starters: FollowUpSuggestion[];
  startersLoading: boolean;
  followUps: FollowUpSuggestion[];
  followUpsLoading: boolean;
  refreshFollowUps: () => Promise<void>;
  refreshStarters: () => Promise<void>;
  gallery: GeneratedImage[];
  addGalleryImage: (image: GeneratedImage) => void;
  removeGalleryImage: (id: string) => void;
  errorBanner: string | null;
  /** Full structured banner (message + description + retry affordance). */
  errorInfo: ChatErrorInfo | null;
  dismissError: () => void;
  retryLast: () => Promise<void>;
  /** Live "retrying (2/3) in 900ms" notice. */
  retryNotice: string | null;
  lastModel: string | null;
  simulated: boolean;
  /** Persisted conversation id (for the Recent tab). */
  sessionId: string | null;
  sessionTitle: string;
};

/** Defensive: strip any HTML/markup the engine might have leaked into a message. */
function clean(value?: string): string | undefined {
  if (!value) return undefined;
  if (!/<[a-z][\s\S]*>/i.test(value) && value.length < 300) return value;
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return "The engine returned an unreadable response.";
  return stripped.length > 220 ? `${stripped.slice(0, 219).trimEnd()}…` : stripped;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { settings, credentialHeaders } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [mode, setMode] = useState<ModeId>("research");
  const [attachments, setAttachments] = useState<ParsedAttachment[]>([]);
  const [starters, setStarters] = useState<FollowUpSuggestion[]>([]);
  const [startersLoading, setStartersLoading] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ChatErrorInfo | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const startersKeyRef = useRef<string>("");
  const sessionIdRef = useRef<string | null>(null);
  const lastPayloadRef = useRef<(StreamPayload & { clearAttachmentsOnSend?: boolean }) | null>(null);

  const contextTokens = useMemo(() => totalTokens(attachments), [attachments]);

  /* ------------------------------ suggestions ----------------------------- */

  const fetchSuggestions = useCallback(
    async (kind: "starter" | "followup", body: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...credentialHeaders() },
          body: JSON.stringify({ kind, mode, ...body }),
        });
        const data = (await res.json().catch(() => ({}))) as { items?: FollowUpSuggestion[] };
        return data.items ?? [];
      } catch {
        return [];
      }
    },
    [credentialHeaders, mode],
  );

  const refreshStarters = useCallback(async () => {
    if (messagesRef.current.length > 0) return;
    setStartersLoading(true);
    const contextBlob = attachments
      .filter((a) => a.enabled)
      .map((a) => `${a.name}: ${a.meta.projectSummary ?? a.meta.columns?.join(", ") ?? `${a.meta.pages ?? a.meta.rows ?? 0} units`}`)
      .join("\n")
      .slice(0, 3000);
    const items = await fetchSuggestions("starter", {
      attachments: attachments.map((a) => a.name),
      context: contextBlob,
    });
    setStarters(items);
    setStartersLoading(false);
  }, [attachments, fetchSuggestions]);

  // Proactively (re)generate starters when the empty state's context changes.
  useEffect(() => {
    if (messages.length > 0) return;
    const key = `${mode}|${attachments
      .map((a) => `${a.id}:${a.enabled}:${a.meta.files?.filter((f) => f.enabled).length ?? 0}`)
      .join(",")}`;
    if (startersKeyRef.current === key) return;
    startersKeyRef.current = key;
    const timer = setTimeout(() => {
      void refreshStarters();
    }, 420);
    return () => clearTimeout(timer);
  }, [mode, attachments, messages.length, refreshStarters]);

  /* ------------------------------- attachments ---------------------------- */

  const addAttachments = useCallback((items: ParsedAttachment[]) => {
    setAttachments((prev) => [...prev, ...items]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  const toggleProjectFile = useCallback((attachmentId: string, path: string) => {
    setAttachments((prev) =>
      prev.map((a) => {
        if (a.id !== attachmentId || !a.meta.files) return a;
        const files = a.meta.files.map((f) =>
          f.path === path ? { ...f, enabled: !f.enabled && Boolean(f.text) } : f,
        );
        const enabledFiles = files.filter((f) => f.enabled);
        const text = buildFolderContext(a, enabledFiles);
        return {
          ...a,
          meta: {
            ...a.meta,
            files,
            tokenEstimate: estimateTokens(text),
          },
          text,
        };
      }),
    );
  }, []);

  const updatePdfRange = useCallback((attachmentId: string, from: number, to: number) => {
    setAttachments((prev) =>
      prev.map((a) => {
        if (a.id !== attachmentId || a.kind !== "pdf") return a;
        const sections = a.text.split(/--- Page \d+ ---/).filter((s) => s.trim());
        const clipped = sections
          .slice(Math.max(0, from - 1), Math.max(from, to))
          .map((section, index) => `--- Page ${from + index} ---${section}`)
          .join("\n\n");
        return {
          ...a,
          meta: {
            ...a.meta,
            pageRange: { from, to },
            tokenEstimate: estimateTokens(clipped),
          },
        };
      }),
    );
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  /** Re-generate follow-ups for the latest completed exchange (user-invoked). */
  const refreshFollowUps = useCallback(async () => {
    const thread = messagesRef.current;
    const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant" && m.content.trim());
    if (!lastAssistant) return;
    const idx = thread.indexOf(lastAssistant);
    const question = [...thread.slice(0, idx)].reverse().find((m) => m.role === "user")?.content ?? "";
    setFollowUpsLoading(true);
    const items = await fetchSuggestions("followup", {
      question,
      answer: lastAssistant.content,
      attachments: attachments.map((a) => a.name),
    });
    setFollowUps(items);
    setFollowUpsLoading(false);
  }, [attachments, fetchSuggestions]);

  /* --------------------------------- chat --------------------------------- */

  const runStream = useCallback(
    async (payload: StreamPayload, history: ChatMessage[], clearAttachmentsAfter = false) => {
      const { prompt, mode: payloadMode, attachments: contextAttachments } = payload;
      setStatus("streaming");
      setErrorBanner(null);
      setErrorInfo(null);
      setRetryNotice(null);
      setFollowUps([]);
      setFollowUpsLoading(false);
      // Consume one-shot context ("analyse this once") unless the user pinned it.
      const shouldClear = clearAttachmentsAfter && contextAttachments.length > 0;
      if (shouldClear) setAttachments([]);

      const images = [...collectImages(contextAttachments), ...(payload.extraImages ?? [])];
      const enabledContext = contextAttachments.filter((a) => a.enabled && a.kind !== "image");

      const contextBlock = enabledContext.length
        ? enabledContext
            .map((a) => `### Attachment: ${a.name} (${a.kind})\n${a.text}`)
            .join("\n\n")
            .slice(0, 240_000)
        : undefined;

      const userMessage: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: prompt,
        images,
        attachments: payload.attachedLabels ?? contextAttachments.map((a) => a.name),
        createdAt: Date.now(),
      };

      // Vision payloads ride on the final user turn so the model sees them inline.
      const historyForApi: {
        role: "user" | "assistant" | "system";
        content: string;
        images?: string[];
      }[] = [
        ...history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: prompt, images },
      ];

      const assistantId = uid("msg");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<ChatMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...credentialHeaders() },
          body: JSON.stringify({
            messages: historyForApi,
            mode: payloadMode,
            attachments: contextAttachments.map((a) => a.name),
            images,
            systemExtra: contextBlock,
            temperature: settings.temperature,
            demo: settings.previewMode || undefined,
          }),
          signal: controller.signal,
        });

        if (response.status === 401) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          const info: ChatErrorInfo = {
            message: "No TransJules API key configured.",
            description:
              data.error ?? "Open Settings → Connection Vault and add your key to go live.",
            errorClass: "auth",
            retryable: false,
            status: 401,
          };
          setErrorInfo(info);
          setErrorBanner(info.message);
          setStatus("error");
          return;
        }

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          const info: ChatErrorInfo = {
            message: clean(data.error) || "The engine returned an error.",
            errorClass: "unknown",
            retryable: response.status >= 500,
            status: response.status,
          };
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: info.message, error: true, errorInfo: info } : m)),
          );
          setErrorInfo(info);
          setErrorBanner(info.message);
          setStatus("error");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let model: string | undefined;
        let failed = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(raw) as StreamEvent;
            } catch {
              continue;
            }

            if (event.type === "delta") {
              accumulated += event.text;
              patchAssistant({ content: accumulated });
            } else if (event.type === "meta") {
              model = event.model;
              if (event.simulated) setSimulated(true);
              if (event.model) {
                setLastModel(event.model);
                patchAssistant({ model: event.model });
              }
            } else if (event.type === "retry") {
              setRetryNotice(
                `Engine busy — retrying (attempt ${event.attempt} of 3) in ${Math.round(event.waitMs / 100) / 10}s…`,
              );
            } else if (event.type === "error") {
              const info: ChatErrorInfo = {
                message: clean(event.message) || "The engine returned an error.",
                description: clean(event.description),
                errorClass: event.errorClass ?? event.code,
                retryable: event.retryable ?? true,
                detail: clean(event.detail),
              };
              if (event.code === "fallback") {
                setSimulated(true);
                setErrorInfo(info);
                setErrorBanner(info.message);
              } else if (accumulated.trim()) {
                // Interrupted mid-answer: keep the partial text and flag it.
                patchAssistant({ interrupted: true, errorInfo: info });
                setErrorInfo(info);
                setErrorBanner(info.message);
              } else {
                failed = true;
                patchAssistant({ content: info.message, error: true, errorInfo: info });
                setErrorInfo(info);
                setErrorBanner(info.message);
              }
              setRetryNotice(null);
            } else if (event.type === "done") {
              if (event.message === "offline-preview") setSimulated(true);
              if (event.interrupted) patchAssistant({ interrupted: true });
              setRetryNotice(null);
            }
          }
        }

        setStatus(failed ? "error" : "idle");
        setRetryNotice(null);
        if (model) setLastModel(model);

        // Proactive follow-ups after any completed answer (including partial ones).
        if (accumulated.trim()) {
          setFollowUpsLoading(true);
          const items = await fetchSuggestions("followup", {
            question: prompt,
            answer: accumulated,
            attachments: contextAttachments.map((a) => a.name),
          });
          setFollowUps(items);
          setFollowUpsLoading(false);
        } else {
          setFollowUpsLoading(false);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        const info: ChatErrorInfo = {
          message: "Network error.",
          description: "PromptGuru could not reach its own API route — check your connection and retry.",
          errorClass: "network",
          retryable: true,
        };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || info.message!, error: true, errorInfo: info }
              : m,
          ),
        );
        setErrorInfo(info);
        setErrorBanner(info.message);
        setStatus("error");
      } finally {
        abortRef.current = null;
        setRetryNotice(null);
      }
    },
    [credentialHeaders, fetchSuggestions, settings.previewMode, settings.temperature],
  );

  const sendMessage = useCallback(
    async (
      payload: StreamPayload & { clearAttachmentsOnSend?: boolean },
    ) => {
      if (status === "streaming") return;
      lastPayloadRef.current = payload;
      if (!sessionIdRef.current) {
        const id = uid("chat");
        sessionIdRef.current = id;
        setSessionId(id);
      }
      const history = messagesRef.current;
      const { clearAttachmentsOnSend = true, ...rest } = payload;
      await runStream(rest, history, clearAttachmentsOnSend);
    },
    [runStream, status],
  );

  /** One-click retry of the exact previous request (after a capacity/stream error). */
  const retryLast = useCallback(async () => {
    const payload = lastPayloadRef.current;
    if (!payload || status === "streaming") return;
    // Drop the trailing failed exchange before replaying so we don't duplicate it.
    const history = messagesRef.current;
    const lastUserIdx = [...history].reverse().findIndex((m) => m.role === "user");
    const trimmed = lastUserIdx === -1 ? history : history.slice(0, history.length - 1 - lastUserIdx);
    if (trimmed !== history) setMessages(trimmed);
    setErrorBanner(null);
    setErrorInfo(null);
    const { clearAttachmentsOnSend: _ignored, ...rest } = payload;
    void _ignored;
    await runStream(rest, trimmed, false);
  }, [runStream, status]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  const regenerate = useCallback(async () => {
    const history = messagesRef.current;
    const lastUserIndex = [...history].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;
    const index = history.length - 1 - lastUserIndex;
    const lastUser = history[index];
    const trimmed = history.slice(0, index);
    setMessages(trimmed);
    await runStream(
      {
        prompt: lastUser.content,
        mode,
        attachments: attachments.filter((a) => a.enabled),
        extraImages: lastUser.images,
        attachedLabels: lastUser.attachments,
      },
      trimmed,
    );
  }, [attachments, mode, runStream]);

  /** Restore a stored conversation so the user can continue it. */
  const loadSession = useCallback(
    (session: { id: string; mode: ModeId; messages: ChatMessage[]; title: string; model?: string }) => {
      abortRef.current?.abort();
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setSessionTitle(session.title);
      setMode(session.mode);
      setMessages(session.messages);
      setAttachments([]);
      setFollowUps([]);
      setFollowUpsLoading(false);
      setStatus("idle");
      setErrorBanner(null);
      setErrorInfo(null);
      setRetryNotice(null);
      setSimulated(false);
      if (session.model) setLastModel(session.model);
      startersKeyRef.current = "loaded";
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setFollowUps([]);
    setStatus("idle");
    setErrorBanner(null);
    setErrorInfo(null);
    setRetryNotice(null);
    setSimulated(false);
    setSessionId(null);
    setSessionTitle("");
    sessionIdRef.current = null;
    lastPayloadRef.current = null;
    startersKeyRef.current = "";
  }, []);

  /* -------------------------------- autosave ------------------------------ */

  // Persist the thread whenever it settles (never mid-stream).
  useEffect(() => {
    if (status === "streaming") return;
    if (!messages.length) return;
    if (!sessionId) return;
    const settled = messages.filter((m) => m.role === "user" || m.content.trim());
    if (!settled.length) return;
    const record = saveSession({
      id: sessionId,
      mode,
      messages: settled,
      model: lastModel ?? undefined,
    });
    if (record) setSessionTitle(record.title);
  }, [messages, status, sessionId, mode, lastModel]);

  /* -------------------------------- gallery ------------------------------- */

  const addGalleryImage = useCallback((image: GeneratedImage) => {
    setGallery((prev) => [image, ...prev].slice(0, 24));
  }, []);

  const removeGalleryImage = useCallback((id: string) => {
    setGallery((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      messages,
      status,
      mode,
      setMode,
      attachments,
      addAttachments,
      removeAttachment,
      toggleAttachment,
      toggleProjectFile,
      updatePdfRange,
      clearAttachments,
      contextTokens,
      sendMessage,
      loadSession,
      stopStreaming,
      regenerate,
      reset,
      starters,
      startersLoading,
      followUps,
      followUpsLoading,
      refreshFollowUps,
      refreshStarters,
      gallery,
      addGalleryImage,
      removeGalleryImage,
      errorBanner,
      errorInfo,
      dismissError: () => {
        setErrorBanner(null);
        setErrorInfo(null);
      },
      retryLast,
      retryNotice,
      lastModel,
      simulated,
      sessionId,
      sessionTitle,
    }),
    [
      messages,
      status,
      mode,
      attachments,
      addAttachments,
      removeAttachment,
      toggleAttachment,
      toggleProjectFile,
      updatePdfRange,
      clearAttachments,
      contextTokens,
      sendMessage,
      loadSession,
      stopStreaming,
      regenerate,
      reset,
      starters,
      startersLoading,
      followUps,
      followUpsLoading,
      refreshFollowUps,
      refreshStarters,
      gallery,
      addGalleryImage,
      removeGalleryImage,
      errorBanner,
      errorInfo,
      retryLast,
      retryNotice,
      lastModel,
      simulated,
      sessionId,
      sessionTitle,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

function buildFolderContext(
  attachment: ParsedAttachment,
  enabledFiles: NonNullable<ParsedAttachment["meta"]["files"]>,
): string {
  if (!enabledFiles.length) return `Project folder: ${attachment.name}\nNo files selected.`;
  const header = `Project folder: ${attachment.name}\nFiles included: ${enabledFiles.length}\n`;
  const body = enabledFiles
    .filter((f) => f.text)
    .map((f) => `\n--- file: ${f.path} ---\n\`\`\`\n${f.text}\n\`\`\``)
    .join("\n");
  return header + body;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
