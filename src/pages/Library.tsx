import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TrackList } from "@/components/TrackList";
import { PlaylistCard, CreatePlaylistDialog } from "@/components/PlaylistCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TABS = ["playlists", "tracks", "uploads"] as const;
type Tab = (typeof TABS)[number];

export default function Library() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "playlists";
  const [createOpen, setCreateOpen] = useState(false);

  const tracks = trpc.library.tracks.useQuery();
  const playlists = trpc.library.playlists.useQuery();
  const uploads = useMemo(
    () => (tracks.data ?? []).filter((t) => t.source === "upload"),
    [tracks.data],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Your Library</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => setParams({ tab: v }, { replace: true })}
      >
        <TabsList className="bg-accent/40">
          <TabsTrigger value="playlists">Playlists</TabsTrigger>
          <TabsTrigger value="tracks">All tracks</TabsTrigger>
          <TabsTrigger value="uploads">My uploads</TabsTrigger>
        </TabsList>

        <TabsContent value="playlists" className="mt-6">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                <Plus size={22} />
              </span>
              <span className="text-sm font-medium">New playlist</span>
            </button>
            {(playlists.data ?? []).map((pl) => (
              <PlaylistCard key={pl.id} playlist={pl} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tracks" className="mt-6">
          {tracks.data && tracks.data.length > 0 ? (
            <TrackList tracks={tracks.data} />
          ) : (
            <EmptyNote text="No tracks yet — upload your first song." />
          )}
        </TabsContent>

        <TabsContent value="uploads" className="mt-6">
          {uploads.length > 0 ? (
            <TrackList tracks={uploads} />
          ) : (
            <EmptyNote text="You haven't uploaded anything yet." />
          )}
        </TabsContent>
      </Tabs>

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function EmptyNote({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground", className)}>
      {text}
    </p>
  );
}
