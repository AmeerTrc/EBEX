"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbState } from "./ApexHeroOrb";

export interface VoiceStatus {
  configured: boolean;
  voiceId: string;
}

export function useApexVoice() {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check server configuration status once on mount
  useEffect(() => {
    fetch("/api/voice")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setVoiceStatus(data);
      })
      .catch((err) => {
        console.warn("[ApexVoice] Status check failed:", err);
      });
  }, []);

  const stop = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(
    async (
      text: string,
      onStateChange?: (state: OrbState) => void
    ) => {
      // Clean up previous playback
      stop();

      setIsLoading(true);
      onStateChange?.("thinking");

      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn("[ApexVoice] Voice API returned:", response.status, errData);

          // Graceful fallback if API key not yet set: simulate speech state
          setIsLoading(false);
          setIsPlaying(true);
          onStateChange?.("speaking");

          fallbackTimerRef.current = setTimeout(() => {
            setIsPlaying(false);
            onStateChange?.("idle");
          }, 3500);
          return;
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        activeUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
          onStateChange?.("speaking");
        };

        audio.onended = () => {
          setIsPlaying(false);
          onStateChange?.("idle");
          stop();
        };

        audio.onerror = (e) => {
          console.error("[ApexVoice] Audio playback error:", e);
          setIsPlaying(false);
          setIsLoading(false);
          onStateChange?.("idle");
          stop();
        };

        await audio.play();
      } catch (error) {
        console.error("[ApexVoice] Speech generation error:", error);
        setIsLoading(false);
        // Fallback simulation
        onStateChange?.("speaking");
        fallbackTimerRef.current = setTimeout(() => {
          setIsPlaying(false);
          onStateChange?.("idle");
        }, 3500);
      }
    },
    [stop]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    speak,
    stop,
    isPlaying,
    isLoading,
    voiceStatus,
  };
}
