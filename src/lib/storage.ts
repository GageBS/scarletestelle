/**
 * Photo uploads → resized, EXIF-rotated JPEGs on local disk (STORAGE_DIR/uploads/…),
 * served by app/media/[...path]/route.ts at /media/….
 * Swap this module for S3/R2 when hosting somewhere without a persistent disk.
 */
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { newId } from "@/lib/ids";

export const storageRoot = () =>
  path.resolve(process.env.STORAGE_DIR ?? "./storage", "uploads");

const MAX_EDGE = 2400;

export async function saveImage(
  file: File | Buffer,
  folder: string,
): Promise<{ src: string; width: number; height: number }> {
  const buf = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+/, "") || "misc";
  const name = `${newId()}.jpg`;
  const dir = path.join(storageRoot(), safeFolder);
  await mkdir(dir, { recursive: true });
  const { data, info } = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(dir, name), data);
  return { src: `/media/${safeFolder}/${name}`, width: info.width, height: info.height };
}

/** Delete an uploaded file by its /media/… src (ignores /demo/… and missing files). */
export async function deleteImage(src: string) {
  if (!src.startsWith("/media/")) return;
  const rel = src.slice("/media/".length);
  const full = path.resolve(storageRoot(), rel);
  if (!full.startsWith(storageRoot())) return;
  await unlink(full).catch(() => undefined);
}
