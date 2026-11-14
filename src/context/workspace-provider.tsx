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
  sendMessage: (payload: StreamPayload) => Promise<void>;
  stopStreaming: () => void;
  regenerate: () => Promise<void>;
  reset: () => void;
  starters: FollowUpSuggestion[];
  startersLoading: boolean;
  followUps: FollowUpSuggestion[];
  followUpsLoading: boolean;
  refreshStarters: () => Promise<void>;
  gallery: GeneratedImage[];
  addGalleryImage: (image: GeneratedImage) => void;
  removeGalleryImage: (id: string) => void;
  errorBanner: string | null;
  dismissError: () => void;
  lastModel: string | null;
  simulated: boolean;
};

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
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const startersKeyRef = useRef<string>("");

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
        if (!res.ok) return [];
        const data = (await res.json()) as { items?: FollowUpSuggestion[] };
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

  /* --------------------------------- chat --------------------------------- */

  const runStream = useCallback(
    async (payload: StreamPayload, history: ChatMessage[]) => {
      const { prompt, mode: payloadMode, attachments: contextAttachments } = payload;
      setStatus("streaming");
      setErrorBanner(null);
      setFollowUps([]);

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
        ...history
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content })),
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
          setErrorBanner(
            data.error ??
              "No API key configured. Open Settings → Connection Vault and add your TransJules key.",
          );
          setStatus("error");
          return;
        }

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: data.error ?? "The engine returned an error.", error: true }
                : m,
            ),
          );
          setStatus("error");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let model: string | undefined;

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
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
              );
            } else if (event.type === "meta") {
              model = event.model;
              if (event.simulated) setSimulated(true);
              if (event.model) {
                setLastModel(event.model);
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, model: event.model } : m)),
                );
              }
            } else if (event.type === "error") {
              if (event.code === "fallback") {
                setErrorBanner(event.message);
                setSimulated(true);
              } else {
                setErrorBanner(event.message);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId && !accumulated
                      ? { ...m, content: event.message, error: true }
                      : m,
                  ),
                );
              }
            } else if (event.type === "done") {
              if (event.message === "offline-preview") setSimulated(true);
            }
          }
        }

        setStatus("idle");
        if (model) setLastModel(model);

        // Generate proactive follow-ups after every completed answer.
        if (accumulated.trim()) {
          setFollowUpsLoading(true);
          const items = await fetchSuggestions("followup", {
            question: prompt,
            answer: accumulated,
            attachments: contextAttachments.map((a) => a.name),
          });
          setFollowUps(items);
          setFollowUpsLoading(false);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content || "Network error — the workspace could not reach the API route.",
                  error: true,
                }
              : m,
          ),
        );
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [credentialHeaders, fetchSuggestions, settings.previewMode, settings.temperature],
  );

  const sendMessage = useCallback(
    async (payload: StreamPayload) => {
      if (status === "streaming") return;
      const history = messagesRef.current;
      await runStream(payload, history);
    },
    [runStream, status],
  );

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

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setFollowUps([]);
    setStatus("idle");
    setErrorBanner(null);
    setSimulated(false);
    startersKeyRef.current = "";
  }, []);

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
      stopStreaming,
      regenerate,
      reset,
      starters,
      startersLoading,
      followUps,
      followUpsLoading,
      refreshStarters,
      gallery,
      addGalleryImage,
      removeGalleryImage,
      errorBanner,
      dismissError: () => setErrorBanner(null),
      lastModel,
      simulated,
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
      stopStreaming,
      regenerate,
      reset,
      starters,
      startersLoading,
      followUps,
      followUpsLoading,
      refreshStarters,
      gallery,
      addGalleryImage,
      removeGalleryImage,
      errorBanner,
      lastModel,
      simulated,
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
