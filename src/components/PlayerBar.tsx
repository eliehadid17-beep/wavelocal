import {
  ChevronDown,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { usePlayer } from "@/player/PlayerProvider";
import { trpc } from "@/providers/trpc";
import { formatDuration } from "@/lib/format";
import { CoverArt, useCoverUrl } from "@/components/CoverArt";
import { FavoriteButton, TrackMenu } from "@/components/TrackMenu";
import { SeekBar } from "@/components/SeekBar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function RepeatIcon({ repeat }: { repeat: "off" | "all" | "one" }) {
  if (repeat === "one") return <Repeat1 size={18} />;
  return <Repeat size={18} />;
}

function VolumeControl({ className }: { className?: string }) {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={toggleMute}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>
      <Slider
        value={[Math.round((muted ? 0 : volume) * 100)]}
        max={100}
        step={1}
        aria-label="Volume"
        onValueChange={([v]) => setVolume(v / 100)}
        className="w-24"
      />
    </div>
  );
}

export function PlayerBar() {
  const player = usePlayer();
  const favorites = trpc.library.favoriteIds.useQuery();
  const favIds = new Set(favorites.data ?? []);
  const { current } = player;
  if (!current) return null;
  const dur = player.duration || current.durationSec || 0;

  return (
    <>
      {/* Desktop player */}
      <div className="glass fixed inset-x-0 bottom-0 z-40 hidden border-t border-border md:block">
        <SeekBar
          slim
          value={player.time}
          max={dur}
          onSeek={player.seek}
          className="absolute inset-x-0 top-0 -translate-y-1/2"
        />
        <div className="grid h-[84px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <CoverArt
              coverKey={current.coverKey}
              title={current.title}
              className="h-13 w-13 h-[52px] w-[52px] shrink-0 rounded-md"
              iconSize={18}
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{current.title}</p>
              <p className="truncate text-[13px] text-muted-foreground">{current.artist}</p>
            </div>
            <FavoriteButton trackId={current.id} favoriteIds={favIds} />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Shuffle"
              onClick={player.toggleShuffle}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                player.shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Shuffle size={18} />
            </button>
            <button
              type="button"
              aria-label="Previous track"
              onClick={player.prev}
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SkipBack size={21} className="fill-current" />
            </button>
            <button
              type="button"
              aria-label={player.playing ? "Pause" : "Play"}
              onClick={player.togglePlay}
              className="mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_rgb(0_255_102/0.25)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {player.playing ? (
                <Pause size={21} className="fill-current" />
              ) : (
                <Play size={21} className="ml-0.5 fill-current" />
              )}
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={player.next}
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SkipForward size={21} className="fill-current" />
            </button>
            <button
              type="button"
              aria-label={`Repeat: ${player.repeat}`}
              onClick={player.cycleRepeat}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                player.repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RepeatIcon repeat={player.repeat} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-1">
            <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">
              {formatDuration(player.time)}
            </span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="w-11 text-xs tabular-nums text-muted-foreground">
              {formatDuration(dur)}
            </span>
            <button
              type="button"
              aria-label="Toggle queue"
              onClick={() => player.setQueueOpen(!player.queueOpen)}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                player.queueOpen ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListMusic size={19} />
            </button>
            <VolumeControl />
          </div>
        </div>
      </div>

      {/* Mobile mini player */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Now playing: ${current.title}. Tap to expand.`}
        onClick={() => player.setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") player.setExpanded(true);
        }}
        className="glass fixed inset-x-2 z-40 flex h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border/60 pr-1 shadow-[0_8px_24px_rgb(0_0_0/0.5)] md:hidden"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-[2px] bg-secondary"
          aria-hidden
        >
          <div
            className="h-full bg-primary"
            style={{ width: `${dur > 0 ? (player.time / dur) * 100 : 0}%` }}
          />
        </div>
        <CoverArt
          coverKey={current.coverKey}
          title={current.title}
          className="h-full w-14 shrink-0"
          iconSize={18}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{current.title}</p>
          <p className="truncate text-xs text-muted-foreground">{current.artist}</p>
        </div>
        <button
          type="button"
          aria-label={player.playing ? "Pause" : "Play"}
          onClick={(e) => {
            e.stopPropagation();
            player.togglePlay();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {player.playing ? <Pause size={22} className="fill-current" /> : <Play size={22} className="ml-0.5 fill-current" />}
        </button>
        <button
          type="button"
          aria-label="Next track"
          onClick={(e) => {
            e.stopPropagation();
            player.next();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SkipForward size={20} className="fill-current" />
        </button>
      </div>
    </>
  );
}

/** Full-screen now-playing overlay (primarily mobile). */
export function FullScreenPlayer() {
  const player = usePlayer();
  const favorites = trpc.library.favoriteIds.useQuery();
  const favIds = new Set(favorites.data ?? []);
  const { current, expanded } = player;
  const coverUrl = useCoverUrl(current?.coverKey);
  if (!current) return null;
  const dur = player.duration || current.durationSec || 0;

  return (
    <div
      aria-hidden={!expanded}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-300 ease-out",
        expanded ? "translate-y-0" : "pointer-events-none invisible translate-y-full",
      )}
    >
      {coverUrl && (
        <div className="cover-field" style={{ backgroundImage: `url(${coverUrl})` }} aria-hidden />
      )}
      <div className="glass absolute inset-0 bg-background/60" aria-hidden />

      <div
        className="relative flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          aria-label="Close player"
          onClick={() => player.setExpanded(false)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown size={24} />
        </button>
        <span className="micro-label">Now playing</span>
        <button
          type="button"
          aria-label="Toggle queue"
          onClick={() => player.setQueueOpen(!player.queueOpen)}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            player.queueOpen ? "text-primary" : "text-foreground hover:bg-accent",
          )}
        >
          <ListMusic size={20} />
        </button>
      </div>

      <div className="thin-scroll relative flex flex-1 flex-col overflow-y-auto px-6 pb-8">
        {player.queueOpen ? (
          <QueueView />
        ) : (
          <>
            <div className="flex flex-1 items-center justify-center py-4">
              <CoverArt
                coverKey={current.coverKey}
                title={current.title}
                className="aspect-square w-[min(78vw,380px)] rounded-2xl shadow-[0_24px_64px_rgb(0_0_0/0.55)]"
                iconSize={64}
              />
            </div>
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold">{current.title}</h2>
                  <p className="mt-0.5 truncate text-base text-muted-foreground">
                    {current.artist}
                    {current.album ? ` · ${current.album}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <FavoriteButton trackId={current.id} favoriteIds={favIds} size={22} />
                  <TrackMenu track={current} triggerClassName="text-foreground/80" />
                </div>
              </div>

              <div className="mt-5">
                <SeekBar value={player.time} max={dur} onSeek={player.seek} />
                <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
                  <span>{formatDuration(player.time)}</span>
                  <span>{formatDuration(dur)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Shuffle"
                  onClick={player.toggleShuffle}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    player.shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Shuffle size={21} />
                </button>
                <button
                  type="button"
                  aria-label="Previous track"
                  onClick={player.prev}
                  className="flex h-14 w-14 items-center justify-center rounded-full text-foreground transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SkipBack size={30} className="fill-current" />
                </button>
                <button
                  type="button"
                  aria-label={player.playing ? "Pause" : "Play"}
                  onClick={player.togglePlay}
                  className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_28px_rgb(0_255_102/0.3)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {player.playing ? (
                    <Pause size={30} className="fill-current" />
                  ) : (
                    <Play size={30} className="ml-1 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Next track"
                  onClick={player.next}
                  className="flex h-14 w-14 items-center justify-center rounded-full text-foreground transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SkipForward size={30} className="fill-current" />
                </button>
                <button
                  type="button"
                  aria-label={`Repeat: ${player.repeat}`}
                  onClick={player.cycleRepeat}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    player.repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <RepeatIcon repeat={player.repeat} />
                </button>
              </div>

              <div className="mt-5 flex justify-center">
                <VolumeControl />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QueueView() {
  return (
    <div className="mx-auto w-full max-w-md flex-1">
      <h3 className="micro-label mb-3 mt-2">Up next</h3>
      <QueueList />
    </div>
  );
}

export function QueueList() {
  const player = usePlayer();
  return (
    <div className="space-y-0.5 pb-6">
      {player.queue.map((track, i) => {
        const active = i === player.index;
        return (
          <div
            key={`${track.id}-${i}`}
            role="button"
            tabIndex={0}
            aria-label={`Play ${track.title}`}
            onClick={() => player.playAt(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter") player.playAt(i);
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors",
              "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-accent/40",
            )}
          >
            <CoverArt
              coverKey={track.coverKey}
              title={track.title}
              className="h-10 w-10 shrink-0 rounded-md"
              iconSize={14}
            />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-medium", active && "text-primary")}>
                {track.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDuration(track.durationSec)}
            </span>
            {!active && (
              <button
                type="button"
                aria-label={`Remove ${track.title} from queue`}
                onClick={(e) => {
                  e.stopPropagation();
                  player.removeAt(i);
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={16} />
              </button>
            )}
          </div>
        );
      })}
      {player.queue.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing queued — play something!
        </p>
      )}
    </div>
  );
}

/** Desktop slide-over queue panel. */
export function QueuePanel() {
  const player = usePlayer();
  if (!player.current || !player.queueOpen) return null;
  return (
    <aside className="glass fixed bottom-[84px] right-0 top-0 z-30 hidden w-80 flex-col border-l border-border md:flex">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h2 className="text-sm font-semibold">Up next</h2>
        <button
          type="button"
          aria-label="Close queue"
          onClick={() => player.setQueueOpen(false)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={18} />
        </button>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto p-2">
        <QueueList />
      </div>
    </aside>
  );
}
