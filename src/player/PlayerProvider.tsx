import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/providers/trpc";
import type { TrackDto } from "@contracts/types";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: TrackDto[];
  index: number;
  current: TrackDto | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queueOpen: boolean;
  expanded: boolean;
  playList: (tracks: TrackDto[], startIndex?: number) => void;
  playTrack: (track: TrackDto, queue?: TrackDto[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setQueueOpen: (open: boolean) => void;
  setExpanded: (open: boolean) => void;
  playAt: (i: number) => void;
  removeAt: (i: number) => void;
  playNext: (track: TrackDto) => void;
  addToQueue: (track: TrackDto) => void;
}

const Ctx = createContext<PlayerState | null>(null);

function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }
  const audio = audioRef.current;

  const [queue, setQueue] = useState<TrackDto[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => loadPref("wl.volume", 0.85));
  const [muted, setMuted] = useState(() => loadPref("wl.muted", false));
  const [shuffle, setShuffle] = useState(() => loadPref("wl.shuffle", false));
  const [repeat, setRepeat] = useState<RepeatMode>(() => loadPref("wl.repeat", "off"));
  const [queueOpen, setQueueOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const indexRef = useRef(index);
  indexRef.current = index;
  const loadToken = useRef(0);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const currentRef = useRef(current);
  currentRef.current = current;

  const loadAndPlay = useCallback(
    async (track: TrackDto) => {
      const token = ++loadToken.current;
      setLoading(true);
      try {
        const { url } = await utils.library.fileUrl.fetch({ key: track.audioKey });
        if (token !== loadToken.current) return;
        audio.src = url;
        audio.currentTime = 0;
        await audio.play().catch(() => setPlaying(false));
      } catch {
        if (token === loadToken.current) setPlaying(false);
      } finally {
        if (token === loadToken.current) setLoading(false);
      }
    },
    [audio, utils],
  );

  const playList = useCallback(
    (tracks: TrackDto[], startIndex = 0) => {
      if (tracks.length === 0) return;
      setQueue(tracks);
      setIndex(startIndex);
      void loadAndPlay(tracks[startIndex]);
    },
    [loadAndPlay],
  );

  const playTrack = useCallback(
    (track: TrackDto, contextQueue?: TrackDto[]) => {
      if (contextQueue && contextQueue.length > 0) {
        const i = contextQueue.findIndex((t) => t.id === track.id);
        playList(contextQueue, i >= 0 ? i : 0);
      } else {
        playList([track], 0);
      }
    },
    [playList],
  );

  const next = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (q.length === 0) return;
    let ni: number;
    if (shuffle && q.length > 1) {
      do {
        ni = Math.floor(Math.random() * q.length);
      } while (ni === i);
    } else {
      ni = (i + 1) % q.length;
    }
    setIndex(ni);
    void loadAndPlay(q[ni]);
  }, [shuffle, loadAndPlay]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (q.length === 0) return;
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    const pi = (i - 1 + q.length) % q.length;
    setIndex(pi);
    void loadAndPlay(q[pi]);
  }, [audio, loadAndPlay]);

  const togglePlay = useCallback(() => {
    if (!currentRef.current) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, [audio]);

  const seek = useCallback(
    (sec: number) => {
      if (!Number.isFinite(sec)) return;
      audio.currentTime = Math.max(0, Math.min(sec, audio.duration || sec));
      setTime(audio.currentTime);
    },
    [audio],
  );

  const setVolume = useCallback(
    (v: number) => {
      const nv = Math.max(0, Math.min(1, v));
      setVolumeState(nv);
      localStorage.setItem("wl.volume", JSON.stringify(nv));
    },
    [],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      localStorage.setItem("wl.muted", JSON.stringify(!m));
      return !m;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      localStorage.setItem("wl.shuffle", JSON.stringify(!s));
      return !s;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const nr: RepeatMode = r === "off" ? "all" : r === "all" ? "one" : "off";
      localStorage.setItem("wl.repeat", JSON.stringify(nr));
      return nr;
    });
  }, []);

  const playAt = useCallback(
    (i: number) => {
      const q = queueRef.current;
      if (i < 0 || i >= q.length) return;
      setIndex(i);
      void loadAndPlay(q[i]);
    },
    [loadAndPlay],
  );

  const removeAt = useCallback((i: number) => {
    const q = queueRef.current;
    const cur = indexRef.current;
    if (i === cur) return; // keep the playing track
    const nq = q.filter((_, idx) => idx !== i);
    setQueue(nq);
    if (i < cur) setIndex(cur - 1);
  }, []);

  const playNext = useCallback(
    (track: TrackDto) => {
      const q = [...queueRef.current];
      const cur = indexRef.current;
      if (cur < 0) {
        playList([track], 0);
        return;
      }
      q.splice(cur + 1, 0, track);
      setQueue(q);
    },
    [playList],
  );

  const addToQueue = useCallback(
    (track: TrackDto) => {
      const q = [...queueRef.current];
      if (q.length === 0) {
        playList([track], 0);
        return;
      }
      q.push(track);
      setQueue(q);
    },
    [playList],
  );

  // Audio element events
  useEffect(() => {
    const onTime = () => setTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      const q = queueRef.current;
      const i = indexRef.current;
      if (repeat === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        return;
      }
      const atEnd = !shuffle && i === q.length - 1;
      if (atEnd && repeat === "off") {
        setPlaying(false);
        setTime(0);
        return;
      }
      next();
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audio, next, repeat, shuffle]);

  // Volume / mute
  useEffect(() => {
    audio.volume = muted ? 0 : volume;
  }, [audio, volume, muted]);

  // Media Session (lock screen / OS controls)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album ?? "WaveLocal",
    });
    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  }, [current, togglePlay, next, prev]);

  // Keyboard shortcuts (ignore while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (!currentRef.current) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        seek(audio.currentTime + 5);
      } else if (e.code === "ArrowLeft") {
        seek(audio.currentTime - 5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(volume + 0.05);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(volume - 0.05);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audio, togglePlay, seek, setVolume, volume]);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current,
      playing,
      loading,
      time,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      queueOpen,
      expanded,
      playList,
      playTrack,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      setQueueOpen,
      setExpanded,
      playAt,
      removeAt,
      playNext,
      addToQueue,
    }),
    [
      queue, index, current, playing, loading, time, duration, volume, muted,
      shuffle, repeat, queueOpen, expanded, playList, playTrack, togglePlay,
      next, prev, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat,
      playAt, removeAt, playNext, addToQueue,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
