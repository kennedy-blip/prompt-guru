"use client";

import type { ParsedAttachment } from "@/lib/types";
import { estimateTokens, uid } from "@/lib/utils";

type PdfTextItem = { str: string; transform: number[] };

const MAX_CHARS = 180_000;

/** Extracts per-page text from a PDF entirely in the browser via pdf.js. */
export async function parsePdf(file: File): Promise<ParsedAttachment> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = doc.numPages;
  const pages: string[] = [];
  let total = 0;
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    if (total > MAX_CHARS) {
      truncated = true;
      break;
    }
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items as PdfTextItem[];
    let lastY: number | null = null;
    let text = "";
    for (const item of items) {
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 4) text += "\n";
      text += item.str;
      lastY = y;
    }
    pages.push(`--- Page ${pageNumber} ---\n${text.replace(/[ \t]+\n/g, "\n").trim()}`);
    total += text.length;
    page.cleanup();
  }
  await doc.destroy();

  const text = pages.join("\n\n");
  return {
    id: uid("pdf"),
    name: file.name,
    kind: "pdf",
    size: file.size,
    text,
    enabled: true,
    meta: {
      pages: pages.length,
      pageCount,
      pageRange: { from: 1, to: pages.length },
      truncated,
      tokenEstimate: estimateTokens(text),
      bytes: file.size,
    },
  };
}

export function slicePdfPages(attachment: ParsedAttachment, from: number, to: number): string {
  const sections = attachment.text.split(/--- Page \d+ ---/).filter((s) => s.trim());
  return sections
    .slice(Math.max(0, from - 1), Math.max(from, to))
    .map((section, index) => `--- Page ${from + index} ---${section}`)
    .join("\n\n");
}
