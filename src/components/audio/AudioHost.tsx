"use client";

import { useCallback, useEffect, useRef } from "react";

type AudioHostProps = {
  playing: boolean;
  volume: number;
  onIntensity: (value: number) => void;
  onError?: (message: string | null) => void;
  onPlayingChange?: (playing: boolean) => void;
};

/**
 * Headless host for the ambient track. Owns the <audio> element, AudioContext,
 * and AnalyserNode so they survive parent re-renders (including the
 * desktop/mobile chrome fork).
 */
export function AudioHost({
  playing,
  volume,
  onIntensity,
  onError,
  onPlayingChange
}: AudioHostProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const onIntensityRef = useRef(onIntensity);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onErrorRef = useRef(onError);

  onIntensityRef.current = onIntensity;
  onPlayingChangeRef.current = onPlayingChange;
  onErrorRef.current = onError;

  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return null;
    }

    if (!contextRef.current) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        onErrorRef.current?.("Web Audio is unavailable.");
        return null;
      }

      contextRef.current = new AudioContextCtor();
      analyserRef.current = contextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
    }

    if (!sourceRef.current && analyserRef.current && contextRef.current) {
      sourceRef.current = contextRef.current.createMediaElementSource(audio);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(contextRef.current.destination);
    }

    return contextRef.current;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  // Drive play/pause from the controlled `playing` prop.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let cancelled = false;

    const start = async () => {
      const context = ensureGraph();
      if (!context) {
        return;
      }
      try {
        await context.resume();
        await audio.play();
        if (!cancelled) {
          onErrorRef.current?.(null);
        }
      } catch {
        if (!cancelled) {
          onErrorRef.current?.("Audio could not start.");
          onPlayingChangeRef.current?.(false);
        }
      }
    };

    if (playing) {
      void start();
    } else if (!audio.paused) {
      audio.pause();
    }

    return () => {
      cancelled = true;
    };
  }, [ensureGraph, playing]);

  // Initial auto-start attempt with first-gesture fallback.
  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    const gestureStart = () => {
      const context = ensureGraph();
      if (!context) {
        return;
      }
      void context.resume();
      void audioRef.current?.play().catch(() => {});
    };

    window.addEventListener("pointerdown", gestureStart, { once: true });
    window.addEventListener("keydown", gestureStart, { once: true });

    return () => {
      window.removeEventListener("pointerdown", gestureStart);
      window.removeEventListener("keydown", gestureStart);
    };
  }, [ensureGraph, playing]);

  // Intensity tick.
  useEffect(() => {
    const analyser = analyserRef.current;
    if (!playing || !analyser) {
      onIntensityRef.current(0);
      return undefined;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const sum = data.reduce((total, value) => total + value, 0);
      onIntensityRef.current(sum / data.length / 255);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [playing]);

  return (
    <audio
      aria-hidden="true"
      loop
      preload="metadata"
      ref={audioRef}
      src="/audio/entering-elysium.mp3"
    />
  );
}
