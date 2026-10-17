// Usage: npm run maps-photos -- <slug>
//
// Downloads the place photos listed in clients/<slug>/raw/maps.json (written from scripts/maps-extract.js)
// into clients/<slug>/raw/images/maps-NN.jpg at full size. Like everything in raw/, these are candidates only:
// look at each one before copying it to assets/ (real work, vans or team only; no customer selfies, no Street View).
import fs from "node:fs";
import path from "node:path";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: npm run maps-photos -- <slug>");
  process.exit(1);
}
const raw = path.resolve("clients", slug, "raw");
const file = path.join(raw, "maps.json");
if (!fs.existsSync(file)) {
  console.error(`missing ${file}: run scripts/maps-extract.js on the Google Maps profile first`);
  process.exit(1);
}
const { photos = [] } = JSON.parse(fs.readFileSync(file, "utf8")) as { photos?: string[] };
const dir = path.join(raw, "images");
fs.mkdirSync(dir, { recursive: true });

let n = 0;
for (const base of photos) {
  // Google photo URLs take a size suffix; ask for a large version (it returns the original if smaller).
  const url = `${base.split("=")[0]}=w2400-h2400-k-no`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) throw new Error(`${res.status} ${type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const name = `maps-${String(++n).padStart(2, "0")}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
    fs.writeFileSync(path.join(dir, name), buf);
    console.log(`${name}  ${Math.round(buf.length / 1024)} KB`);
  } catch (e) {
    console.warn(`! skipped ${base.slice(0, 80)}…: ${(e as Error).message}`);
  }
}
console.log(`\n${n} of ${photos.length} photo(s) -> clients/${slug}/raw/images/`);
