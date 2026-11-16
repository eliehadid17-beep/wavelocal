import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { favorites, playlists, playlistTracks, tracks } from "../../db/schema";
import { fileUrl, fileUrls, putFile, removeFile } from "../lib/filestore";
import { MAX_UPLOAD_BYTES } from "../../contracts/types";

const coverInput = z
  .object({
    name: z.string().max(200),
    contentBase64: z.string().max(8 * 1024 * 1024), // ~6 MB image
    contentType: z.string().max(100).optional(),
  })
  .optional();

export const libraryRouter = createRouter({
  /** All tracks, newest first. */
  tracks: publicQuery.query(async () => {
    return getDb().select().from(tracks).orderBy(desc(tracks.createdAt));
  }),

  search: publicQuery
    .input(z.object({ q: z.string().trim().min(1).max(120) }))
    .query(async ({ input }) => {
      const q = `%${input.q.replace(/[%_]/g, "")}%`;
      return getDb()
        .select()
        .from(tracks)
        .where(
          or(like(tracks.title, q), like(tracks.artist, q), like(tracks.album, q)),
        )
        .orderBy(desc(tracks.createdAt))
        .limit(60);
    }),

  /** Short-lived (or local) playable URL for one file key. */
  fileUrl: publicQuery
    .input(z.object({ key: z.string().min(1).max(512) }))
    .query(async ({ input }) => ({ url: await fileUrl(input.key) })),

  /** Batch URL minting for grids of covers. */
  fileUrls: publicQuery
    .input(z.object({ keys: z.array(z.string().min(1).max(512)).max(200) }))
    .query(async ({ input }) => ({ urls: await fileUrls(input.keys) })),

  uploadTrack: publicQuery
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        artist: z.string().trim().max(200).default("Unknown Artist"),
        album: z.string().trim().max(200).optional(),
        durationSec: z.number().int().min(0).max(6 * 3600).default(0),
        audioName: z.string().min(1).max(200),
        audioBase64: z.string().min(8),
        audioType: z.string().max(100).optional(),
        cover: coverInput,
      }),
    )
    .mutation(async ({ input }) => {
      const audioBytes = Buffer.from(input.audioBase64, "base64");
      if (audioBytes.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty audio file" });
      }
      if (audioBytes.length > MAX_UPLOAD_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Audio exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`,
        });
      }
      const audio = await putFile({
        bytes: new Uint8Array(audioBytes),
        folder: "tracks",
        name: input.audioName,
        contentType: input.audioType,
      });
      let coverKey: string | null = null;
      if (input.cover) {
        const coverBytes = Buffer.from(input.cover.contentBase64, "base64");
        if (coverBytes.length > 0 && coverBytes.length <= 6 * 1024 * 1024) {
          coverKey = (
            await putFile({
              bytes: new Uint8Array(coverBytes),
              folder: "covers",
              name: input.cover.name,
              contentType: input.cover.contentType,
            })
          ).key;
        }
      }
      const db = getDb();
      const [row] = await db.insert(tracks).values({
        title: input.title,
        artist: input.artist || "Unknown Artist",
        album: input.album || null,
        durationSec: input.durationSec,
        audioKey: audio.key,
        coverKey,
        source: "upload",
      });
      const id = Number(row.insertId);
      const [created] = await db.select().from(tracks).where(eq(tracks.id, id));
      return created;
    }),

  deleteTrack: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [track] = await db.select().from(tracks).where(eq(tracks.id, input.id));
      if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      await db.delete(playlistTracks).where(eq(playlistTracks.trackId, input.id));
      await db.delete(favorites).where(eq(favorites.trackId, input.id));
      await db.delete(tracks).where(eq(tracks.id, input.id));
      // Best-effort file cleanup; rows are already gone.
      await removeFile(track.audioKey).catch(() => {});
      if (track.coverKey) await removeFile(track.coverKey).catch(() => {});
      return { ok: true };
    }),

  toggleFavorite: publicQuery
    .input(z.object({ trackId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(favorites)
        .where(eq(favorites.trackId, input.trackId));
      if (existing) {
        await db.delete(favorites).where(eq(favorites.trackId, input.trackId));
        return { favorite: false };
      }
      await db.insert(favorites).values({ trackId: input.trackId });
      return { favorite: true };
    }),

  favoriteTracks: publicQuery.query(async () => {
    const db = getDb();
    const favs = await db.select().from(favorites).orderBy(desc(favorites.createdAt));
    if (favs.length === 0) return [];
    const rows = await db
      .select()
      .from(tracks)
      .where(inArray(tracks.id, favs.map((f) => f.trackId)));
    const order = new Map(favs.map((f, i) => [f.trackId, i]));
    return rows.sort(
      (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999),
    );
  }),

  favoriteIds: publicQuery.query(async () => {
    const rows = await getDb().select({ trackId: favorites.trackId }).from(favorites);
    return rows.map((r) => r.trackId);
  }),

  playlists: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        playlist: playlists,
        trackCount: sql<number>`count(${playlistTracks.id})`.as("track_count"),
      })
      .from(playlists)
      .leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
      .groupBy(playlists.id)
      .orderBy(asc(playlists.createdAt));
    return rows.map((r) => ({ ...r.playlist, trackCount: Number(r.trackCount) }));
  }),

  createPlaylist: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .insert(playlists)
        .values({ name: input.name, description: input.description ?? null });
      const id = Number(row.insertId);
      const [created] = await db.select().from(playlists).where(eq(playlists.id, id));
      return created;
    }),

  playlistDetail: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, input.id));
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND", message: "Playlist not found" });
      const rows = await db
        .select({ track: tracks, position: playlistTracks.position })
        .from(playlistTracks)
        .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
        .where(eq(playlistTracks.playlistId, input.id))
        .orderBy(asc(playlistTracks.position), asc(playlistTracks.addedAt));
      return { playlist, tracks: rows.map((r) => r.track) };
    }),

  addToPlaylist: publicQuery
    .input(
      z.object({
        playlistId: z.number().int().positive(),
        trackId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [dup] = await db
        .select()
        .from(playlistTracks)
        .where(
          sql`${playlistTracks.playlistId} = ${input.playlistId} and ${playlistTracks.trackId} = ${input.trackId}`,
        );
      if (dup) return { ok: true, added: false };
      const [maxPos] = await db
        .select({ max: sql<number>`coalesce(max(${playlistTracks.position}), -1)` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, input.playlistId));
      await db.insert(playlistTracks).values({
        playlistId: input.playlistId,
        trackId: input.trackId,
        position: Number(maxPos?.max ?? -1) + 1,
      });
      return { ok: true, added: true };
    }),

  removeFromPlaylist: publicQuery
    .input(
      z.object({
        playlistId: z.number().int().positive(),
        trackId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .delete(playlistTracks)
        .where(
          sql`${playlistTracks.playlistId} = ${input.playlistId} and ${playlistTracks.trackId} = ${input.trackId}`,
        );
      return { ok: true };
    }),

  renamePlaylist: publicQuery
    .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(200) }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(playlists)
        .set({ name: input.name })
        .where(eq(playlists.id, input.id));
      return { ok: true };
    }),

  deletePlaylist: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, input.id));
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND", message: "Playlist not found" });
      await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, input.id));
      await db.delete(playlists).where(eq(playlists.id, input.id));
      if (playlist.coverKey && playlist.isSeed === "no") {
        await removeFile(playlist.coverKey).catch(() => {});
      }
      return { ok: true };
    }),
});
