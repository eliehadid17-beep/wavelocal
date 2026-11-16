import { Link } from "react-router";
import { CloudUpload, Play } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/player/PlayerProvider";
import { greeting } from "@/lib/format";
import { TrackCard } from "@/components/TrackCard";
import { PlaylistCard } from "@/components/PlaylistCard";
import { CoverArt } from "@/components/CoverArt";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const player = usePlayer();
  const tracks = trpc.library.tracks.useQuery();
  const playlists = trpc.library.playlists.useQuery();
  const all = tracks.data ?? [];
  const quick = all.slice(0, 6);
  const mixes = playlists.data ?? [];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{greeting()}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Your personal library — local files only, zero copyright worries.
        </p>
      </section>

      {tracks.isLoading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!tracks.isLoading && all.length === 0 && (
        <section className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <CloudUpload className="h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">Your library is empty</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Upload your own music or royalty-free tracks to start listening.
          </p>
          <Link
            to="/upload"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Upload music
          </Link>
        </section>
      )}

      {quick.length > 0 && (
        <section>
          <h2 className="micro-label mb-3">Quick picks</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quick.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => player.playTrack(t, all)}
                className="group flex items-center gap-3 overflow-hidden rounded-xl bg-accent/40 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CoverArt
                  coverKey={t.coverKey}
                  title={t.title}
                  className="h-14 w-14 shrink-0"
                  iconSize={18}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
                </span>
                <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Play size={15} className="ml-0.5 fill-current" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {mixes.length > 0 && (
        <section>
          <h2 className="micro-label mb-3">Mixes</h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-1 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:px-0 xl:grid-cols-5">
            {mixes.map((pl) => (
              <div key={pl.id} className="w-40 shrink-0 snap-start md:w-auto">
                <PlaylistCard playlist={pl} />
              </div>
            ))}
          </div>
        </section>
      )}

      {all.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="micro-label">All tracks</h2>
            <span className="text-xs text-muted-foreground">{all.length} tracks</span>
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {all.map((t) => (
              <TrackCard key={t.id} track={t} contextQueue={all} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
