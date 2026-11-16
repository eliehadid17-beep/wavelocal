import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Click/drag seek or progress bar. */
export function SeekBar({
  value,
  max,
  onSeek,
  className,
  slim = false,
}: {
  value: number;
  max: number;
  onSeek?: (sec: number) => void;
  className?: string;
  slim?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ratio = max > 0 ? Math.min(1, value / max) : 0;

  const seekFromEvent = (clientX: number) => {
    if (!onSeek || !ref.current || max <= 0) return;
    const rect = ref.current.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(r * max);
  };

  return (
    <div
      ref={ref}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Seek" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? Math.round(max) : undefined}
      aria-valuenow={onSeek ? Math.round(value) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(max, value + 5));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, value - 5));
      }}
      onPointerDown={(e) => {
        if (!onSeek) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => {
        if (onSeek && e.buttons === 1) seekFromEvent(e.clientX);
      }}
      className={cn(
        "group/seek relative w-full cursor-pointer touch-none",
        slim ? "h-1" : "h-4",
        !onSeek && "pointer-events-none",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-secondary",
          slim ? "h-[3px]" : "h-1",
        )}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-100"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {onSeek && !slim && (
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
          style={{ left: `${ratio * 100}%` }}
        />
      )}
    </div>
  );
}
