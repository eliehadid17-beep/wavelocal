import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, CloudUpload, ImagePlus, Loader2, Music2, ShieldCheck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { AUDIO_EXTENSIONS, MAX_UPLOAD_BYTES } from "@contracts/types";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PendingItem {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  coverFile: File | null;
  coverPreview: string | null;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
}

let uid = 0;

function isAudio(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.includes(ext);
}

function parseName(filename: string): { title: string; artist: string } {
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { title: base.trim() || filename, artist: "Unknown Artist" };
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Upload() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = trpc.library.uploadTrack.useMutation();

  const addFiles = async (list: FileList | File[]) => {
    const files = [...list].filter(isAudio);
    if (files.length === 0) {
      toast.error("No audio files found — mp3, wav, ogg, m4a or flac please.");
      return;
    }
    const accepted: PendingItem[] = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" is over the 30 MB limit — skipped.`);
        continue;
      }
      const { title, artist } = parseName(file.name);
      const durationSec = await readDuration(file);
      accepted.push({
        id: `${Date.now()}-${uid++}`,
        file,
        title,
        artist,
        album: "",
        durationSec,
        coverFile: null,
        coverPreview: null,
        status: "ready",
      });
    }
    setItems((prev) => [...prev, ...accepted]);
  };

  const updateItem = (id: string, patch: Partial<PendingItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const uploadAll = async () => {
    const pending = items.filter((it) => it.status === "ready" || it.status === "error");
    if (pending.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const item of pending) {
      updateItem(item.id, { status: "uploading" });
      try {
        const audioBase64 = await toBase64(item.file);
        let cover: { name: string; contentBase64: string; contentType?: string } | undefined;
        if (item.coverFile) {
          cover = {
            name: item.coverFile.name,
            contentBase64: await toBase64(item.coverFile),
            contentType: item.coverFile.type || "image/png",
          };
        }
        await upload.mutateAsync({
          title: item.title.trim() || item.file.name,
          artist: item.artist.trim() || "Unknown Artist",
          album: item.album.trim() || undefined,
          durationSec: item.durationSec,
          audioName: item.file.name,
          audioBase64,
          audioType: item.file.type || "audio/mpeg",
          cover,
        });
        ok++;
        updateItem(item.id, { status: "done" });
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
    setBusy(false);
    void utils.library.invalidate();
    if (ok > 0) {
      toast.success(ok === 1 ? "1 track added to your library" : `${ok} tracks added to your library`);
      setItems((prev) => prev.filter((it) => it.status !== "done"));
      navigate("/library?tab=tracks");
    }
  };

  const readyCount = items.filter((it) => it.status === "ready" || it.status === "error").length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Upload music</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Add your own recordings or royalty-free tracks. Files are stored in your
          library — nothing is shared or streamed from third parties.
        </p>
      </header>

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose audio files to upload"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent/30",
        )}
      >
        <CloudUpload className={cn("h-12 w-12", dragOver ? "text-primary" : "text-muted-foreground")} />
        <p className="mt-4 text-lg font-semibold">Drop audio files here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse — mp3, wav, ogg, m4a, flac · up to 30 MB each
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <section className="space-y-3">
          <h2 className="micro-label">Ready to upload ({items.length})</h2>
          {items.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              onChange={(patch) => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              {readyCount} track{readyCount === 1 ? "" : "s"} pending
            </p>
            <Button
              size="lg"
              disabled={busy || readyCount === 0}
              onClick={() => void uploadAll()}
              className="rounded-full px-8"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                "Upload to library"
              )}
            </Button>
          </div>
        </section>
      )}

      <aside className="flex gap-3 rounded-xl border border-border bg-accent/20 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Copyright-friendly by design:</span>{" "}
          WaveLocal only plays files you put in it. Upload music you own, made yourself, or
          that's royalty-free / Creative Commons — never ripped commercial tracks.
        </p>
      </aside>
    </div>
  );
}

function UploadRow({
  item,
  onChange,
  onRemove,
}: {
  item: PendingItem;
  onChange: (patch: Partial<PendingItem>) => void;
  onRemove: () => void;
}) {
  const coverInput = useRef<HTMLInputElement>(null);
  const disabled = item.status === "uploading" || item.status === "done";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center",
        item.status === "done" && "border-primary/50",
        item.status === "error" && "border-destructive/60",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Pick cover image"
          disabled={disabled}
          onClick={() => coverInput.current?.click()}
          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.coverPreview ? (
            <img src={item.coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onChange({ coverFile: f, coverPreview: URL.createObjectURL(f) });
              }
              e.target.value = "";
            }}
          />
        </button>
        <div className="min-w-0 sm:hidden">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDuration(item.durationSec)} · {(item.file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_1.5fr]">
        <Input
          value={item.title}
          disabled={disabled}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
          aria-label="Track title"
        />
        <Input
          value={item.artist}
          disabled={disabled}
          onChange={(e) => onChange({ artist: e.target.value })}
          placeholder="Artist"
          aria-label="Artist"
        />
        <Input
          value={item.album}
          disabled={disabled}
          onChange={(e) => onChange({ album: e.target.value })}
          placeholder="Album (optional)"
          aria-label="Album"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
        {item.status === "uploading" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {item.status === "done" && <CheckCircle2 className="h-5 w-5 text-primary" />}
        {item.status === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive" title={item.error}>
            <XCircle className="h-5 w-5" /> Retry
          </span>
        )}
        {item.status === "ready" && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Music2 className="h-4 w-4" />
            {(item.file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        )}
        <button
          type="button"
          aria-label="Remove from upload list"
          disabled={item.status === "uploading"}
          onClick={onRemove}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
