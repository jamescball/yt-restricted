// src/app/player/[id]/player-client.tsx
"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  const m = Math.floor((sec / 60) % 60).toString();
  const h = Math.floor(sec / 3600);
  return h > 0 ? `${h}:${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export default function PlayerClient({ videoId }: { videoId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const tickRef = useRef<number | null>(null);
  const prevVolRef = useRef<number>(100);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  // Scrub state (permille 0..1000)
  const [seeking, setSeeking] = useState(false);
  const [seekPermille, setSeekPermille] = useState(0);
  const wasPlayingRef = useRef<boolean>(false);
  const durSnapshotRef = useRef<number>(0);

  // Fullscreen
  const [isFullscreen, setFullscreen] = useState(false);

  // Load API once if needed
  useEffect(() => {
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  }, []);

  // Build player — IMPORTANT: only when videoId changes (NOT on seek!)
  useEffect(() => {
    const build = () => {
      if (!mountRef.current) return;

      const origin = window.location.origin;
      playerRef.current = new window.YT.Player(mountRef.current, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          controls: 0,
          enablejsapi: 1,
          origin,
          playsinline: 1,
          fs: 1,
          disablekb: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (ev: any) => {
            try {
              ev.target.cueVideoById(videoId); // load paused
              const vol = ev.target.getVolume?.() ?? 100;
              setVolume(vol);
              prevVolRef.current = vol || 100;
              setMuted(ev.target.isMuted?.() ?? false);
              setDuration(ev.target.getDuration?.() ?? 0);
              setReady(true);
            } catch {}

            // Poll time/duration/volume; don't overwrite current while seeking
            tickRef.current = window.setInterval(() => {
              try {
                if (!seeking) setCurrent(ev.target.getCurrentTime?.() ?? 0);
                setDuration(ev.target.getDuration?.() ?? 0);
                const isM = ev.target.isMuted?.() ?? false;
                const v = ev.target.getVolume?.();
                if (typeof v === "number") setVolume(v);
                setMuted(isM);
              } catch {}
            }, 250) as unknown as number;
          },
          onStateChange: (e: any) => {
            const YT = window.YT;
            switch (e?.data) {
              case YT?.PlayerState?.PLAYING:
                setPlaying(true);
                break;
              case YT?.PlayerState?.ENDED:
                // prevent auto-advance
                try {
                  e.target.seekTo(0, true);
                  e.target.pauseVideo();
                  setCurrent(0);
                } catch {}
                setPlaying(false);
                break;
              default:
                setPlaying(false);
                break;
            }
          },
          onError: () => {
            // leave as-is (owner may have disabled embed)
          },
        },
      });
    };

    if (window.YT && window.YT.Player) build();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        build();
      };
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
  }, [videoId]); // <-- only videoId

  // Controls
  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const st = p.getPlayerState?.();
      const YT = window.YT;
      if (st === YT?.PlayerState?.PLAYING) p.pauseVideo();
      else p.playVideo();
    } catch {}
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.isMuted?.()) {
        const restore = prevVolRef.current > 0 ? prevVolRef.current : 50;
        p.unMute();
        p.setVolume(restore);
        setVolume(restore);
        setMuted(false);
      } else {
        const curVol = p.getVolume?.() ?? volume ?? 100;
        if (curVol > 0) prevVolRef.current = curVol;
        p.mute();
        setMuted(true);
      }
    } catch {}
  };

  const onVolume = (v: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setVolume(v);
      setVolume(v);
      if (v === 0) {
        if (!p.isMuted?.()) p.mute();
        setMuted(true);
      } else {
        if (p.isMuted?.()) p.unMute();
        setMuted(false);
        prevVolRef.current = v;
      }
    } catch {}
  };

  // Seeking (permille slider + snapshot duration)
  const onSeekStart = () => {
    const p = playerRef.current;
    if (!p) return;

    try {
      const st = p.getPlayerState?.();
      const YT = window.YT;
      wasPlayingRef.current = st === YT?.PlayerState?.PLAYING;
      if (wasPlayingRef.current) p.pauseVideo();
    } catch {}

    const snap = ((): number => {
      const d = Number.isFinite(duration) && duration > 0 ? duration : p.getDuration?.() ?? 0;
      return d > 0 ? d : 0;
    })();
    durSnapshotRef.current = snap;

    const perm = snap > 0 ? Math.round((current / snap) * 1000) : 0;
    setSeekPermille(perm);
    setSeeking(true);
  };

  const onSeekPreview = (perm: number) => {
    setSeekPermille(perm);
    const d = durSnapshotRef.current || duration || 0;
    const seconds = d > 0 ? (perm / 1000) * d : 0;
    setCurrent(seconds);
  };

  const onSeekCommit = () => {
    const p = playerRef.current;
    if (!p) return;

    try {
      const d = durSnapshotRef.current || duration || 0;
      const seconds = d > 0 ? (seekPermille / 1000) * d : 0;
      const target = Math.max(0, Math.min(seconds, d || 0));
      p.seekTo(target, true);
      setCurrent(target);
      if (wasPlayingRef.current) p.playVideo();
    } catch {}

    setSeeking(false);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Live slider value from current/duration when not seeking
  const livePermille =
    !seeking && duration > 0
      ? Math.max(0, Math.min(1000, Math.round((current / duration) * 1000)))
      : seekPermille;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Iframe mount */}
      <div ref={mountRef} className="h-full w-full" />

      {/* Transparent blocker to swallow iframe clicks */}
      <div
        className="absolute inset-0 z-10"
        aria-hidden="true"
        onPointerDown={(e) => e.preventDefault()}
        onPointerUp={(e) => e.preventDefault()}
        onClick={(e) => e.preventDefault()}
        style={{ touchAction: "none" }}
      />

      {/* Controls */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
        {/* Seek (permille) */}
        <div className="flex items-center gap-2">
          <span className="w-12 text-xs tabular-nums">{fmtTime(current)}</span>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={livePermille}
            onPointerDown={onSeekStart}
            onChange={(e) => onSeekPreview(Number(e.target.value))}
            onPointerUp={onSeekCommit}
            className="w-full accent-white"
            aria-label="Seek"
          />
          <span className="w-12 text-right text-xs tabular-nums">{fmtTime(duration)}</span>
        </div>

        {/* Buttons / Volume / Fullscreen */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="rounded-md bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
            >
              {playing ? "Pause" : "Play"}
            </button>

            <button
              onClick={toggleMute}
              className="rounded-md bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
            >
              {muted ? "Unmute" : "Mute"}
            </button>

            <div className="ml-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="w-28 accent-white"
                aria-label="Volume"
              />
              <span className="w-10 text-right text-xs tabular-nums">{volume}</span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="ml-3 rounded-md bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
          </div>

          {!ready && <span className="text-xs text-white/80">Loading player…</span>}
        </div>
      </div>
    </div>
  );
}
