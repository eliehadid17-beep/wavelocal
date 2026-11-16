import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TrackList } from "@/components/TrackList";
import { Input } from "@/components/ui/input";

export default function Search() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const all = trpc.library.tracks.useQuery();
  const results = trpc.library.search.useQuery(
    { q: debounced },
    { enabled: debounced.length > 0 },
  );

  const artists = useMemo(() => {
    const set = new Map<string, number>();
    for (const t of all.data ?? []) set.set(t.artist, (set.get(t.artist) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [all.data]);

  return (
    <div className="space-y-8">
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Songs, artists, albums…"
          aria-label="Search your library"
          className="h-13 h-[52px] rounded-full border-border bg-accent/40 pl-12 text-base focus-visible:ring-primary"
        />
      </div>

      {debounced.length === 0 && (
        <section>
          <h2 className="micro-label mb-3">Browse artists</h2>
          {artists.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to search yet — upload some music first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {artists.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setQ(name)}
                  className="rounded-full border border-border bg-accent/30 px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {name}
                  <span className="ml-2 text-xs text-muted-foreground">{count}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {debounced.length > 0 && (
        <section>
          <h2 className="micro-label mb-3">
            {results.isLoading
              ? "Searching…"
              : `${results.data?.length ?? 0} result${(results.data?.length ?? 0) === 1 ? "" : "s"} for “${debounced}”`}
          </h2>
          {results.data && results.data.length > 0 && (
            <TrackList tracks={results.data} numbered={false} />
          )}
          {results.data?.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No matches in your library. Try a different spelling — or upload it.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
