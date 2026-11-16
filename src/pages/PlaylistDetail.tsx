import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Pencil, Play, Shuffle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/player/PlayerProvider";
import { TrackList } from "@/components/TrackList";
import { CoverArt, useCoverUrl } from "@/components/CoverArt";
import { formatTotal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const playlistId = Number(id);
  const navigate = useNavigate();
  const player = usePlayer();
  const utils = trpc.useUtils();
  const detail = trpc.library.playlistDetail.useQuery(
    { id: playlistId },
    { enabled: Number.isFinite(playlistId) && playlistId > 0 },
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const rename = trpc.library.renamePlaylist.useMutation({
    onSuccess: () => {
      void utils.library.playlists.invalidate();
      void utils.library.playlistDetail.invalidate({ id: playlistId });
      setEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const deletePlaylist = trpc.library.deletePlaylist.useMutation({
    onSuccess: () => {
      void utils.library.invalidate();
      toast.success("Playlist deleted");
      navigate("/library");
    },
    onError: (err) => toast.error(err.message),
  });

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Playlist not found</p>
        <button
          type="button"
          onClick={() => navigate("/library")}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to library
        </button>
      </div>
    );
  }

  const { playlist, tracks } = detail.data;
  const total = tracks.reduce((s, t) => s + t.durationSec, 0);

  const shufflePlay = () => {
    if (tracks.length === 0) return;
    player.playList(tracks, Math.floor(Math.random() * tracks.length));
    if (!player.shuffle) player.toggleShuffle();
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl p-6 md:p-10">
        <HeaderField coverKey={playlist.coverKey} />
        <div className="glass absolute inset-0 bg-background/40" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end">
          <CoverArt
            coverKey={playlist.coverKey}
            title={playlist.name}
            className="h-36 w-36 shrink-0 rounded-xl shadow-[0_16px_48px_rgb(0_0_0/0.45)] md:h-44 md:w-44"
            iconSize={48}
          />
          <div className="min-w-0">
            <p className="micro-label">Playlist</p>
            {editing ? (
              <div className="mt-1 flex items-center gap-2">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) rename.mutate({ id: playlistId, name: name.trim() });
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-11 max-w-xs text-xl font-bold"
                />
                <button
                  type="button"
                  aria-label="Save name"
                  disabled={!name.trim() || rename.isPending}
                  onClick={() => rename.mutate({ id: playlistId, name: name.trim() })}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight md:text-5xl">
                <span className="truncate">{playlist.name}</span>
                <button
                  type="button"
                  aria-label="Rename playlist"
                  onClick={() => {
                    setName(playlist.name);
                    setEditing(true);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil size={18} />
                </button>
              </h1>
            )}
            {playlist.description && (
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">{playlist.description}</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {tracks.length} tracks{tracks.length > 0 ? ` · ${formatTotal(total)}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={tracks.length === 0}
                onClick={() => player.playList(tracks, 0)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play size={16} className="fill-current" /> Play
              </button>
              <button
                type="button"
                disabled={tracks.length === 0}
                onClick={shufflePlay}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-accent/40 px-5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Shuffle size={16} /> Shuffle
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      </header>

      {tracks.length > 0 ? (
        <TrackList tracks={tracks} playlistId={playlistId} />
      ) : (
        <p className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Empty playlist — use the ⋯ menu on any track to add it here.
        </p>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{playlist.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The playlist will be removed. Your tracks stay in the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePlaylist.mutate({ id: playlistId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HeaderField({ coverKey }: { coverKey: string | null }) {
  const url = useCoverUrl(coverKey);
  return (
    <div
      className="cover-field"
      style={
        url
          ? { backgroundImage: `url(${url})` }
          : { background: "linear-gradient(135deg, hsl(145 70% 16%), hsl(200 60% 10%))" }
      }
      aria-hidden
    />
  );
}
