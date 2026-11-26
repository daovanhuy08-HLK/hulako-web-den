"use server";
// Server Actions cho A04 Thiết bị và A05 Góc livestream
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { adminAction, ConflictError, lines, num, str, UserError } from "@/lib/admin";
import { can } from "@/lib/permissions";
import { isAllowedMarketUrl } from "@/lib/settings";
import { buildSearchText } from "@/lib/search";
import { checkClaims } from "@/lib/guardrails";
import { slugify } from "@/lib/text";
import { audit } from "@/lib/audit";
import type { ProductStatus, SpecRow, ImageRef } from "@/lib/db/schema";

const STATUSES: ProductStatus[] = ["draft", "public", "paused", "archived"];

export async function saveProduct(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (name.length < 3) throw new UserError("Tên sản phẩm quá ngắn");
    const slug = slugify(str(fd, "slug") || name);
    const status = (STATUSES.includes(str(fd, "status") as ProductStatus) ? str(fd, "status") : "draft") as ProductStatus;
    const values = {
      name, slug, status, summary: str(fd, "summary"), body: str(fd, "body"), categoryId: str(fd, "categoryId") || null,
      useCases: fd.getAll("useCases").map(String), featured: fd.get("featured") === "on", sortOrder: num(fd, "sortOrder"),
      isSample: fd.get("isSample") === "on",
    };
    const issues = checkClaims({ "Tên": name, "Mô tả": values.summary, "Nội dung": values.body });
    if (issues.length && status === "public") throw new UserError(`Không thể công khai: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    const [dup] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.slug, slug), ...(id ? [ne(schema.products.id, id)] : [])));
    if (dup) throw new UserError(`Slug "${slug}" đã tồn tại`);
    const searchText = buildSearchText(name, values.summary, values.useCases);

    if (!id) {
      if (status !== "draft" && !can(u.roles, "product.publish")) throw new UserError("Sản phẩm mới phải ở trạng thái Nháp; người có quyền xuất bản sẽ công khai.");
      const [p] = await db.insert(schema.products).values({ ...values, searchText }).returning();
      await audit(u.id, "product.create", "product", p.id);
      return { ok: true, message: "Đã tạo sản phẩm", redirect: `/admin/products/${p.id}` };
    }
    const [cur] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    if (!cur) throw new UserError("Không tìm thấy sản phẩm");
    if (cur.version !== num(fd, "version")) throw new ConflictError();
    if (cur.status !== status && !can(u.roles, "product.publish")) throw new UserError("Đổi trạng thái bán cần quyền xuất bản sản phẩm");
    await db.update(schema.products).set({ ...values, searchText, version: cur.version + 1, updatedAt: new Date() }).where(eq(schema.products.id, id));
    // Đổi slug sản phẩm công khai → chuyển hướng 301
    if (cur.slug !== slug && cur.status !== "draft") {
      await db.update(schema.redirects).set({ toPath: `/thiet-bi/${slug}` }).where(eq(schema.redirects.toPath, `/thiet-bi/${cur.slug}`));
      await db.insert(schema.redirects).values({ fromPath: `/thiet-bi/${cur.slug}`, toPath: `/thiet-bi/${slug}` }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: `/thiet-bi/${slug}` } });
    }
    await audit(u.id, cur.status !== status ? "product.status" : "product.save", "product", id, { from: cur.status, to: status });
    revalidatePath(`/thiet-bi/${slug}`); revalidatePath("/thiet-bi"); revalidatePath("/");
    return { ok: true, message: "Đã lưu sản phẩm" };
  });
}

function parseSpecs(text: string): SpecRow[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: l, value: "" };
  });
}
function parseImages(text: string): ImageRef[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [url, alt = "", kind] = l.split("|").map((s) => s.trim());
    return { url, alt, kind: (["full", "box", "detail", "video"].includes(kind ?? "") ? kind : undefined) as ImageRef["kind"] };
  });
}

export async function saveVariant(fd: FormData) {
  return adminAction("product.edit", async (u) => {
    const db = await getDb();
    const productId = str(fd, "productId");
    const id = str(fd, "variantId");
    const sku = str(fd, "sku").toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,40}$/.test(sku)) throw new UserError("SKU chỉ gồm chữ, số, dấu gạch (3–40 ký tự)");
    const specs = parseSpecs(str(fd, "specs"));
    const images = parseImages(str(fd, "images"));
    if (images.some((i) => !i.alt)) throw new UserError("Mỗi ảnh cần alt mô tả: dạng `url | mô tả ảnh | full/box/detail`");
    const issues = checkClaims({ "Thông số": specs.map((s) => `${s.label}: ${s.value}`).join("\n"), "Thành phần": lines(fd, "components").join("\n"), "Alt ảnh": images.map((i) => i.alt).join("\n") });
    if (issues.length) throw new UserError(`Thông số/alt bị chặn: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    const links = (["shopee", "tiktok"] as const).map((ch) => ({ channel: ch, url: str(fd, `link_${ch}`) })).filter((l) => l.url);
    for (const l of links) if (!isAllowedMarketUrl(l.url)) throw new UserError(`Link ${l.channel} phải là HTTPS và thuộc tên miền sàn được phép`);
    const status = (STATUSES.includes(str(fd, "status") as ProductStatus) ? str(fd, "status") : "draft") as ProductStatus;
    const values = { productId, sku, name: str(fd, "name") || sku, components: lines(fd, "components"), specs, images, status, sortOrder: num(fd, "sortOrder") };

    const [dupe] = await db.select({ id: schema.variants.id }).from(schema.variants).where(and(eq(schema.variants.sku, sku), ...(id ? [ne(schema.variants.id, id)] : [])));
    if (dupe) throw new UserError(`SKU ${sku} đã tồn tại`);

    await db.transaction(async (tx) => {
      let vid = id;
      if (id) {
        const [cur] = await tx.select().from(schema.variants).where(eq(schema.variants.id, id));
        if (cur.status !== status && !can(u.roles, "product.publish")) throw new UserError("Đổi trạng thái phiên bản cần quyền xuất bản");
        await tx.update(schema.variants).set(values).where(eq(schema.variants.id, id));
      } else {
        const [v] = await tx.insert(schema.variants).values(values).returning();
        vid = v.id;
      }
      const existing = await tx.select().from(schema.channelLinks).where(eq(schema.channelLinks.variantId, vid));
      for (const ch of ["shopee", "tiktok"] as const) {
        const want = links.find((l) => l.channel === ch);
        const have = existing.find((e) => e.channel === ch);
        if ((want?.url ?? "") === (have?.url ?? "")) continue;
        // Thay link mua công khai cần người có quyền xuất bản xác nhận, và luôn ghi nhật ký
        if (have && status === "public" && !can(u.roles, "product.publish")) throw new UserError("Thay link mua của phiên bản đang công khai cần quyền xuất bản");
        if (want) {
          await tx.insert(schema.channelLinks).values({ variantId: vid, channel: ch, url: want.url, status: "ok", checkedAt: new Date() })
            .onConflictDoUpdate({ target: [schema.channelLinks.variantId, schema.channelLinks.channel], set: { url: want.url, status: "ok", checkedAt: new Date() } });
        } else if (have) {
          await tx.delete(schema.channelLinks).where(eq(schema.channelLinks.id, have.id));
        }
        await audit(u.id, "channel_link.change", "variant", vid, { channel: ch, from: have?.url ?? null, to: want?.url ?? null });
      }
    });
    const [p] = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.id, productId));
    if (p) revalidatePath(`/thiet-bi/${p.slug}`);
    return { ok: true, message: id ? "Đã lưu phiên bản" : "Đã thêm phiên bản", redirect: id ? undefined : `/admin/products/${productId}` };
  });
}

