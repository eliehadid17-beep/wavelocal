/**
 * Serves files from ./uploads when self-hosting (local-disk storage mode).
 * Unused on the Kimi platform, where files are served from object storage
 * via short-lived presigned URLs. Supports HTTP Range so audio seeking works.
 */
import { Hono } from "hono";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { LOCAL_UPLOAD_DIR } from "../lib/filestore";

const MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  webm: "audio/webm",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export const uploadsRoutes = new Hono();

uploadsRoutes.get("/*", async (c) => {
  const rel = c.req.path.replace(/^\/uploads\//, "");
  const decoded = rel.split("/").map(decodeURIComponent).join("/");
  const full = path.join(LOCAL_UPLOAD_DIR, decoded);
  if (!full.startsWith(LOCAL_UPLOAD_DIR)) return c.body(null, 403);
  let st;
  try {
    st = await stat(full);
  } catch {
    return c.body(null, 404);
  }
  const ext = path.extname(full).slice(1).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const range = c.req.header("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m?.[1] ? parseInt(m[1], 10) : 0;
    let end = m?.[2] ? parseInt(m[2], 10) : st.size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= st.size) end = st.size - 1;
    if (start > end) return c.body(null, 416);
    const stream = createReadStream(full, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${st.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  const stream = createReadStream(full);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(st.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
