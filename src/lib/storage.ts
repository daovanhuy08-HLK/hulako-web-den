// Lưu tệp: ảnh công khai -> Vercel Blob nếu có token, nếu không lưu trong Postgres và phục vụ qua /api/media/[id].
// CV luôn lưu trong bảng private_files, chỉ tải qua route kiểm quyền (mục 12).
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { slugify } from "./text";

const IMAGE_SIGNATURES: [string, (b: Buffer) => boolean][] = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/webp", (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"],
  ["image/gif", (b) => b.subarray(0, 4).toString() === "GIF8"],
];

/** Xác định loại tệp thật bằng chữ ký byte đầu (không tin phần mở rộng/MIME do trình duyệt gửi) */
export function sniffImage(buf: Buffer): string | null {
  return IMAGE_SIGNATURES.find(([, test]) => test(buf))?.[0] ?? null;
}

export function sniffDocument(buf: Buffer): "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | null {
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  // DOCX là tệp ZIP chứa word/document.xml
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf.includes(Buffer.from("word/"))) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export async function saveMedia(file: File, meta: { alt: string; source: string; usageRights: string; sku?: string; tags: string[]; uploadedBy: string }) {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (!mime) throw new Error("Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Ảnh tối đa 8 MB.");
  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  const key = `media/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "anh"}.${ext}`;
  const db = await getDb();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buf, { access: "public", contentType: mime, addRandomSuffix: true });
    const [row] = await db.insert(schema.mediaAssets).values({ ...meta, url: blob.url, storageKey: blob.pathname, mime, size: buf.length }).returning();
    return row;
  }
  const [row] = await db.insert(schema.mediaAssets).values({ ...meta, url: "", storageKey: key, mime, size: buf.length, data: buf }).returning();
  const url = `/api/media/${row.id}`;
  await db.update(schema.mediaAssets).set({ url }).where(eq(schema.mediaAssets.id, row.id));
  return { ...row, url };
}

export const CV_MAX_BYTES = Number(process.env.CV_MAX_MB ?? 10) * 1024 * 1024;
