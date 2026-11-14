"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  Clipboard,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  SwitchCamera,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SpringButton } from "@/components/ui/spring-button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Facing = "user" | "environment";

export type CameraCapture = {
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: number;
};

export function CameraModal({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (capture: CameraCapture) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<CameraCapture | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [scanning, setScanning] = useState(true);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const startStream = useCallback(
    async (mode: Facing) => {
      stopStream();
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode === "environment" ? { ideal: "environment" } : { ideal: "user" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Camera unavailable";
        setError(
          /permission|denied|notallowed/i.test(message)
            ? "Camera permission was denied. Enable it in your browser's site settings, or upload an image instead."
            : "No camera was found on this device. You can upload or paste an image instead.",
        );
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (!open) {
      stopStream();
      setShot(null);
      setRotation(0);
      setZoom(1);
      return;
    }
    void startStream(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  // Clipboard paste support (Ctrl/Cmd+V anywhere while the modal is open).
  useEffect(() => {
    if (!open) return;
    const handler = async (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      const dataUrl = await blobToDataUrl(file);
      const dims = await measureImage(dataUrl);
      setShot({ ...dims, dataUrl, capturedAt: Date.now() });
    };
    window.addEventListener("paste", handler as unknown as EventListener);
    return () => window.removeEventListener("paste", handler as unknown as EventListener);
  }, [open]);

  const snap = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    setFlash(true);
    setTimeout(() => setFlash(false), 340);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setShot({ dataUrl, width, height, capturedAt: Date.now() });
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await blobToDataUrl(file);
    const dims = await measureImage(dataUrl);
    setShot({ dataUrl, ...dims, capturedAt: Date.now() });
  };

  const confirm = async () => {
    if (!shot) return;
    const rotated = await applyRotation(shot.dataUrl, rotation);
    onCapture({ ...shot, dataUrl: rotated, capturedAt: Date.now() });
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-70 grid place-items-center bg-black/85 p-3 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className="glass relative w-full max-w-3xl overflow-hidden rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Camera className="h-4 w-4 text-cyan-300" /> Vision capture
                </h2>
                <p className="text-[10.5px] text-slate-500">
                  Snap a maths problem, handwritten quiz or UI bug · paste with ⌘/Ctrl+V
                </p>
              </div>
              <SpringButton size="icon" variant="ghost" onClick={onClose} aria-label="Close camera">
                <X className="h-4 w-4" />
              </SpringButton>
            </div>

            <div className="relative aspect-video w-full overflow-hidden bg-black">
              {shot ? (
                <motion.img
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={shot.dataUrl}
                  alt="Captured frame"
                  className="h-full w-full object-contain transition-transform"
                  style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={cn(
                      "h-full w-full object-cover transition-opacity duration-500",
                      facing === "user" && "-scale-x-100",
                      ready ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {/* viewfinder grid */}
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-[8%] rounded-lg border border-cyan-300/25" />
                    <div className="absolute inset-[8%] grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-cyan-300/[0.09]" />
                      ))}
                    </div>
                    <div className="absolute left-[8%] top-[8%] h-6 w-6 border-l-2 border-t-2 border-cyan-300/80" />
                    <div className="absolute right-[8%] top-[8%] h-6 w-6 border-r-2 border-t-2 border-cyan-300/80" />
                    <div className="absolute bottom-[8%] left-[8%] h-6 w-6 border-b-2 border-l-2 border-cyan-300/80" />
                    <div className="absolute bottom-[8%] right-[8%] h-6 w-6 border-b-2 border-r-2 border-cyan-300/80" />
                    {scanning ? (
                      <div className="animate-scanline absolute inset-x-[8%] h-24 bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />
                    ) : null}
                    <p className="absolute bottom-[10%] left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/25 bg-black/50 px-3 py-1 text-[10px] tracking-wide text-cyan-100/90 backdrop-blur">
                      align the equation inside the frame
                    </p>
                  </div>
                  {!ready && !error ? (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                        <p className="text-[11px] text-slate-400">Starting camera…</p>
                      </div>
                    </div>
                  ) : null}
                  {error ? (
                    <div className="absolute inset-0 grid place-items-center p-6 text-center">
                      <div className="max-w-sm">
                        <p className="text-[12.5px] leading-relaxed text-amber-200">{error}</p>
                        <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[11.5px] text-slate-200 hover:bg-white/10">
                          <Upload className="h-3.5 w-3.5" /> Choose an image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => void onUpload(event.target.files?.[0])}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              <AnimatePresence>
                {flash ? (
                  <motion.div
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.34 }}
                    className="pointer-events-none absolute inset-0 bg-white"
                  />
                ) : null}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                {shot ? (
                  <>
                    <Tooltip label="Rotate left">
                      <SpringButton size="icon" variant="outline" onClick={() => setRotation((r) => r - 90)}>
                        <RotateCcw className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                    <Tooltip label="Rotate right">
                      <SpringButton size="icon" variant="outline" onClick={() => setRotation((r) => r + 90)}>
                        <RotateCw className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                    <Tooltip label="Zoom out">
                      <SpringButton size="icon" variant="outline" onClick={() => setZoom((z) => Math.max(1, z - 0.15))}>
                        <ZoomOut className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                    <span className="min-w-9 text-center font-mono text-[10px] text-slate-400">
                      {zoom.toFixed(2)}×
                    </span>
                    <Tooltip label="Zoom in">
                      <SpringButton size="icon" variant="outline" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
                        <ZoomIn className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                    <Tooltip label="Retake">
                      <SpringButton size="icon" variant="ghost" onClick={() => { setShot(null); setRotation(0); setZoom(1); }}>
                        <RefreshCw className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <Tooltip label="Switch camera">
                      <SpringButton
                        size="icon"
                        variant="outline"
                        onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                      >
                        <SwitchCamera className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                    <Tooltip label={scanning ? "Stop scan guide" : "Show scan guide"}>
                      <SpringButton
                        size="icon"
                        variant={scanning ? "soft" : "outline"}
                        onClick={() => setScanning((s) => !s)}
                      >
                        <ScanLine className="h-4 w-4" />
                      </SpringButton>
                    </Tooltip>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-300 hover:bg-white/[0.07]">
                      <ImagePlus className="h-3.5 w-3.5" /> Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void onUpload(event.target.files?.[0])}
                      />
                    </label>
                    <span className="hidden items-center gap-1 text-[10px] text-slate-500 sm:flex">
                      <Clipboard className="h-3 w-3" /> or paste
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {shot ? (
                  <>
                    <SpringButton variant="ghost" size="sm" onClick={() => setShot(null)}>
                      Retake
                    </SpringButton>
                    <SpringButton variant="primary" size="sm" onClick={() => void confirm()}>
                      <Check className="h-3.5 w-3.5" /> Use frame
                    </SpringButton>
                  </>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    onClick={() => void snap()}
                    disabled={!ready}
                    aria-label="Capture frame"
                    className="relative grid h-12 w-12 place-items-center rounded-full border-2 border-cyan-300/60 bg-white/10 disabled:opacity-40"
                  >
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-white to-cyan-200" />
                    <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/30" />
                  </motion.button>
                )}
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

async function applyRotation(dataUrl: string, degrees: number): Promise<string> {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const swap = normalized === 90 || normalized === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}
