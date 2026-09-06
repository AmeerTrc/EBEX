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

  const stopPromiseResolverRef = useRef<((val: boolean) => void) | null>(null);

  const stop = useCallback(() => {
    if (stopPromiseResolverRef.current) {
      stopPromiseResolverRef.current(false);
      stopPromiseResolverRef.current = null;
    }
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
    (
      text: string,
      onStateChange?: (state: OrbState) => void,
      speed?: number
    ): Promise<boolean> => {
      // Clean up previous playback
      stop();

      setIsLoading(true);
      onStateChange?.("thinking");

      return new Promise<boolean>(async (resolve) => {
        stopPromiseResolverRef.current = resolve;

        try {
          const response = await fetch("/api/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, speed: speed || 0.70 }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn("[ApexVoice] Voice API returned:", response.status, errData);

            // Graceful fallback simulation
            setIsLoading(false);
            setIsPlaying(true);
            onStateChange?.("speaking");

            fallbackTimerRef.current = setTimeout(() => {
              setIsPlaying(false);
              onStateChange?.("idle");
              stopPromiseResolverRef.current = null;
              resolve(false);
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
            stopPromiseResolverRef.current = null;
            resolve(true);
          };

          audio.onerror = (e) => {
            console.error("[ApexVoice] Audio playback error:", e);
            setIsPlaying(false);
            setIsLoading(false);
            onStateChange?.("idle");
            stop();
            stopPromiseResolverRef.current = null;
            resolve(false);
          };

          await audio.play();
        } catch (error) {
          console.error("[ApexVoice] Speech generation error:", error);
          setIsLoading(false);
          onStateChange?.("speaking");
          fallbackTimerRef.current = setTimeout(() => {
            setIsPlaying(false);
            onStateChange?.("idle");
            stopPromiseResolverRef.current = null;
            resolve(false);
          }, 3500);
        }
      });
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
