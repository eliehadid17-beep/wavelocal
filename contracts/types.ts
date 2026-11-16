export * from "./errors";

/** Shape of a track as sent to the browser. */
export interface TrackDto {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  durationSec: number;
  audioKey: string;
  coverKey: string | null;
  source: "demo" | "upload";
  createdAt: Date;
}

export interface PlaylistSummaryDto {
  id: number;
  name: string;
  description: string | null;
  coverKey: string | null;
  isSeed: "yes" | "no";
  trackCount: number;
  createdAt: Date;
}

export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB per audio file

export const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "webm", "opus"];
