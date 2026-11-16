import { Heart, Play, Shuffle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/player/PlayerProvider";
import { TrackList } from "@/components/TrackList";
import { formatTotal } from "@/lib/format";

export default function Liked() {
  const player = usePlayer();
  const favorites = trpc.library.favoriteTracks.useQuery();
  const tracks = favorites.data ?? [];
  const total = tracks.reduce((s, t) => s + t.durationSec, 0);

  const shufflePlay = () => {
    if (tracks.length === 0) return;
    const start = Math.floor(Math.random() * tracks.length);
    player.playList(tracks, start);
    if (!player.shuffle) player.toggleShuffle();
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl p-6 md:p-10">
        <div
          className="cover-field"
          style={{
            background:
              "linear-gradient(135deg, hsl(145 80% 18%), hsl(190 70% 12%))",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end">
          <span className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-primary/20 shadow-[0_16px_48px_rgb(0_0_0/0.45)] md:h-44 md:w-44">
            <Heart className="h-16 w-16 fill-primary text-primary" />
          </span>
          <div>
            <p className="micro-label">Playlist</p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">Liked Songs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tracks.length} tracks{tracks.length > 0 ? ` · ${formatTotal(total)}` : ""}
            </p>
            {tracks.length > 0 && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => player.playList(tracks, 0)}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Play size={16} className="fill-current" /> Play
                </button>
                <button
                  type="button"
                  onClick={shufflePlay}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-accent/40 px-5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Shuffle size={16} /> Shuffle
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {tracks.length > 0 ? (
        <TrackList tracks={tracks} />
      ) : (
        <p className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Tap the heart on any track and it will show up here.
        </p>
      )}
    </div>
  );
}
