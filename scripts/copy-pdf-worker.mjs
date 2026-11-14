// Copies the pdf.js worker into /public so the browser can load it as a static asset.
// Run automatically after `npm install` (postinstall).
import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dest = join(root, "public", "pdf.worker.min.mjs");

try {
  await access(source);
} catch {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found — skipping.");
  process.exit(0);
}

await mkdir(dirname(dest), { recursive: true });
await copyFile(source, dest);
console.log("[copy-pdf-worker] worker copied to public/pdf.worker.min.mjs");
