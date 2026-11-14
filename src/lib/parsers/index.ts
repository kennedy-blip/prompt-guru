"use client";

import type { AttachmentKind, ParsedAttachment } from "@/lib/types";
import { estimateTokens, extOf, uid } from "@/lib/utils";
import { parsePdf } from "./pdf";
import { parseCsv, parseJson } from "./tabular";
import { detectLanguage, parseFolder } from "./project";

const MAX_TEXT_BYTES = 600_000;

export function classifyFile(file: File): AttachmentKind {
  const ext = extOf(file.name);
  if (ext === "pdf") return "pdf";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "json") return "json";
  if (file.type.startsWith("image/")) return "image";
  return "code";
}

export function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

async function parseImage(file: File): Promise<ParsedAttachment> {
  const dataUrl = await readAsDataUrl(file);
  return {
    id: uid("img"),
    name: file.name,
    kind: "image",
    size: file.size,
    text: `Image attachment: ${file.name} (${file.type || "image"}, ${Math.round(file.size / 1024)} KB). Analyse the visual content.`,
    enabled: true,
    images: [dataUrl],
    meta: { tokenEstimate: 85, bytes: file.size },
  };
}

async function parseTextFile(file: File): Promise<ParsedAttachment> {
  const raw = await file.text();
  const text = raw.length > MAX_TEXT_BYTES ? `${raw.slice(0, MAX_TEXT_BYTES)}\n… (truncated)` : raw;
  const language = detectLanguage(file.name);
  const wrapped = `File: ${file.name} (${language})\n\n\`\`\`${language}\n${text}\n\`\`\``;
  return {
    id: uid("file"),
    name: file.name,
    kind: "code",
    size: file.size,
    text: wrapped,
    enabled: true,
    meta: {
      language,
      truncated: raw.length > MAX_TEXT_BYTES,
      tokenEstimate: estimateTokens(wrapped),
      bytes: file.size,
    },
  };
}

export type IngestResult = {
  attachments: ParsedAttachment[];
  errors: { name: string; message: string }[];
};

/** Unified ingestion entry point for drag-and-drop and file pickers. */
export async function ingestFiles(files: File[]): Promise<IngestResult> {
  const attachments: ParsedAttachment[] = [];
  const errors: { name: string; message: string }[] = [];

  for (const file of files) {
    try {
      const kind = classifyFile(file);
      if (kind === "pdf") attachments.push(await parsePdf(file));
      else if (kind === "csv") attachments.push(await parseCsv(file));
      else if (kind === "json") attachments.push(await parseJson(file));
      else if (kind === "image") attachments.push(await parseImage(file));
      else attachments.push(await parseTextFile(file));
    } catch (error) {
      errors.push({
        name: file.name,
        message: error instanceof Error ? error.message : "Unsupported or corrupt file",
      });
    }
  }

  return { attachments, errors };
}

export async function ingestFolder(fileList: FileList): Promise<ParsedAttachment> {
  return parseFolder(fileList);
}

export { parseFolder };

/** Recursively expands dropped directories (DataTransferItem.webkitGetAsEntry). */
export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<{
  files: File[];
  folderEntries: File[];
}> {
  const items = Array.from(dataTransfer.items ?? []);
  const rootEntries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (!rootEntries.length) {
    return { files: Array.from(dataTransfer.files ?? []), folderEntries: [] };
  }

  const files: File[] = [];
  const folderFiles: File[] = [];
  let sawDirectory = false;

  const readEntry = async (entry: FileSystemEntry, path: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      Object.defineProperty(file, "webkitRelativePath", {
        value: path ? `${path}/${file.name}` : file.name,
      });
      files.push(file);
      return;
    }
    if (entry.isDirectory) {
      sawDirectory = true;
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children = await readAllEntries(reader);
      for (const child of children) {
        await readEntry(child, path ? `${path}/${entry.name}` : entry.name);
      }
    }
  };

  for (const entry of rootEntries) {
    await readEntry(entry, "");
  }

  if (sawDirectory) folderFiles.push(...files);

  return { files: sawDirectory ? [] : files, folderEntries: folderFiles };
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (!entries.length) {
          resolve(all);
          return;
        }
        all.push(...entries);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

export function attachmentToContext(attachment: ParsedAttachment): string {
  if (!attachment.enabled) return "";
  if (attachment.kind === "folder" && attachment.meta.files) {
    const enabledFiles = attachment.meta.files.filter((f) => f.enabled);
    return attachment.text;
  }
  return attachment.text;
}

export function totalTokens(attachments: ParsedAttachment[]): number {
  return attachments
    .filter((a) => a.enabled)
    .reduce((sum, a) => sum + (a.meta.tokenEstimate ?? estimateTokens(a.text)), 0);
}

export function collectImages(attachments: ParsedAttachment[]): string[] {
  return attachments.filter((a) => a.enabled && a.images?.length).flatMap((a) => a.images ?? []);
}
