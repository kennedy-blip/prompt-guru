export type Role = "system" | "user" | "assistant";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export type ChatErrorInfo = {
  message: string;
  description?: string;
  errorClass?: string;
  retryable?: boolean;
  status?: number;
  /** Sanitised raw engine text (never raw HTML). */
  detail?: string;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  /** Vision payloads attached to a user turn (data URLs). */
  images?: string[];
  /** Snapshot of attachment labels for display. */
  attachments?: string[];
  createdAt: number;
  /** Marks an assistant message as simulated by the offline preview engine. */
  simulated?: boolean;
  /** Model that produced an assistant turn. */
  model?: string;
  error?: boolean;
  /** Structured error so the UI can offer a retry instead of raw prose. */
  errorInfo?: ChatErrorInfo;
  /** True when the engine dropped mid-answer and we kept the partial text. */
  interrupted?: boolean;
};

export type AttachmentKind = "pdf" | "csv" | "json" | "code" | "image" | "text" | "folder";

export type ParsedAttachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  /** Extracted textual content that can be injected into the prompt. */
  text: string;
  /** Extra structured detail for the preview UI. */
  meta: AttachmentMeta;
  /** Images are kept as data URLs for vision payloads. */
  images?: string[];
  enabled: boolean;
};

export type AttachmentMeta = {
  pages?: number;
  pageCount?: number;
  pageRange?: { from: number; to: number };
  rows?: number;
  columns?: string[];
  columnTypes?: Record<string, string>;
  sampleRows?: Record<string, string>[];
  language?: string;
  truncated?: boolean;
  tokenEstimate?: number;
  files?: ProjectFile[];
  fileCount?: number;
  bytes?: number;
  projectSummary?: string;
};

export type ProjectFile = {
  path: string;
  name: string;
  size: number;
  ext: string;
  enabled: boolean;
  text?: string;
  binary?: boolean;
};

export type DiagramKind = "mermaid";

export type GeneratedImage = {
  id: string;
  prompt: string;
  enhancedPrompt?: string;
  url: string;
  aspect: AspectRatio;
  createdAt: number;
  source: "model" | "synthesis";
  model?: string;
};

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:2";

export type ModeId = "research" | "scaffold" | "diagram" | "math" | "data";

export type ConnectionStatus = "idle" | "testing" | "connected" | "error";

export type StoredSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  ttsEnabled: boolean;
  autoSendOnSilence: boolean;
  previewMode: boolean;
  temperature: number;
};

export type FollowUpSuggestion = {
  label: string;
  prompt: string;
  icon?: string;
};

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; model?: string; message?: string; interrupted?: boolean }
  | {
      type: "error";
      message: string;
      code?: string;
      /** Longer explanation shown under the message. */
      description?: string;
      /** Whether a retry is likely to succeed. */
      retryable?: boolean;
      /** Engine error taxonomy: auth | capacity | upstream_interrupt | … */
      errorClass?: string;
      /** Which attempt failed, when the server auto-retried. */
      attempt?: number;
      /** Sanitised raw engine text for the collapsible "details" panel. */
      detail?: string;
    }
  | { type: "retry"; attempt: number; waitMs: number; reason: string }
  | { type: "meta"; model?: string; simulated?: boolean };
