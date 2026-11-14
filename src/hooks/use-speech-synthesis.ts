"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const clean = text
        .replace(/```[\s\S]*?```/g, " code block ")
        .replace(/\$\$[\s\S]*?\$\$/g, " equation ")
        .replace(/[#*_>`|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!clean) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean.slice(0, 3200));
      utterance.rate = 1.02;
      utterance.pitch = 1;
      const preferred = window.speechSynthesis
        .getVoices()
        .find((voice) => /Google UK English|Samantha|Daniel|Alex/i.test(voice.name));
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported };
}
