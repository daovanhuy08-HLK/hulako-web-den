// Render Markdown -> HTML đã vệ sinh (mục 12: vệ sinh HTML nhập từ CMS trước khi hiển thị).
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { slugify } from "./text";

export type TocItem = { id: string; text: string; level: number };

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = tokens.map((t) => ("text" in t ? t.text : "")).join("");
    const id = slugify(text) || `muc-${toc.length + 1}`;
    if (depth === 2 || depth === 3) toc.push({ id, text, level: depth });
    return `<h${depth} id="${id}">${marked.parseInline(text)}</h${depth}>`;
  };
  const raw = marked.parse(md ?? "", { renderer, async: false }) as string;
  const html = sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "figure", "figcaption", "video", "source"]),
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      video: ["src", "controls", "preload", "poster", "width", "height"],
      source: ["src", "type"],
      h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    transformTags: {
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
      // video không tự phát: chỉ phát khi người xem bấm (mục 04)
      video: (tagName, attribs) => ({ tagName, attribs: { src: attribs.src ?? "", poster: attribs.poster ?? "", controls: "controls", preload: "none" } }),
      a: (tagName, attribs) => {
        const external = /^https?:\/\//.test(attribs.href ?? "") && !attribs.href?.includes(process.env.NEXT_PUBLIC_SITE_URL ?? "@@");
        return { tagName, attribs: external ? { ...attribs, rel: "noopener nofollow", target: "_blank" } : attribs };
      },
    },
  });
  return { html, toc };
}
