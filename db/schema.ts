import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  timestamp,
  bigint,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const tracks = mysqlTable("tracks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  artist: varchar("artist", { length: 255 }).notNull().default("Unknown Artist"),
  album: varchar("album", { length: 255 }),
  durationSec: int("duration_sec").notNull().default(0),
  audioKey: varchar("audio_key", { length: 512 }).notNull(),
  coverKey: varchar("cover_key", { length: 512 }),
  source: mysqlEnum("source", ["demo", "upload"]).notNull().default("upload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlists = mysqlTable("playlists", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  coverKey: varchar("cover_key", { length: 512 }),
  isSeed: mysqlEnum("is_seed", ["yes", "no"]).notNull().default("no"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlistTracks = mysqlTable(
  "playlist_tracks",
  {
    id: serial("id").primaryKey(),
    playlistId: bigint("playlist_id", { mode: "number", unsigned: true }).notNull(),
    trackId: bigint("track_id", { mode: "number", unsigned: true }).notNull(),
    position: int("position").notNull().default(0),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("playlist_track_unique").on(t.playlistId, t.trackId)],
);

export const favorites = mysqlTable("favorites", {
  trackId: bigint("track_id", { mode: "number", unsigned: true }).primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Track = typeof tracks.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
