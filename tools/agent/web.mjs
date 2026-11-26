// Công cụ web cho SEO Agent: tải trang lịch sự (tôn trọng robots.txt, giãn cách, giới hạn dung lượng),
// đọc CẤU TRÚC bài viết (không lưu nội dung), đọc sitemap, Google Trends (RSS công khai), gợi ý tìm kiếm.
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { XMLParser } from 'fast-xml-parser';

export const UA = 'Mozilla/5.0 (compatible; HULAKO-SEO-Agent/1.0; +https://hulako-web-den.vercel.app)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xml = new XMLParser({ ignoreAttributes: false });
const robotsCache = new Map();
const lastHit = new Map();

async function rawFetch(url, { timeout = 20000, maxBytes = 3_000_000, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept, 'accept-language': 'vi-VN,vi;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('Trang quá lớn');
  return { text: buf.toString('utf8'), url: res.url, type: res.headers.get('content-type') ?? '' };
}

/** robots.txt của một host (cache 6 giờ). Lỗi tải → coi như cho phép (chuẩn của Google). */
export async function robotsFor(origin) {
  const hit = robotsCache.get(origin);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.r;
  let body = '';
  try { body = (await rawFetch(`${origin}/robots.txt`, { timeout: 10000, accept: 'text/plain' })).text; } catch { body = ''; }
  const r = robotsParser(`${origin}/robots.txt`, body);
  robotsCache.set(origin, { r, at: Date.now() });
  return r;
}

/** Tải trang nếu robots.txt cho phép; giãn cách ≥ 2 giây mỗi host để không làm phiền máy chủ của họ */
export async function politeFetch(url, opts = {}) {
  const u = new URL(url);
  const robots = await robotsFor(u.origin);
  if (robots.isAllowed(url, 'HULAKO-SEO-Agent') === false) throw new Error('robots.txt không cho phép');
  const wait = 2000 - (Date.now() - (lastHit.get(u.host) ?? 0));
  if (wait > 0) await sleep(wait);
  lastHit.set(u.host, Date.now());
  return rawFetch(url, opts);
}

/** Đọc cấu trúc 1 bài viết: tiêu đề, H1, H2/H3, số chữ, số câu hỏi, bảng, danh sách, ảnh, video, loại schema */
export function parseArticle(html, url) {
  const $ = cheerio.load(html);
  const schemaTypes = new Set();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).text());
      const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o['@type']) [].concat(o['@type']).forEach((t) => schemaTypes.add(String(t))); if (o['@graph']) walk(o['@graph']); };
      walk(j);
    } catch { /* bỏ qua */ }
  });
  $('script,style,noscript,svg,iframe,nav,footer,header,aside,form').remove();
  const root = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  const text = root.text().replace(/\s+/g, ' ').trim();
  const headings = [];
  root.find('h2,h3').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length < 200) headings.push(`${el.tagName.toUpperCase()}: ${t}`);
  });
  const title = $('title').first().text().trim() || $('h1').first().text().trim();
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const meta = $('meta[name="description"]').attr('content') ?? '';
  const out = {
    url, title: title.slice(0, 200), h1: h1.slice(0, 200), metaDescription: meta.slice(0, 300),
    wordCount: text ? text.split(' ').length : 0,
    headings: headings.slice(0, 60),
    questions: headings.filter((h) => /\?\s*$/.test(h)).length,
    tables: root.find('table').length, lists: root.find('ul,ol').length, images: root.find('img').length,
    videos: root.find('video').length + $('iframe[src*="youtube"],iframe[src*="tiktok"]').length,
    schemaTypes: [...schemaTypes].slice(0, 12),
  };
  out.hash = createHash('sha1').update(`${out.title}|${out.headings.join('|')}`).digest('hex').slice(0, 16);
  return out;
}

/** Danh sách URL trong sitemap của một tên miền (ưu tiên sitemap bài viết), kèm lastmod */
export async function sitemapUrls(domain, { max = 3000 } = {}) {
  const origin = `https://${domain}`;
  const robots = await robotsFor(origin);
  let maps = robots.getSitemaps();
  if (!maps.length) maps = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const urls = new Map();
  const queue = [...maps];
  const seen = new Set();
  while (queue.length && seen.size < 12 && urls.size < max) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    let doc;
    try { doc = xml.parse((await politeFetch(sm, { accept: 'application/xml,text/xml' })).text); } catch { continue; }
    const children = [].concat(doc?.sitemapindex?.sitemap ?? []).map((x) => x.loc).filter(Boolean);
    // sitemap con: ưu tiên bài viết/blog/tin, bỏ ảnh/sản phẩm/thẻ
    children.sort((a, b) => score(b) - score(a));
    for (const c of children) if (!/image|video|tag|author|attachment/i.test(c)) queue.push(c);
    for (const u of [].concat(doc?.urlset?.url ?? [])) {
      if (!u?.loc || urls.size >= max) continue;
      urls.set(String(u.loc).trim(), u.lastmod ? String(u.lastmod) : null);
    }
  }
  return [...urls.entries()].map(([url, lastmod]) => ({ url, lastmod }));
  function score(u) { return /post|blog|bai-viet|tin-tuc|news|kien-thuc|article/i.test(u) ? 2 : /page/i.test(u) ? 1 : 0; }
}

/** Google Trends: các tìm kiếm đang tăng mạnh tại Việt Nam (RSS công khai, cập nhật vài giờ một lần) */
export async function googleTrendsVN() {
  const { text } = await rawFetch('https://trends.google.com/trending/rss?geo=VN', { accept: 'application/rss+xml,application/xml' });
  const doc = xml.parse(text);
  return [].concat(doc?.rss?.channel?.item ?? []).slice(0, 40).map((it) => ({
    query: String(it.title ?? ''),
    traffic: String(it['ht:approx_traffic'] ?? ''),
    started: String(it.pubDate ?? ''),
    news: [].concat(it['ht:news_item'] ?? []).slice(0, 3).map((n) => String(n['ht:news_item_title'] ?? '')).filter(Boolean),
  })).filter((x) => x.query);
}

/** Gợi ý tìm kiếm của Google cho 1 cụm từ (dữ liệu người dùng gõ thật). Gọi thưa (≥ 0,4 giây/lần). */
export async function autocomplete(q) {
  await sleep(400);
  try {
    const { text } = await rawFetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=vi&gl=vn&q=${encodeURIComponent(q)}`, { timeout: 8000, accept: 'application/json' });
    const j = JSON.parse(text);
    return Array.isArray(j?.[1]) ? j[1].map(String) : [];
  } catch { return []; }
}
