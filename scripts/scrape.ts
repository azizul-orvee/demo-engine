// Usage: npm run scrape -- <url> <slug>
//
// Crawls a prospect's site (homepage + up to MAX_PAGES relevant internal pages),
// extracts everything the template might need, and downloads candidate images.
// Output (all untrusted raw material, never served):
//   clients/<slug>/raw/scrape.json   structured facts + page text
//   clients/<slug>/raw/images/*      downloaded logo + photo candidates
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const [startArg, slug] = process.argv.slice(2);
if (!startArg || !slug) {
  console.error("usage: npm run scrape -- <url> <slug>");
  process.exit(1);
}
const START = new URL(startArg.startsWith("http") ? startArg : `https://${startArg}`);
const OUT = path.resolve("clients", slug, "raw");
const IMG_DIR = path.join(OUT, "images");
fs.mkdirSync(IMG_DIR, { recursive: true });

const MAX_PAGES = 10;
const MAX_IMAGES = 30;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const PRIORITY =
  /about|service|boiler|heating|gas|install|repair|servic|plumb|heat-?pump|landlord|review|testimonial|contact|area|location|gallery|project|work|faq|price/i;
const ACCREDITATIONS = [
  "Gas Safe", "OFTEC", "MCS", "HETAS", "NICEIC", "NAPIT", "APHC", "CIPHE", "TrustMark",
  "Checkatrade", "TrustATrader", "Which? Trusted Trader", "Rated People", "MyBuilder",
  "Worcester Bosch Accredited", "Vaillant Advance", "Viessmann", "Ideal", "Baxi", "Glow-worm",
  "Hive", "Nest", "Tado", "Federation of Master Builders", "Safe Contractor", "CHAS",
];

async function get(url: string) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  return res;
}

const abs = (href: string | undefined, base: string) => {
  if (!href) return undefined;
  try {
    return new URL(href.trim(), base).href.split("#")[0];
  } catch {
    return undefined;
  }
};

type Img = { url: string; alt: string; hint: string; page: string; w?: number; h?: number };
const pages: { url: string; title: string; description: string; headings: string[]; text: string }[] = [];
const images = new Map<string, Img>();
const logoCandidates = new Set<string>();
const socials = new Set<string>();
const jsonLd: unknown[] = [];
const stylesheets = new Set<string>();
let inlineCss = "";
let themeColor: string | undefined;
let allText = "";
const linkPhones = new Set<string>();
const linkEmails = new Set<string>();

const queue: string[] = [START.href];
const seen = new Set<string>();

while (queue.length && pages.length < MAX_PAGES) {
  const url = queue.shift()!;
  if (seen.has(url)) continue;
  seen.add(url);
  let html: string;
  try {
    const res = await get(url);
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) continue;
    html = await res.text();
  } catch (e) {
    console.warn(`! ${url}: ${(e as Error).message}`);
    continue;
  }
  // Space before every tag so text from adjacent elements doesn't glue together ("0123Email").
  const $ = cheerio.load(html.replace(/</g, " <"));
  console.log(`page ${pages.length + 1}: ${url}`);

  themeColor ??= $('meta[name="theme-color"]').attr("content");
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).text()));
    } catch {}
  });
  $('link[rel="stylesheet"]').each((_, el) => {
    const h = abs($(el).attr("href"), url);
    if (h) stylesheets.add(h);
  });
  inlineCss += $("style").text() + " " + $("[style]").map((_, el) => $(el).attr("style")).get().join(" ");

  // Logo candidates
  for (const sel of ['link[rel="apple-touch-icon"]', 'link[rel="icon"]', 'meta[property="og:image"]']) {
    $(sel).each((_, el) => {
      const h = abs($(el).attr("href") || $(el).attr("content"), url);
      if (h) logoCandidates.add(h);
    });
  }
  $("img, image").each((_, el) => {
    const $el = $(el);
    const src =
      $el.attr("src") || $el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("href") ||
      $el.attr("srcset")?.split(",").pop()?.trim().split(" ")[0];
    const u = abs(src, url);
    if (!u || u.startsWith("data:")) return;
    const alt = $el.attr("alt") || "";
    const hint = [$el.attr("class"), $el.attr("id"), $el.parent().attr("class"), alt, u].join(" ");
    if (/logo/i.test(hint) || $el.closest("header, .header, #header, .navbar, .site-branding").length) {
      logoCandidates.add(u);
    }
    if (!images.has(u)) {
      images.set(u, { url: u, alt, hint, page: url, w: Number($el.attr("width")) || undefined, h: Number($el.attr("height")) || undefined });
    }
  });
  // Background images in inline styles
  $("[style*='url(']").each((_, el) => {
    const m = ($(el).attr("style") || "").match(/url\(['"]?([^'")]+)/);
    const u = abs(m?.[1], url);
    if (u && !images.has(u)) images.set(u, { url: u, alt: "", hint: "background", page: url });
  });

  $('a[href^="tel:"]').each((_, el) => { linkPhones.add(decodeURIComponent($(el).attr("href")!.slice(4)).trim()); });
  $('a[href^="mailto:"]').each((_, el) => { linkEmails.add($(el).attr("href")!.slice(7).split("?")[0].toLowerCase()); });
  $("a[href]").each((_, el) => {
    const h = abs($(el).attr("href"), url);
    if (!h) return;
    if (/facebook|instagram|twitter|x\.com|linkedin|youtube|tiktok|google\.[a-z.]+\/maps|g\.page|checkatrade|trustatrader|yell\.com/i.test(h)) socials.add(h);
    const u = new URL(h);
    if (u.hostname.replace(/^www\./, "") !== START.hostname.replace(/^www\./, "")) return;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?)$/i.test(u.pathname)) return;
    if (seen.has(h) || queue.includes(h)) return;
    if (PRIORITY.test(u.pathname)) queue.unshift(h);
    else queue.push(h);
  });

  $("script, style, noscript, svg, iframe").remove();
  const headings = $("h1, h2, h3").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  allText += " " + text;
  pages.push({
    url,
    title: $("title").text().trim(),
    description: $('meta[name="description"]').attr("content") || "",
    headings: [...new Set(headings)].slice(0, 40),
    text: text.slice(0, 8000),
  });
}

