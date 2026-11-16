import { Music2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { hashHue } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Resolve a storage key to a playable/viewable URL (presigned or local). */
export function useCoverUrl(key?: string | null): string | undefined {
  const q = trpc.library.fileUrl.useQuery(
    { key: key ?? "" },
    { enabled: !!key, staleTime: 8 * 60_000, gcTime: 30 * 60_000 },
  );
  return key ? q.data?.url : undefined;
}

export function CoverArt({
  coverKey,
  title,
  className,
  iconSize = 22,
}: {
  coverKey?: string | null;
  title: string;
  className?: string;
  iconSize?: number;
}) {
  const url = useCoverUrl(coverKey);
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        loading="lazy"
        draggable={false}
        className={cn("select-none object-cover", className)}
      />
    );
  }
  const hue = hashHue(title || "wavelocal");
  return (
    <div
      aria-hidden
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 16%), hsl(${(hue + 50) % 360} 60% 9%))`,
      }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(circle at 30% 25%, hsl(${hue} 90% 45% / 0.35), transparent 60%)`,
        }}
      />
      <Music2 size={iconSize} className="relative text-white/50" />
    </div>
  );
}
