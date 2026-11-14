/**
 * Parses an assistant answer into a set of real files for ZIP export.
 * Understands:
 *   - `### path/to/file.ts` headings followed by fenced code blocks
 *   - `// path/to/file.ts` or `# path/to/file.py` first-line comments inside a block
 *   - `**path/to/file.ts**` bold filenames
 *   - ```` ```text ```` directory trees (ignored for files, kept as README)
 */
export type ScaffoldFile = { path: string; content: string; language: string };

const FILE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|scala|ex|dart|lua|sql|graphql|gql|vue|svelte|astro|html|css|scss|sass|less|md|mdx|json|yaml|yml|toml|env|prisma|tf|sh|txt|cfg|ini)$/i;

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", py: "python", rb: "ruby",
  go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c",
  cpp: "cpp", cs: "csharp", php: "php", sql: "sql", graphql: "graphql", html: "html",
  css: "css", scss: "scss", md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
  toml: "toml", sh: "bash", tf: "hcl", vue: "vue", svelte: "svelte",
};

const SKIP_LANGS = new Set(["mermaid", "answer", "diff", "log"]);

function isSafePath(path: string): boolean {
  if (!path || path.length > 200) return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  if (!FILE_EXT.test(path)) return false;
  if (/\s{2,}|<|>|\||\*|\?/.test(path)) return false;
  return true;
}

function normalisePath(raw: string): string | null {
  const cleaned = raw
    .replace(/^\.\//, "")
    .replace(/[`'"]/g, "")
    .replace(/^[-*\s]+/, "")
    .trim();
  if (/^(dockerfile|makefile|procfile|gemfile)$/i.test(cleaned)) return cleaned;
  return isSafePath(cleaned) ? cleaned : null;
}

function languageFor(path: string, declared?: string): string {
  if (declared && declared !== "text") return declared;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXT[ext] ?? "text";
}

export function extractScaffold(markdown: string): ScaffoldFile[] {
  if (!markdown?.includes("```")) return [];
  const files = new Map<string, ScaffoldFile>();
  const lines = markdown.split("\n");
  let pendingPath: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 1. Track candidate filenames from surrounding prose.
    const heading = /^#{2,5}\s+(.+)$/.exec(line.trim());
    if (heading) {
      const candidate = normalisePath(heading[1]);
      if (candidate) pendingPath = candidate;
    }
    const bold = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
    if (bold) {
      const candidate = normalisePath(bold[1]);
      if (candidate) pendingPath = candidate;
    }
    const bullet = /^\s*(?:[-*]|\d+\.)\s+`([^`]+)`/.exec(line);
    if (bullet) {
      const candidate = normalisePath(bullet[1]);
      if (candidate) pendingPath = candidate;
    }

    // 2. Parse fenced blocks.
    const fence = /^\s*```([\w+-]*)\s*$/.exec(line);
    if (!fence) continue;
    const declared = (fence[1] || "text").toLowerCase();
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) {
      body.push(lines[j]);
      j += 1;
    }
    i = j;

    if (SKIP_LANGS.has(declared)) {
      pendingPath = null;
      continue;
    }

    if (declared === "text" && body.length && /[├└│]/.test(body.slice(0, 6).join(""))) {
      // Directory tree, not a file payload.
      pendingPath = null;
      continue;
    }

    const firstLine = body[0]?.trim() ?? "";
    const commentHint =
      /^(?:\/\/|#|--|;)\s*([\w./@-]+\.[a-zA-Z0-9]+)\s*$/.exec(firstLine) ??
      /^(?:\/\/|#)\s*(?:file|path|filename):\s*([\w./@-]+)\s*$/i.exec(firstLine);

    let path: string | null = null;
    let content = body.join("\n");

    if (commentHint) {
      path = normalisePath(commentHint[1]);
      if (path) content = body.slice(1).join("\n");
    }
    if (!path && pendingPath) path = pendingPath;

    if (!path || !content.trim()) {
      pendingPath = null;
      continue;
    }

    // Preserve the first occurrence, suffix duplicates deterministically.
    let finalPath = path;
    let counter = 2;
    while (files.has(finalPath)) {
      const dot = path.lastIndexOf(".");
      finalPath = dot === -1 ? `${path}-${counter}` : `${path.slice(0, dot)}-${counter}${path.slice(dot)}`;
      counter += 1;
    }

    files.set(finalPath, {
      path: finalPath,
      content: `${content.replace(/\s+$/, "")}\n`,
      language: languageFor(finalPath, declared),
    });
    pendingPath = null;
  }

  return Array.from(files.values());
}