export async function saveCategory(fd: FormData) {
  return adminAction("product.edit", async () => {
    const db = await getDb();
    const name = str(fd, "name");
    if (!name) throw new UserError("Nhập tên danh mục");
    await db.insert(schema.categories).values({ name, slug: slugify(str(fd, "slug") || name), description: str(fd, "description"), sortOrder: num(fd, "sortOrder") })
      .onConflictDoUpdate({ target: schema.categories.slug, set: { name, description: str(fd, "description"), sortOrder: num(fd, "sortOrder") } });
    revalidatePath("/thiet-bi");
    return { ok: true, message: "Đã lưu danh mục" };
  });
}

// ---------- A05 Góc livestream ----------
export async function saveSetup(fd: FormData) {
  return adminAction("setup.edit", async (u) => {
    const db = await getDb();
    const id = str(fd, "id");
    const title = str(fd, "title");
    if (title.length < 5) throw new UserError("Tiêu đề quá ngắn");
    const slug = slugify(str(fd, "slug") || title);
    const values = {
      title, slug, summary: str(fd, "summary"), space: str(fd, "space"), industry: str(fd, "industry"), style: str(fd, "style"),
      roomConditions: str(fd, "roomConditions"), cameraAngle: str(fd, "cameraAngle"), lightPosition: str(fd, "lightPosition"),
      steps: lines(fd, "steps"), demoNote: str(fd, "demoNote"), body: str(fd, "body"), coverUrl: str(fd, "coverUrl") || null, coverAlt: str(fd, "coverAlt"),
      diagramUrl: str(fd, "diagramUrl") || null, variantIds: fd.getAll("variantIds").map(String), relatedArticleIds: fd.getAll("relatedArticleIds").map(String),
      status: ["draft", "public", "archived"].includes(str(fd, "status")) ? str(fd, "status") : "draft", featured: fd.get("featured") === "on",
      isSample: fd.get("isSample") === "on",
    };
    const issues = checkClaims({ title, summary: values.summary, body: values.body, steps: values.steps.join("\n"), alt: values.coverAlt });
    if (issues.length && values.status === "public") throw new UserError(`Không thể công khai: ${issues.map((i) => `“${i.match}” — ${i.hint}`).join("; ")}`);
    const searchText = buildSearchText(title, values.summary, values.roomConditions, values.steps);
    const [dup] = await db.select({ id: schema.setups.id }).from(schema.setups).where(and(eq(schema.setups.slug, slug), ...(id ? [ne(schema.setups.id, id)] : [])));
    if (dup) throw new UserError(`Slug "${slug}" đã tồn tại`);
    if (!id) {
      const [s] = await db.insert(schema.setups).values({ ...values, searchText }).returning();
      await audit(u.id, "setup.create", "setup", s.id);
      return { ok: true, message: "Đã tạo mẫu", redirect: `/admin/setups/${s.id}` };
    }
    const [cur] = await db.select().from(schema.setups).where(eq(schema.setups.id, id));
    if (!cur) throw new UserError("Không tìm thấy mẫu");
    if (cur.version !== num(fd, "version")) throw new ConflictError();
    await db.update(schema.setups).set({ ...values, searchText, version: cur.version + 1, updatedAt: new Date() }).where(eq(schema.setups.id, id));
    if (cur.slug !== slug && cur.status === "public") {
      await db.insert(schema.redirects).values({ fromPath: `/goc-livestream/${cur.slug}`, toPath: `/goc-livestream/${slug}` }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: `/goc-livestream/${slug}` } });
    }
    await audit(u.id, "setup.save", "setup", id, { status: values.status });
    revalidatePath(`/goc-livestream/${slug}`); revalidatePath("/goc-livestream"); revalidatePath("/");
    return { ok: true, message: "Đã lưu mẫu góc live" };
  });
}
