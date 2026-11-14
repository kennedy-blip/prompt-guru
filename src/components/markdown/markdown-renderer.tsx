"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("md-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          () => (tree: unknown) => {
            // no-op passthrough keeps hook order stable if we add transforms later
            void tree;
          },
        ]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-([\w-]+)/.exec(codeClassName ?? "");
            const raw = String(children ?? "");
            const isBlock = raw.includes("\n") || Boolean(match);
            if (!isBlock) {
              return (
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock code={raw.replace(/\n$/, "")} language={match?.[1] ?? "text"} />;
          },
          pre({ children }) {
            return <>{children}</>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-white/10">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
