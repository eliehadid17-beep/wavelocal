import { useState } from "react";
import {
  Heart,
  ListPlus,
  ListMusic,
  MoreVertical,
  Music4,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/player/PlayerProvider";
import type { TrackDto } from "@contracts/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { CoverArt } from "@/components/CoverArt";

export function FavoriteButton({
  trackId,
  favoriteIds,
  size = 18,
  className,
}: {
  trackId: number;
  favoriteIds?: Set<number>;
  size?: number;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const toggle = trpc.library.toggleFavorite.useMutation({
    onSuccess: () => {
      void utils.library.favoriteIds.invalidate();
      void utils.library.favoriteTracks.invalidate();
    },
  });
  const active = favoriteIds?.has(trackId) ?? false;
  return (
    <button
      type="button"
      aria-label={active ? "Remove from Liked Songs" : "Add to Liked Songs"}
      onClick={(e) => {
        e.stopPropagation();
        toggle.mutate({ trackId });
      }}
      className={
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (className ?? "")
      }
    >
      <Heart
        size={size}
        className={active ? "fill-primary text-primary" : ""}
        strokeWidth={active ? 0 : 2}
      />
    </button>
  );
}

export function TrackMenu({
  track,
  playlistId,
  triggerClassName,
}: {
  track: TrackDto;
  playlistId?: number;
  triggerClassName?: string;
}) {
  const utils = trpc.useUtils();
  const player = usePlayer();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const removeFromPlaylist = trpc.library.removeFromPlaylist.useMutation({
    onSuccess: () => {
      void utils.library.playlistDetail.invalidate({ id: playlistId! });
      void utils.library.playlists.invalidate();
      toast.success("Removed from playlist");
    },
  });

  const deleteTrack = trpc.library.deleteTrack.useMutation({
    onSuccess: () => {
      void utils.library.invalidate();
      toast.success(`Deleted "${track.title}"`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More options for ${track.title}`}
            onClick={(e) => e.stopPropagation()}
            className={
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (triggerClassName ?? "")
            }
          >
            <MoreVertical size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onSelect={() => {
              player.playNext(track);
              toast.success(`"${track.title}" will play next`);
            }}
          >
            <Play className="mr-2 h-4 w-4" /> Play next
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              player.addToQueue(track);
              toast.success(`Added "${track.title}" to queue`);
            }}
          >
            <ListPlus className="mr-2 h-4 w-4" /> Add to queue
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPlaylistOpen(true)}>
            <ListMusic className="mr-2 h-4 w-4" /> Add to playlist
          </DropdownMenuItem>
          {playlistId != null && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => removeFromPlaylist.mutate({ playlistId, trackId: track.id })}
              >
                <X className="mr-2 h-4 w-4" /> Remove from this playlist
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete from library
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddToPlaylistDialog track={track} open={playlistOpen} onOpenChange={setPlaylistOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{track.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The audio file will be removed from your library and all playlists. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTrack.mutate({ id: track.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AddToPlaylistDialog({
  track,
  open,
  onOpenChange,
}: {
  track: TrackDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [newName, setNewName] = useState("");
  const playlists = trpc.library.playlists.useQuery(undefined, { enabled: open });
  const addTo = trpc.library.addToPlaylist.useMutation({
    onSuccess: (res) => {
      void utils.library.playlists.invalidate();
      void utils.library.playlistDetail.invalidate();
      toast.success(res.added ? `Added to playlist` : `Already in that playlist`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const create = trpc.library.createPlaylist.useMutation({
    onSuccess: (pl) => {
      void utils.library.playlists.invalidate();
      addTo.mutate({ playlistId: pl.id, trackId: track.id });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
          <DialogDescription className="truncate">
            {track.title} — {track.artist}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                create.mutate({ name: newName.trim() });
                setNewName("");
              }
            }}
          />
          <Button
            disabled={!newName.trim() || create.isPending}
            onClick={() => {
              create.mutate({ name: newName.trim() });
              setNewName("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Create
          </Button>
        </div>
        <div className="thin-scroll max-h-64 space-y-1 overflow-y-auto">
          {(playlists.data ?? []).map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => addTo.mutate({ playlistId: pl.id, trackId: track.id })}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CoverArt
                coverKey={pl.coverKey}
                title={pl.name}
                className="h-10 w-10 rounded-md"
                iconSize={16}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{pl.name}</span>
                <span className="micro-label">{pl.trackCount} tracks</span>
              </span>
              <Music4 className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {playlists.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No playlists yet — create one above.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
