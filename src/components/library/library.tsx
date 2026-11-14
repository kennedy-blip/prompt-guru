"use client";

import { motion } from "framer-motion";
import {
  BookOpenCheck,
  Braces,
  Camera,
  Database,
  Network,
  Sigma,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/context/workspace-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Badge } from "@/components/ui/badge";
import { SpringButton } from "@/components/ui/spring-button";
import { cn } from "@/lib/utils";
import type { ModeId } from "@/lib/types";

type PromptTemplate = {
  id: string;
  title: string;
  mode: ModeId;
  category: string;
  body: string;
  tags: string[];
};

const TEMPLATES: PromptTemplate[] = [
  {
    id: "t1",
    title: "Framework decision brief",
    mode: "research",
    category: "Research",
    body: "Produce a decision brief comparing {{option_a}} vs {{option_b}} vs {{option_c}} for {{use_case}}. Include: TL;DR, trade-off matrix across maturity/perf/DX/ops cost/ecosystem, pros & cons, migration risks, and a recommendation with the conditions under which you'd reverse it.",
    tags: ["architecture", "trade-offs"],
  },
  {
    id: "t2",
    title: "Security audit of a codebase",
    mode: "data",
    category: "Security",
    body: "Audit the attached project for security vulnerabilities. Rank findings by exploitability and impact (CVSS-style), cite the exact file and line, show the vulnerable pattern, and give a patched version. Cover: authn/authz gaps, injection surfaces, secret handling, dependency risk, SSRF and prompt-injection paths.",
    tags: ["audit", "OWASP"],
  },
  {
    id: "t3",
    title: "Full-stack scaffold",
    mode: "scaffold",
    category: "Engineering",
    body: "Scaffold a production-grade {{stack}} application for {{product}}. Requirements: {{requirements}}. Produce a directory tree, every meaningful source file, typed error handling, tests, Docker, CI and a run guide. Enforce strict TypeScript.",
    tags: ["scaffold", "tests"],
  },
  {
    id: "t4",
    title: "System architecture diagram",
    mode: "diagram",
    category: "Visual",
    body: "Render the architecture of {{system}} as a Mermaid flowchart with clear subsystem boundaries, data stores, external dependencies and the request path. Then add a reading guide and design notes on scaling limits and single points of failure.",
    tags: ["mermaid", "architecture"],
  },
  {
    id: "t5",
    title: "Step-by-step calculus coach",
    mode: "math",
    category: "Education",
    body: "Transcribe this problem in LaTeX, then solve it step by step. For each step name the theorem or rule applied, show the algebra, and justify in one line. Finish with a verification and a fenced `answer` block. Note the two most common mistakes.",
    tags: ["calculus", "tutoring"],
  },
  {
    id: "t6",
    title: "Dataset profiling report",
    mode: "data",
    category: "Data",
    body: "Profile the attached dataset: shape, schema with inferred types and null rates, statistical summary, outliers, data-quality findings (duplicates, mixed types, timezone ambiguity, PII), five insight candidates ranked by value, and a runnable pandas snippet that reproduces your analysis.",
    tags: ["pandas", "quality"],
  },
  {
    id: "t7",
    title: "Latency optimisation plan",
    mode: "research",
    category: "Performance",
    body: "Given this service, produce an ordered latency-reduction plan. For each proposal give estimated p50/p95 impact, effort in engineer-days, blast radius, how to measure the win, and how to roll back. Start with the cheapest measurable change.",
    tags: ["performance", "SRE"],
  },
  {
    id: "t8",
    title: "Interview-grade code review",
    mode: "scaffold",
    category: "Code review",
    body: "Review the attached diff as a staff engineer. Separate blocking issues from nits. For every blocking issue give the failing scenario, the fixed snippet, and a test that would have caught it. Then propose the refactor that removes the whole class of bug.",
    tags: ["review", "quality"],
  },
  {
    id: "t9",
    title: "Database schema from requirements",
    mode: "diagram",
    category: "Data",
    body: "From these product requirements, design a normalised database schema. Output: an ER diagram in Mermaid, the DDL, index strategy with the query each index serves, partition/sharding plan at 100M rows, and migration order.",
    tags: ["ERD", "DDL"],
  },
];

const MODE_ICON: Record<ModeId, React.ElementType> = {
  research: BookOpenCheck,
  scaffold: Braces,
  diagram: Network,
  math: Sigma,
  data: Database,
};

const CATEGORIES = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];

export function Library() {
  const { setMode, clearAttachments, reset } = useWorkspace();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = TEMPLATES.filter((template) => {
    const matchesCategory = category === "All" || template.category === category;
    const matchesQuery =
      !query ||
      `${template.title} ${template.body} ${template.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500">
            <BookOpenCheck className="h-4 w-4 text-white" />
          </span>
          Prompt Library
        </h1>
        <Badge tone="indigo">{TEMPLATES.length} routines</Badge>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search routines, tags…"
          className="ml-auto h-8 w-52 rounded-lg border border-white/12 bg-black/35 px-2.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1 px-1">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10.5px] transition",
              category === item
                ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-slate-200",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((template, index) => {
          const Icon = MODE_ICON[template.mode];
          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 28 }}
            >
              <GlassPanel className="flex h-full flex-col p-3.5 transition-colors hover:border-cyan-300/25">
                <div className="mb-1.5 flex items-start gap-2">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-cyan-300/15 bg-cyan-400/10">
                    <Icon className="h-3 w-3 text-cyan-200" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[12.5px] font-semibold leading-snug text-slate-100">{template.title}</h3>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-cyan-300/60">
                      {template.mode} · {template.category}
                    </p>
                  </div>
                </div>
                <p className="mb-2 line-clamp-4 flex-1 text-[11px] leading-relaxed text-slate-400">{template.body}</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <span key={tag} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
                  <SpringButton
                    size="xs"
                    variant="soft"
                    onClick={() => {
                      reset();
                      setMode(template.mode);
                      navigator.clipboard?.writeText(template.body).catch(() => undefined);
                      setCopied(template.id);
                      setTimeout(() => setCopied(null), 1600);
                    }}
                  >
                    {copied === template.id ? "Copied — paste it in" : "Copy prompt"}
                  </SpringButton>
                  <SpringButton size="xs" variant="ghost" onClick={() => { clearAttachments(); setMode(template.mode); }}>
                    <Terminal className="h-3 w-3" /> set mode
                  </SpringButton>
                  {template.mode === "math" ? (
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-600">
                      <Camera className="h-2.5 w-2.5" /> camera ready
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-600">
                      <Sparkles className="h-2.5 w-2.5" /> proactive
                    </span>
                  )}
                </div>
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
