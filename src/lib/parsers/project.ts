"use client";

import type { ParsedAttachment, ProjectFile } from "@/lib/types";
import { estimateTokens, extOf, uid } from "@/lib/utils";

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode",
  ".DS_Store",
  "target",
  "vendor",
  "Pods",
  ".svelte-kit",
  ".parcel-cache",
  ".mypy_cache",
  ".pytest_cache",
]);

const CODE_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "kts", "swift",
  "c", "h", "cpp", "hpp", "cc", "cs", "php", "scala", "ex", "exs", "dart", "lua", "r", "jl",
  "sh", "bash", "zsh", "ps1", "sql", "graphql", "gql", "vue", "svelte", "astro", "html", "css",
  "scss", "sass", "less", "md", "mdx", "yml", "yaml", "toml", "json", "env", "prisma", "tf", "dockerfile",
]);

const BINARY_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "svg", "pdf", "zip", "gz", "tar", "tgz", "rar",
  "7z", "mp3", "mp4", "mov", "wav", "ogg", "webm", "woff", "woff2", "ttf", "otf", "eot", "so", "dylib",
  "dll", "exe", "bin", "class", "jar", "pyc", "sqlite", "db", "lockb", "wasm",
]);

const MAX_FILES = 400;
const MAX_FILE_BYTES = 400_000;
const MAX_TOTAL_CHARS = 900_000;

export const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", php: "php", scala: "scala",
  sh: "bash", bash: "bash", zsh: "bash", sql: "sql", graphql: "graphql", gql: "graphql",
  vue: "vue", svelte: "svelte", html: "html", css: "css", scss: "scss", less: "less",
  md: "markdown", mdx: "mdx", yml: "yaml", yaml: "yaml", toml: "toml", json: "json",
  prisma: "prisma", tf: "hcl", dockerfile: "dockerfile",
};

function isIgnoredPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((part) => IGNORED_DIRS.has(part))) return true;
  if (path.includes(".min.")) return true;
  if (path.endsWith(".map")) return true;
  return false;
}

function isCodeish(ext: string, name: string): boolean {
  if (CODE_EXTS.has(ext)) return true;
  if (/^(dockerfile|makefile|procfile|gemfile|rakefile)$/i.test(name)) return true;
  return false;
}

export function detectLanguage(name: string): string {
  const ext = extOf(name);
  if (LANGUAGE_BY_EXT[ext]) return LANGUAGE_BY_EXT[ext];
  if (/^dockerfile$/i.test(name)) return "dockerfile";
  return "text";
}

async function readFileText(file: File, budget: { chars: number }): Promise<string | undefined> {
  if (file.size > MAX_FILE_BYTES || budget.chars <= 0) return undefined;
  try {
    const text = await file.text();
    const clipped = text.slice(0, Math.min(text.length, 80_000, budget.chars));
    budget.chars -= clipped.length;
    return clipped;
  } catch {
    return undefined;
  }
}

/** Builds a folder-ingestion attachment from a webkitdirectory <input> selection. */
export async function parseFolder(fileList: FileList | File[]): Promise<ParsedAttachment> {
  const all = Array.from(fileList);
  const filtered = all
    .filter((file) => {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return !isIgnoredPath(path) && !BINARY_EXTS.has(extOf(file.name));
    })
    .filter((file) => {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return isCodeish(extOf(file.name), file.name) || path.split("/").length <= 3;
    })
    .sort((a, b) => {
      const pa = (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name;
      const pb = (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name;
      return pa.localeCompare(pb);
    })
    .slice(0, MAX_FILES);

  const rootName =
    ((filtered[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ?? "").split("/")[0] ||
    "project";

  const budget = { chars: MAX_TOTAL_CHARS };
  const files: ProjectFile[] = [];
  let bytes = 0;

  for (const file of filtered) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const ext = extOf(file.name);
    bytes += file.size;
    const text = await readFileText(file, budget);
    files.push({
      path: path.replace(`${rootName}/`, ""),
      name: file.name,
      size: file.size,
      ext,
      enabled: text !== undefined && text.length > 0,
      text,
      binary: text === undefined,
    });
  }

  const enabled = files.filter((f) => f.enabled);
  const summary = summariseProject(rootName, files);
  const text = buildProjectPrompt(rootName, enabled);

  return {
    id: uid("folder"),
    name: rootName,
    kind: "folder",
    size: bytes,
    text,
    enabled: true,
    meta: {
      files,
      fileCount: files.length,
      bytes,
      projectSummary: summary,
      tokenEstimate: estimateTokens(text),
      truncated: budget.chars <= 0,
    },
  };
}

const KEY_MANIFESTS = ["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "composer.json"];

export function summariseProject(rootName: string, files: ProjectFile[]): string {
  const extCounts = new Map<string, number>();
  for (const file of files) {
    if (!file.ext) continue;
    extCounts.set(file.ext, (extCounts.get(file.ext) ?? 0) + 1);
  }
  const top = Array.from(extCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `.${ext} ×${count}`)
    .join(", ");

  const stacks: string[] = [];
  const has = (pattern: RegExp) => files.some((f) => pattern.test(f.path));
  if (has(/(^|\/)package\.json$/) && has(/\.(tsx|jsx)$/)) stacks.push("React/Next");
  else if (has(/(^|\/)package\.json$/)) stacks.push("Node");
  if (has(/(^|\/)(requirements\.txt|pyproject\.toml|manage\.py)$/)) stacks.push("Python");
  if (has(/(^|\/)go\.mod$/)) stacks.push("Go");
  if (has(/(^|\/)Cargo\.toml$/)) stacks.push("Rust");
  if (has(/(^|\/)pom\.xml$|(^|\/)build\.gradle/)) stacks.push("JVM");
  if (has(/\.(tf)$/)) stacks.push("Terraform");
  if (has(/(^|\/)Dockerfile$/)) stacks.push("Docker");

  return `${rootName}: ${files.length} files, ${top || "no code files"}${stacks.length ? ` · detected ${stacks.join(" + ")}` : ""}`;
}

export function buildProjectPrompt(rootName: string, files: ProjectFile[]): string {
  const header = `Project folder: ${rootName}\nFiles included: ${files.length}\n\nFile tree:\n${renderTree(
    files.map((f) => f.path),
  )}\n`;
  const body = files
    .filter((f) => f.text)
    .map((f) => `\n--- file: ${f.path} ---\n\`\`\`${detectLanguage(f.name)}\n${f.text}\n\`\`\``)
    .join("\n");
  return header + body;
}

export function renderTree(paths: string[]): string {
  type Node = { children: Map<string, Node>; isFile: boolean };
  const root: Node = { children: new Map(), isFile: false };

  for (const path of [...paths].sort()) {
    const segments = path.split("/").filter(Boolean);
    let cursor = root;
    segments.forEach((segment, index) => {
      if (!cursor.children.has(segment)) {
        cursor.children.set(segment, { children: new Map(), isFile: false });
      }
      cursor = cursor.children.get(segment)!;
      if (index === segments.length - 1) cursor.isFile = true;
    });
  }

  const lines: string[] = [];
  const walk = (node: Node, prefix: string) => {
    const entries = Array.from(node.children.entries()).sort((a, b) => {
      const aDir = a[1].children.size > 0;
      const bDir = b[1].children.size > 0;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });
    entries.forEach(([name, child], index) => {
      const last = index === entries.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${name}${child.children.size ? "/" : ""}`);
      if (child.children.size) walk(child, `${prefix}${last ? "    " : "│   "}`);
    });
  };
  walk(root, "");
  return lines.join("\n");
}
