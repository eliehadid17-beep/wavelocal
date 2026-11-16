import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import { PlayerProvider } from "@/player/PlayerProvider";
import { AppSidebar } from "@/components/AppSidebar";
import { PlayerBar, FullScreenPlayer, QueuePanel } from "@/components/PlayerBar";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import Library from "@/pages/Library";
import Liked from "@/pages/Liked";
import PlaylistDetail from "@/pages/PlaylistDetail";
import Upload from "@/pages/Upload";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <PlayerProvider>
      <div className="min-h-dvh">
        <AppSidebar />
        <main className="px-4 pb-40 pt-4 md:px-8 md:pb-32 md:pl-[17rem] md:pt-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/liked" element={<Liked />} />
            <Route path="/playlist/:id" element={<PlaylistDetail />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <PlayerBar />
        <QueuePanel />
        <FullScreenPlayer />
        <Toaster theme="dark" position="top-center" richColors />
      </div>
    </PlayerProvider>
  );
}
