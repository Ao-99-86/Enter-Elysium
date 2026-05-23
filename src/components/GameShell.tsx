"use client";

import { useCallback } from "react";
import { AudioHost } from "./audio/AudioHost";
import { DesktopChrome } from "./desktop/DesktopChrome";
import { MobileChrome } from "./mobile/MobileChrome";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useGameShellState } from "@/lib/useGameShellState";

const MOBILE_MEDIA_QUERY = "(max-width: 980px)";

export function GameShell() {
  const state = useGameShellState();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  const {
    audioPlaying,
    audioVolume,
    setAudioIntensity,
    setAudioError,
    setAudioPlaying
  } = state;

  const handlePlayingChange = useCallback(
    (playing: boolean) => {
      setAudioPlaying(playing);
    },
    [setAudioPlaying]
  );

  return (
    <>
      <AudioHost
        onError={setAudioError}
        onIntensity={setAudioIntensity}
        onPlayingChange={handlePlayingChange}
        playing={audioPlaying}
        volume={audioVolume}
      />
      {isMobile ? (
        <MobileChrome state={state} />
      ) : (
        <DesktopChrome state={state} />
      )}
    </>
  );
}
