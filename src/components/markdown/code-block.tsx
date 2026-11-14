"use client";

import { Highlight, themes } from "prism-react-renderer";
import { Check, Copy, FileCode2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "./mermaid-diagram";

const ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
  cs: "csharp",
  rs: "rust",
  go: "go",
  sql: "sql",
  json: "json",
  css: "css",
  html: "markup",
  vue: "markup",
  answer: "text",
  text: "text",
};

type CodeBlockProps = {
  code: string;
  language?: string;
  filename?: string;
};

export function CodeBlock({ code, language = "text", filename }: CodeBlockProps) {
  const rawLang = (language || "text").toLowerCase().replace(/^language-/, "");
  const lang = ALIASES[rawLang] ?? rawLang;
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const isAnswer = rawLang === "answer";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  if (rawLang === "mermaid") {
    return (
      <figure className="my-4 overflow-hidden rounded-2xl border border-cyan-300/12 bg-[#0a0d14]/70 p-2">
        <div className="mb-1.5 flex items-center justify-between px-1.5 pt-1">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-cyan-200/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
            LIVE DIAGRAM
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-cyan-200"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy source"}
          </button>
        </div>
        <MermaidDiagram code={code} />
      </figure>
    );
  }

  if (isAnswer) {
    return (
      <div className="my-4 overflow-hidden rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-400/12 via-emerald-400/[0.06] to-transparent p-0.5">
        <div className="rounded-[14px] bg-[#08110e]/80 px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> FINAL ANSWER
          </p>
          <p className="font-mono text-base font-semibold text-emerald-50">{code}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group/code my-3 overflow-hidden rounded-xl border border-white/10 bg-[#080a10]">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-slate-400">
          <FileCode2 className="h-3 w-3 text-cyan-300/70" />
          {filename || rawLang || "code"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWrap((w) => !w)}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] transition",
              wrap ? "bg-cyan-400/15 text-cyan-200" : "text-slate-500 hover:text-slate-200",
            )}
          >
            wrap
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-cyan-200"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <Highlight theme={themes.vsDark} code={code.replace(/\n$/, "")} language={lang as never}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              "scrollbar-none overflow-x-auto bg-transparent p-3.5 font-mono text-[12.5px] leading-[1.65]",
              wrap && "whitespace-pre-wrap break-words",
            )}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                <span className="table-cell select-none pr-3.5 text-right text-[10px] text-slate-600">
                  {i + 1}
                </span>
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