// Colours: count hex values across inline CSS + first few stylesheets, drop greys.
for (const href of [...stylesheets].slice(0, 5)) {
  try {
    const r = await get(href);
    if (r.ok) inlineCss += " " + (await r.text()).slice(0, 400_000);
  } catch {}
}
const colorCounts: Record<string, number> = {};
for (const m of inlineCss.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (Math.max(r, g, b) - Math.min(r, g, b) < 24) continue; // greyscale
  colorCounts["#" + h] = (colorCounts["#" + h] || 0) + 1;
}
const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

// Facts via regex over all page text
const uniq = <T,>(a: T[]) => [...new Set(a)];
const phones = uniq([
  ...linkPhones,
  ...[...allText.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/g)].map((m) => m[0].replace(/\s+/g, " ").trim()),
]).slice(0, 8);
const emails = uniq([...linkEmails, ...[...allText.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0].toLowerCase())]).filter((e) => !/\.(png|jpe?g|webp)$/.test(e)).slice(0, 5);
const postcodes = uniq([...allText.matchAll(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g)].map((m) => m[0])).slice(0, 8);
const gasSafe = uniq([...allText.matchAll(/gas\s*safe[^0-9]{0,40}(\d{6,7})/gi)].map((m) => m[1]));
const oftec = uniq([...allText.matchAll(/oftec[^0-9]{0,40}([A-Z]?\d{4,7})/gi)].map((m) => m[1]));
const companyNo = uniq([...allText.matchAll(/compan(?:y|ies)\s*(?:reg(?:istration|istered)?\.?\s*)?(?:no\.?|number)[:\s]*([A-Z]{0,2}\d{6,8})/gi)].map((m) => m[1]));
const years = uniq([...allText.matchAll(/(?:since|established|est\.?|founded|started)\s*(?:in\s*)?(19\d{2}|20\d{2})/gi)].map((m) => m[1]));
const accreditations = ACCREDITATIONS.filter((a) => allText.toLowerCase().includes(a.toLowerCase()));

// Download images: logos first, then largest-looking content images.
const isJunk = (u: string) => /pixel|tracking|spinner|loader|gravatar|emoji|wp-includes|sprite|1x1|facebook\.com\/tr/i.test(u);
const ordered = uniq([
  ...[...logoCandidates],
  ...[...images.values()]
    .filter((i) => !isJunk(i.url))
    .sort((a, b) => (b.w || 0) * (b.h || 0) - (a.w || 0) * (a.h || 0))
    .map((i) => i.url),
]).slice(0, MAX_IMAGES);

const downloaded: { file: string; url: string; bytes: number; type: string; logoCandidate: boolean; alt: string; page?: string }[] = [];
let idx = 0;
for (const url of ordered) {
  try {
    const r = await get(url);
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < (logoCandidates.has(url) ? 200 : 4000) || buf.length > 8_000_000) continue;
    const ext = (type.split("/")[1] || "bin").replace("svg+xml", "svg").replace("jpeg", "jpg").split(";")[0];
    const isLogo = logoCandidates.has(url);
    const file = `${String(++idx).padStart(2, "0")}-${isLogo ? "logo" : "img"}.${ext}`;
    fs.writeFileSync(path.join(IMG_DIR, file), buf);
    const meta = images.get(url);
    downloaded.push({ file, url, bytes: buf.length, type, logoCandidate: isLogo, alt: meta?.alt || "", page: meta?.page });
  } catch {}
}

const result = {
  sourceUrl: START.href,
  scrapedAt: new Date().toISOString(),
  facts: { phones, emails, postcodes, gasSafe, oftec, companyNo, yearsEstablished: years, accreditations, socials: [...socials] },
  colors: { themeColor, top: topColors },
  jsonLd,
  images: downloaded,
  pages,
};
fs.writeFileSync(path.join(OUT, "scrape.json"), JSON.stringify(result, null, 2));
console.log(
  `\nscraped ${pages.length} pages, ${downloaded.length} images -> clients/${slug}/raw/\n` +
    `phones: ${phones.join(", ") || "-"}\ngas safe: ${gasSafe.join(", ") || "-"}\naccreditations: ${accreditations.join(", ") || "-"}\n` +
    `top colours: ${topColors.slice(0, 5).map(([c]) => c).join(" ") || "-"}`,
);
