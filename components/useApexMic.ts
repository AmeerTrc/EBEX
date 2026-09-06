"use client";

import { useCallback, useRef, useState } from "react";

export interface MicOptions {
  onSilenceAutoStop?: () => void;
  silenceDelayMs?: number;
}

export function useApexMic(options: MicOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSilenceRef = useRef(options.onSilenceAutoStop);
  onSilenceRef.current = options.onSilenceAutoStop;

  const startRecording = useCallback(async (): Promise<boolean> => {
    setMicError(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API not supported on this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Determine supported mime type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/wav",
      ];
      let selectedMimeType = "";
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // 100ms slices
      setIsRecording(true);

      // Voice Activity Detection (VAD) via AudioContext
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let hasSpoken = false;
        let lastVoiceTime = Date.now();
        const startTime = Date.now();
        const silenceThreshold = options.silenceDelayMs || 1100; // 1.1s silence to auto-stop

        vadIntervalRef.current = setInterval(() => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          // Volume threshold indicating active speech
          if (average > 8) {
            hasSpoken = true;
            lastVoiceTime = Date.now();
          }

          // If user spoke and then stopped for silenceThreshold -> Auto Stop & Submit!
          if (hasSpoken && Date.now() - lastVoiceTime > silenceThreshold) {
            if (vadIntervalRef.current) {
              clearInterval(vadIntervalRef.current);
              vadIntervalRef.current = null;
            }
            onSilenceRef.current?.();
          }

          // Safety timeout: if user didn't speak for 9 seconds at all -> Auto Stop
          if (!hasSpoken && Date.now() - startTime > 9000) {
            if (vadIntervalRef.current) {
              clearInterval(vadIntervalRef.current);
              vadIntervalRef.current = null;
            }
            onSilenceRef.current?.();
          }
        }, 60);
      } catch (vadErr) {
        console.warn("[useApexMic] VAD setup failed, manual tap available:", vadErr);
      }

      return true;
    } catch (err: unknown) {
      console.error("[useApexMic] Error starting recording:", err);
      const msg = err instanceof Error ? err.message : "Failed to access microphone";
      setMicError(msg);
      setIsRecording(false);
      return false;
    }
  }, [options.silenceDelayMs]);

  const cleanupAudio = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const stopRecording = useCallback((): Promise<Blob | null> => {
    cleanupAudio();

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        setIsRecording(false);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;

        resolve(audioBlob);
      };

      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
        resolve(null);
      }
    });
  }, []);

  const cancelRecording = useCallback(() => {
    cleanupAudio();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    micError,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
