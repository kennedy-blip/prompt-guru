"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultList = { length: number; [index: number]: SpeechRecognitionResult };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorLike = { error: string; message?: string };

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

export type VoiceState = "idle" | "listening" | "error" | "unsupported";

type Options = {
  onFinalTranscript?: (text: string) => void;
  onSilence?: () => void;
  autoSendOnSilence?: boolean;
  silenceMs?: number;
  lang?: string;
};

/**
 * Live transcription + microphone amplitude metering.
 * Uses the Web Speech API for text and the Web Audio API (AnalyserNode) for
 * the waveform/halo visualisation, with a graceful MediaRecorder-only fallback
 * when speech recognition is unavailable (e.g. Firefox).
 */
export function useSpeechRecognition(options: Options = {}) {
  const {
    onFinalTranscript,
    onSilence,
    autoSendOnSilence = false,
    silenceMs = 1600,
    lang = "en-US",
  } = options;

  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantedRef = useRef(false);
  const finalRef = useRef("");
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const average = sum / data.length / 255;
        setLevel((prev) => prev * 0.65 + average * 0.35);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("Microphone permission denied.");
      setState("error");
    }
  }, []);

  const buildRecognition = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimBuffer = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current = `${finalRef.current} ${transcript}`.trim();
          setFinalText(finalRef.current);
          callbacksRef.current.onFinalTranscript?.(finalRef.current);
        } else {
          interimBuffer += transcript;
        }
      }
      setInterim(interimBuffer);

      clearSilenceTimer();
      if (callbacksRef.current.autoSendOnSilence) {
        silenceTimer.current = setTimeout(() => {
          if (finalRef.current.trim() || interimBuffer.trim()) {
            callbacksRef.current.onSilence?.();
          }
        }, silenceMs);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone blocked — allow access in your browser settings."
          : `Speech recognition error: ${event.error}`,
      );
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState("error");
        wantedRef.current = false;
      }
    };

    recognition.onend = () => {
      // Chrome ends the session after a pause; restart while the user still wants it.
      if (wantedRef.current) {
        try {
          recognition.start();
        } catch {
          setState("idle");
        }
      } else {
        setState("idle");
      }
    };

    return recognition;
  }, [clearSilenceTimer, lang, silenceMs]);

  const start = useCallback(async () => {
    setError(null);
    finalRef.current = "";
    setFinalText("");
    setInterim("");
    wantedRef.current = true;
    await startMeter();

    const recognition = buildRecognition();
    if (!recognition) {
      // MediaRecorder-only fallback: we still meter audio, transcription unavailable.
      setState("listening");
      return;
    }
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setState("error");
      setError("Could not start speech recognition.");
    }
  }, [buildRecognition, startMeter]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    clearSilenceTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    stopMeter();
    setState("idle");
    setInterim("");
  }, [clearSilenceTimer, stopMeter]);

  const reset = useCallback(() => {
    finalRef.current = "";
    setFinalText("");
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      wantedRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      stopMeter();
    },
    [stopMeter],
  );

  return {
    state,
    interim,
    finalText,
    level,
    error,
    supported,
    start,
    stop,
    reset,
    listening: state === "listening",
  };
}
