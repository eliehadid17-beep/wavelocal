import { Play } from "lucide-react";
import { usePlayer } from "@/player/PlayerProvider";
import type { TrackDto } from "@contracts/types";
import { CoverArt } from "@/components/CoverArt";
import { TrackMenu } from "@/components/TrackMenu";
import { PlayingIndicator } from "@/components/TrackList";
import { cn } from "@/lib/utils";

export function TrackCard({
  track,
  contextQueue,
}: {
  track: TrackDto;
  contextQueue?: TrackDto[];
}) {
  const player = usePlayer();
  const active = player.current?.id === track.id;
  const queue = contextQueue ?? [track];
  return (
    <div
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
      className="group cursor-pointer rounded-xl p-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative overflow-hidden rounded-lg shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
        <CoverArt
          coverKey={track.coverKey}
          title={track.title}
          className="aspect-square w-full transition-transform duration-300 group-hover:scale-105"
          iconSize={34}
        />
        <span
          className={cn(
            "absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200",
            active
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
          )}
        >
          {active ? <PlayingIndicator /> : <Play size={18} className="ml-0.5 fill-current" />}
        </span>
        <span
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <TrackMenu track={track} triggerClassName="bg-black/50 text-white hover:bg-black/70" />
        </span>
      </div>
      <p
        className={cn(
          "mt-2.5 truncate text-[15px] font-semibold",
          active ? "text-primary" : "text-foreground",
        )}
      >
        {track.title}
      </p>
      <p className="truncate text-[13px] text-muted-foreground">
        {track.artist}
        {track.album ? ` · ${track.album}` : ""}
      </p>
    </div>
  );
}
