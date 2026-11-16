import { useState } from "react";
import { useNavigate } from "react-router";
import { ListMusic, Play } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/player/PlayerProvider";
import type { PlaylistSummaryDto } from "@contracts/types";
import { CoverArt } from "@/components/CoverArt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function PlaylistCard({ playlist }: { playlist: PlaylistSummaryDto }) {
  const navigate = useNavigate();
  const player = usePlayer();
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);

  const playAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const detail = await utils.library.playlistDetail.fetch({ id: playlist.id });
      if (detail.tracks.length > 0) player.playList(detail.tracks, 0);
      else toast.info("This playlist is empty");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open playlist ${playlist.name}`}
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/playlist/${playlist.id}`);
        }
      }}
      className="group cursor-pointer rounded-xl p-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative overflow-hidden rounded-lg shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
        <CoverArt
          coverKey={playlist.coverKey}
          title={playlist.name}
          className="aspect-square w-full transition-transform duration-300 group-hover:scale-105"
          iconSize={34}
        />
        <button
          type="button"
          aria-label={`Play ${playlist.name}`}
          disabled={loading}
          onClick={playAll}
          className="absolute bottom-2 right-2 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-200 hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Play size={18} className="ml-0.5 fill-current" />
        </button>
      </div>
      <p className="mt-2.5 truncate text-[15px] font-semibold">{playlist.name}</p>
      <p className="micro-label mt-0.5">{playlist.trackCount} tracks</p>
    </div>
  );
}

export function CreatePlaylistDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = trpc.library.createPlaylist.useMutation({
    onSuccess: (pl) => {
      void utils.library.playlists.invalidate();
      toast.success(`Playlist "${pl.name}" created`);
      onOpenChange(false);
      setName("");
      setDescription("");
      navigate(`/playlist/${pl.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" /> New playlist
          </DialogTitle>
          <DialogDescription>Give your mix a name. You can add tracks later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) create.mutate({ name: name.trim(), description: description.trim() || undefined });
            }}
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            maxLength={400}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate({ name: name.trim(), description: description.trim() || undefined })}
          >
            {create.isPending ? "Creating…" : "Create playlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
