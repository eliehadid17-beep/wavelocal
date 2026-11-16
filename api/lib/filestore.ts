/**
 * File storage abstraction.
 *
 * On the Kimi platform (KIMI_* env vars injected) files go to the managed
 * object storage through api/lib/storage.ts. When self-hosting (no KIMI_*
 * env vars), files are kept on local disk under ./uploads and served from
 * the /uploads/* route — which is exactly what "run it locally" needs.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { storage } from "./storage";

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export function isPlatformStorage(): boolean {
  return Boolean(
    process.env.KIMI_STORAGE_RESOURCE_ID &&
      process.env.KIMI_AGENTGW_API_KEY &&
      process.env.KIMI_AGENTGW_BASE_URL,
  );
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

export async function putFile(opts: {
  bytes: Uint8Array;
  folder: string;
  name: string;
  contentType?: string;
}): Promise<{ key: string; size: number }> {
  if (isPlatformStorage()) {
    const saved = await storage.uploadFile({
      fileContent: opts.bytes,
      fileName: `${opts.folder}/${safeName(opts.name)}`,
      contentType: opts.contentType,
    });
    return { key: saved.key, size: saved.size };
  }
  const key = `${opts.folder}/${crypto.randomUUID().slice(0, 8)}-${safeName(opts.name)}`;
  const full = path.join(LOCAL_UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, opts.bytes);
  return { key, size: opts.bytes.length };
}

export async function fileUrl(key: string): Promise<string> {
  if (isPlatformStorage()) {
    return (await storage.getPresignedUrl({ key })).url;
  }
  return `/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function fileUrls(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (isPlatformStorage()) {
    const { urls } = await storage.getPresignedUrls({ keys });
    for (const [k, v] of Object.entries(urls)) out[k] = (v as { url: string }).url ?? String(v);
    return out;
  }
  for (const k of keys) out[k] = await fileUrl(k);
  return out;
}

export async function removeFile(key: string): Promise<void> {
  if (isPlatformStorage()) {
    await storage.deleteFile({ fileKey: key });
    return;
  }
  const full = path.join(LOCAL_UPLOAD_DIR, key);
  await fs.unlink(full).catch(() => {});
}
