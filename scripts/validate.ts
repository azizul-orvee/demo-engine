// Usage: npm run validate            (all clients)
//        npm run validate -- <slug>  (one client)
//
// Errors (exit 1): brand.json breaks the schema, or a referenced asset is missing.
// Warnings (exit 0): breaks a rule from AGENTS.md that a script can check. Fix them unless there's a reason not to.
import fs from "node:fs";
import path from "node:path";
import { listClientSlugs, loadClient, assetUrl } from "../src/lib/clients.ts";
import type { Brand } from "../src/lib/schema.ts";

const only = process.argv[2];
const slugs = only ? [only] : listClientSlugs();
let failed = 0;

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function warnings(slug: string, b: Brand): string[] {
  const w: string[] = [];
  const { primary, dark, accent } = b.brand.colors;
  if (luminance(dark) > 0.1) w.push(`colors.dark ${dark} is too light; it's the hero/footer background (aim for luminance under 10%).`);
  if (contrast(accent, dark) < 4.5) w.push(`colors.accent ${accent} is only ${contrast(accent, dark).toFixed(1)}:1 on colors.dark; buttons on dark sections use it. Pick a lighter accent.`);
  if (contrast(accent, primary) < 1.5) w.push(`colors.accent ${accent} is too close to colors.primary ${primary}.`);

  const words = b.hero.headline.trim().split(/\s+/).length;
  if (words > 10) w.push(`hero.headline is ${words} words; keep it under 10.`);

  // Proof points belong in the hero's proof strip once, not repeated in the eyebrow and bullets.
  // Rating and review count match as numbers; stats match on their whole value ("7 days", "8pm"), not loose digits.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const proof = [
    b.reviews.rating?.toFixed(1),
    b.reviews.count && String(b.reviews.count),
    ...b.stats.map((s) => s.value.replace(/[★+]/g, "").trim()).filter((v) => v.length > 1),
  ].filter(Boolean) as string[];
  for (const [field, text] of [["hero.eyebrow", b.hero.eyebrow ?? ""], ...b.hero.bullets.map((t, i) => [`hero.bullets[${i}]`, t])]) {
    const hit = proof.find((p) => new RegExp(`(^|[^\\w.])${esc(p)}(?![\\w.]*\\d)`, "i").test(text));
    if (hit) w.push(`${field} repeats "${hit}", which the proof strip already shows. Say each proof point once.`);
  }

  if (b.gallery.length > 0 && b.gallery.length < 4) w.push(`gallery has ${b.gallery.length} photo(s); use 4–8 real install photos or leave it empty.`);
  if (b.faqs.length > 0 && b.faqs.length < 4) w.push(`faqs has ${b.faqs.length}; aim for 4–6.`);
  if (!b.sourceUrl) w.push(`sourceUrl is empty; record where the facts came from (website and/or Google Maps URL).`);
  if (!/^sample-/.test(slug) && !fs.existsSync(path.join("clients", slug, "NOTES.md"))) {
    w.push(`clients/${slug}/NOTES.md is missing; write the found/omitted list and outreach points there.`);
  }
  return w;
}

for (const slug of slugs) {
  try {
    const b = loadClient(slug);
    // Check that every local asset referenced actually exists.
    const refs = [b.brand.logo, b.brand.logoOnDark, b.hero.image, b.about?.image, ...b.gallery.map((g) => g.src)];
    for (const ref of refs) {
      const url = assetUrl(slug, ref);
      if (!url || url.startsWith("http")) continue;
      const file = path.join("clients", slug, "assets", url.split("/").slice(3).join("/"));
      if (!fs.existsSync(file)) throw new Error(`missing asset: ${file}`);
    }
    const w = warnings(slug, b);
    console.log(`✓ ${slug}${w.length ? `  (${w.length} warning${w.length > 1 ? "s" : ""})` : ""}`);
    for (const msg of w) console.log(`  ! ${msg}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${slug}\n${(e as Error).message}`);
  }
}
if (!slugs.length) console.log("no clients yet — run: npm run new -- <business-name>");
process.exit(failed ? 1 : 0);
