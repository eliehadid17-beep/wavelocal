import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Heart, Home, Library, Plus, Search, UploadCloud } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CreatePlaylistDialog } from "@/components/PlaylistCard";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/upload", label: "Upload", icon: UploadCloud },
];

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      <img src="/icons/icon.svg" alt="WaveLocal logo" className="h-8 w-8 rounded-lg" />
      {!compact && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Wave<span className="text-primary">Local</span>
        </span>
      )}
    </Link>
  );
}

export function AppSidebar() {
  const [createOpen, setCreateOpen] = useState(false);
  const playlists = trpc.library.playlists.useQuery();
  const location = useLocation();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-5 pb-2 pt-5">
          <Brand />
        </div>
        <nav className="mt-2 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-sidebar-accent text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/liked"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )
            }
          >
            <Heart size={19} className={location.pathname === "/liked" ? "fill-primary text-primary" : ""} />
            Liked Songs
          </NavLink>
        </nav>

        <div className="mt-6 flex items-center justify-between px-5">
          <span className="micro-label">Playlists</span>
          <button
            type="button"
            aria-label="Create playlist"
            onClick={() => setCreateOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="thin-scroll mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {(playlists.data ?? []).map((pl) => (
            <NavLink
              key={pl.id}
              to={`/playlist/${pl.id}`}
              className={({ isActive }) =>
                cn(
                  "block truncate rounded-lg px-3 py-2 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-sidebar-accent text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )
              }
            >
              {pl.name}
            </NavLink>
          ))}
          {playlists.data?.length === 0 && (
            <p className="px-3 py-2 text-xs text-sidebar-foreground/70">
              No playlists yet
            </p>
          )}
        </div>
        <p className="border-t border-sidebar-border px-5 py-4 text-[11px] leading-relaxed text-sidebar-foreground/70">
          Your files stay on this machine. No copyright strikes, no tracking.
        </p>
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <Brand />
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            <Icon size={21} />
            {label}
          </NavLink>
        ))}
      </nav>

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
