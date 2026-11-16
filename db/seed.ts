import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "../api/queries/connection";
import { favorites, playlistTracks, playlists, tracks } from "./schema";
import { putFile } from "../api/lib/filestore";

interface SeedMeta {
  tracks: Array<{
    title: string;
    artist: string;
    album: string;
    durationSec: number;
    audioFile: string;
    coverFile: string;
  }>;
  mixes: Array<{ name: string; description: string; coverFile: string }>;
}

const ASSETS = path.resolve(process.cwd(), "seed-assets");

/** Which demo tracks go into each seeded mix (by index in meta.tracks). */
const MIX_TRACKS: number[][] = [
  [3, 5, 1, 0], // Late Night Focus: Slow Waves, Aurora, Neon Rain, Midnight Drive
  [4, 2, 0, 5], // Morning Energy: Night Market, Desert Bloom, Midnight Drive, Aurora
  [2, 1, 4, 3], // Desert Nights: Desert Bloom, Neon Rain, Night Market, Slow Waves
];

async function seed() {
  const db = getDb();
  const existing = await db.select({ id: tracks.id }).from(tracks).limit(1);
  if (existing.length > 0) {
    console.log("Tracks already exist — skipping seed.");
    process.exit(0);
  }

  const meta: SeedMeta = JSON.parse(
    await fs.readFile(path.join(ASSETS, "meta.json"), "utf8"),
  );
  console.log(`Seeding ${meta.tracks.length} demo tracks...`);

  const trackIds: number[] = [];
  for (const t of meta.tracks) {
    const audioBytes = await fs.readFile(path.join(ASSETS, t.audioFile));
    const audio = await putFile({
      bytes: new Uint8Array(audioBytes),
      folder: "tracks",
      name: t.audioFile,
      contentType: "audio/mpeg",
    });
    const coverBytes = await fs.readFile(path.join(ASSETS, t.coverFile));
    const cover = await putFile({
      bytes: new Uint8Array(coverBytes),
      folder: "covers",
      name: t.coverFile,
      contentType: t.coverFile.endsWith(".jpg") ? "image/jpeg" : "image/png",
    });
    const [row] = await db.insert(tracks).values({
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSec: t.durationSec,
      audioKey: audio.key,
      coverKey: cover.key,
      source: "demo",
    });
    trackIds.push(Number(row.insertId));
    console.log(`  + ${t.title}`);
  }

  for (let i = 0; i < meta.mixes.length; i++) {
    const mix = meta.mixes[i];
    const coverBytes = await fs.readFile(path.join(ASSETS, mix.coverFile));
    const cover = await putFile({
      bytes: new Uint8Array(coverBytes),
      folder: "covers",
      name: mix.coverFile,
      contentType: mix.coverFile.endsWith(".jpg") ? "image/jpeg" : "image/png",
    });
    const [row] = await db.insert(playlists).values({
      name: mix.name,
      description: mix.description,
      coverKey: cover.key,
      isSeed: "yes",
    });
    const playlistId = Number(row.insertId);
    const picks = MIX_TRACKS[i] ?? [];
    for (let p = 0; p < picks.length; p++) {
      await db.insert(playlistTracks).values({
        playlistId,
        trackId: trackIds[picks[p]],
        position: p,
      });
    }
    console.log(`  + mix "${mix.name}" (${picks.length} tracks)`);
  }

  // Mark one track as pre-liked so the Liked view is not empty on first run.
  if (trackIds[0]) await db.insert(favorites).values({ trackId: trackIds[0] });

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
