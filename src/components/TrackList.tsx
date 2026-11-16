import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/player/PlayerProvider";
import type { TrackDto } from "@contracts/types";
import { formatDuration } from "@/lib/format";
import { CoverArt } from "@/components/CoverArt";
import { FavoriteButton, TrackMenu } from "@/components/TrackMenu";
import { cn } from "@/lib/utils";

export function PlayingIndicator({ className }: { className?: string }) {
  const { playing } = usePlayer();
  return (
    <span className={cn("eq", !playing && "paused", className)} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

export function TrackList({
  tracks,
  contextQueue,
  playlistId,
  numbered = true,
}: {
  tracks: TrackDto[];
  contextQueue?: TrackDto[];
  playlistId?: number;
  numbered?: boolean;
}) {
  const player = usePlayer();
  const favorites = trpc.library.favoriteIds.useQuery();
  const favIds = new Set(favorites.data ?? []);
  const queue = contextQueue ?? tracks;

  return (
    <div className="w-full">
      {tracks.map((track, i) => {
        const active = player.current?.id === track.id;
        return (
          <div
            key={`${track.id}-${i}`}
            role="button"
            tabIndex={0}
            aria-label={`Play ${track.title} by ${track.artist}`}
            onClick={() => player.playTrack(track, queue)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                player.playTrack(track, queue);
              }
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors",
              "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-accent/40",
            )}
          >
            {numbered && (
              <span className="flex w-6 shrink-0 items-center justify-center text-sm text-muted-foreground">
                {active ? <PlayingIndicator /> : <span>{i + 1}</span>}
              </span>
            )}
            <CoverArt
              coverKey={track.coverKey}
              title={track.title}
              className="h-11 w-11 shrink-0 rounded-md"
              iconSize={16}
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[15px] font-medium",
                  active ? "text-primary" : "text-foreground",
                )}
              >
                {track.title}
              </span>
              <span className="block truncate text-[13px] text-muted-foreground">
                {track.artist}
              </span>
            </span>
            <span className="hidden w-40 truncate text-[13px] text-muted-foreground lg:block">
              {track.album ?? "—"}
            </span>
            <span className="hidden w-12 text-right text-[13px] tabular-nums text-muted-foreground sm:block">
              {formatDuration(track.durationSec)}
            </span>
            <span className="flex shrink-0 items-center">
              <FavoriteButton trackId={track.id} favoriteIds={favIds} />
              <TrackMenu track={track} playlistId={playlistId} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
