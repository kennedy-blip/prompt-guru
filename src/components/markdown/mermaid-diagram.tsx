"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Download,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  ImageDown,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn, uid } from "@/lib/utils";
import { SpringButton } from "@/components/ui/spring-button";
import { Tooltip } from "@/components/ui/tooltip";

type MermaidDiagramProps = {
  code: string;
  className?: string;
};

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "var(--font-sans), ui-sans-serif, system-ui",
        themeVariables: {
          background: "#0a0c12",
          primaryColor: "#12202a",
          primaryTextColor: "#e2f7ff",
          primaryBorderColor: "#22d3ee",
          lineColor: "#4f6b7a",
          secondaryColor: "#161b2b",
          tertiaryColor: "#0f1420",
          mainBkg: "#111a24",
          nodeBorder: "#2b4a5c",
          clusterBkg: "rgba(34,211,238,0.05)",
          clusterBorder: "rgba(34,211,238,0.22)",
          titleColor: "#a5f3fc",
          edgeLabelBackground: "#0b0e15",
          actorBkg: "#12202a",
          actorBorder: "#22d3ee",
          actorTextColor: "#e2f7ff",
          signalColor: "#94a3b8",
          labelTextColor: "#cbd5e1",
          fontSize: "14px",
        },
        flowchart: { curve: "basis", padding: 16, htmlLabels: true },
        sequence: { actorMargin: 46, boxMargin: 12, mirrorActors: false },
        er: { stroke: "#3f5c6b" },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export function MermaidDiagram({ code, className }: MermaidDiagramProps) {
  const rawId = useId();
  const domId = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const draggingRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const mermaid = await getMermaid();
        const { svg: rendered } = await mermaid.render(domId, code.trim());
        if (!active) return;
        setSvg(rendered);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not render this diagram.");
        setSvg("");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code, domId]);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const downloadSvg = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `promptguru-diagram-${uid("d").slice(-6)}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  const downloadPng = useCallback(async () => {
    if (!svg) return;
    try {
      const png = await svgToPng(svg, 2);
      const link = document.createElement("a");
      link.href = png;
      link.download = `promptguru-diagram-${uid("d").slice(-6)}.png`;
      link.click();
    } catch {
      setError("PNG export failed — try SVG instead.");
    }
  }, [svg]);

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setScale((prev) => Math.min(3.5, Math.max(0.35, prev - event.deltaY * 0.0016)));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    draggingRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag) return;
    setOffset({ x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) });
  };

  const onPointerUp = () => {
    draggingRef.current = null;
    setDragging(false);
  };

  const canvas = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/8 bg-[#080a10]/80",
        fullscreen ? "h-full" : "h-[300px]",
        dragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="pointer-events-none absolute inset-0 grid-veil opacity-40" />
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
            <p className="text-[11px] text-slate-500">Rendering diagram…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-300" />
          <p className="text-xs font-medium text-amber-200">Diagram syntax issue</p>
          <p className="max-w-md text-[11px] leading-relaxed text-slate-500">{error}</p>
          <pre className="mt-2 max-h-24 w-full overflow-auto rounded-lg bg-black/40 p-2 text-left font-mono text-[10px] text-slate-400">
            {code}
          </pre>
        </div>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center [&_svg]:h-auto [&_svg]:max-w-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging ? "none" : "transform 160ms cubic-bezier(0.22,1,0.36,1)",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {!loading && !error ? (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-xl border border-white/10 bg-[#0b0e15]/85 p-1 backdrop-blur-xl">
          <Tooltip label="Zoom out">
            <SpringButton size="icon" variant="ghost" className="h-7 w-7" onClick={() => setScale((s) => Math.max(0.35, s - 0.18))}>
              <Minus className="h-3.5 w-3.5" />
            </SpringButton>
          </Tooltip>
          <button
            onClick={resetView}
            className="min-w-11 rounded-md px-1 py-0.5 font-mono text-[10px] text-slate-400 hover:text-cyan-200"
          >
            {Math.round(scale * 100)}%
          </button>
          <Tooltip label="Zoom in">
            <SpringButton size="icon" variant="ghost" className="h-7 w-7" onClick={() => setScale((s) => Math.min(3.5, s + 0.18))}>
              <Plus className="h-3.5 w-3.5" />
            </SpringButton>
          </Tooltip>
          <Tooltip label="Reset view">
            <SpringButton size="icon" variant="ghost" className="h-7 w-7" onClick={resetView}>
              <RotateCcw className="h-3.5 w-3.5" />
            </SpringButton>
          </Tooltip>
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          <Tooltip label="Download SVG">
            <SpringButton size="icon" variant="ghost" className="h-7 w-7" onClick={downloadSvg}>
              <Download className="h-3.5 w-3.5" />
            </SpringButton>
          </Tooltip>
          <Tooltip label="Download PNG">
            <SpringButton size="icon" variant="ghost" className="h-7 w-7" onClick={downloadPng}>
              <ImageDown className="h-3.5 w-3.5" />
            </SpringButton>
          </Tooltip>
          <Tooltip label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <SpringButton size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFullscreen((f) => !f)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </SpringButton>
          </Tooltip>
        </div>
      ) : null}
      {!loading && !error ? (
        <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-slate-500">
          drag to pan · ⌘/ctrl + scroll to zoom
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      {canvas}
      <AnimatePresence>
        {fullscreen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex flex-col bg-[#05060a]/95 p-4 backdrop-blur-2xl md:p-8"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium tracking-[0.2em] text-cyan-200/80">DIAGRAM VIEWER</p>
              <SpringButton size="sm" variant="outline" onClick={() => setFullscreen(false)}>
                <X className="h-3.5 w-3.5" /> Close
              </SpringButton>
            </div>
            <div className="min-h-0 flex-1">{canvas}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

async function svgToPng(svg: string, scale = 2): Promise<string> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not rasterise SVG"));
      img.src = url;
    });
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number);
    const width = Math.max(image.width || viewBox?.[2] || 1200, 320);
    const height = Math.max(image.height || viewBox?.[3] || 800, 200);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#090a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
