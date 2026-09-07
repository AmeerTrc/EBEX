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

  const interruptionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getOrCreateStream = async (): Promise<MediaStream> => {
    if (
      streamRef.current &&
      streamRef.current.active &&
      streamRef.current.getAudioTracks().some((t) => t.readyState === "live")
    ) {
      return streamRef.current;
    }
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
    return stream;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    setMicError(null);
    audioChunksRef.current = [];

    try {
      const stream = await getOrCreateStream();

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
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = audioContextRef.current || new AudioCtx();
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
        const silenceThreshold = options.silenceDelayMs || 1600;

        // Dynamic acoustic floor calibration (adapts to room noise)
        let noiseFloor = 10;
        let sampleCount = 0;

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

          // Calibrate baseline noise during initial samples
          if (sampleCount < 10) {
            sampleCount++;
            noiseFloor = Math.max(4, (noiseFloor * (sampleCount - 1) + average) / sampleCount);
            return;
          }

          // Dynamic speech and silence thresholds (calibrated to catch both normal and soft long speech)
          const speechThreshold = Math.max(18, noiseFloor + 8);
          const silenceCutoff = Math.max(10, noiseFloor + 4);

          if (average > speechThreshold) {
            hasSpoken = true;
            lastVoiceTime = Date.now();
          }

          // ONLY trigger auto-stop IF the user actually spoke clear speech AND paused for a full silence duration
          if (hasSpoken && Date.now() - lastVoiceTime > silenceThreshold) {
            if (vadIntervalRef.current) {
              clearInterval(vadIntervalRef.current);
              vadIntervalRef.current = null;
            }
            onSilenceRef.current?.();
          }
        }, 50);
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
  };

  const stopInterruptionMonitoring = useCallback(() => {
    if (interruptionIntervalRef.current) {
      clearInterval(interruptionIntervalRef.current);
      interruptionIntervalRef.current = null;
    }
  }, []);

  const startInterruptionMonitoring = useCallback(
    async (onInterrupt: () => void) => {
      stopInterruptionMonitoring();

      try {
        const stream = await getOrCreateStream();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = audioContextRef.current || new AudioCtx();
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let speechHits = 0;
        const monitorStart = Date.now();

        interruptionIntervalRef.current = setInterval(() => {
          // Grace period: ignore first 1200ms of playback to prevent speaker transient bursts
          if (Date.now() - monitorStart < 1200) {
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          // Sustained intentional loud user speech (avoids speaker echo)
          if (average > 42) {
            speechHits++;
            if (speechHits >= 4) {
              stopInterruptionMonitoring();
              onInterrupt();
            }
          } else {
            speechHits = Math.max(0, speechHits - 1);
          }
        }, 50);
      } catch (err) {
        console.warn("[useApexMic] Interruption monitor init failed:", err);
      }
    },
    [stopInterruptionMonitoring]
  );

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
    stopInterruptionMonitoring();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
  }, [stopInterruptionMonitoring]);

  return {
    isRecording,
    micError,
    startRecording,
    stopRecording,
    cancelRecording,
    startInterruptionMonitoring,
    stopInterruptionMonitoring,
  };
}
