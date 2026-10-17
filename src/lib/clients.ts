import fs from "node:fs";
import path from "node:path";
import { Brand } from "./schema.ts";

export const CLIENTS_DIR = path.resolve("clients");

export function listClientSlugs(): string[] {
  if (!fs.existsSync(CLIENTS_DIR)) return [];
  return fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(CLIENTS_DIR, d.name, "brand.json")))
    .map((d) => d.name);
}

export function loadClient(slug: string): Brand {
  const file = path.join(CLIENTS_DIR, slug, "brand.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const parsed = Brand.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid clients/${slug}/brand.json:\n${issues}`);
  }
  if (parsed.data.slug !== slug) {
    throw new Error(`clients/${slug}/brand.json has slug "${parsed.data.slug}" — must match folder name`);
  }
  return parsed.data;
}

/**
 * The showcase client (agency.json → showcase) is served at its own path, e.g. /main95/,
 * as a complete-looking site with a switcher to the client demos. Every other client is /<slug>/.
 */
const agency = JSON.parse(fs.readFileSync(path.resolve("agency.json"), "utf8"));
const showcase: { client?: string; path?: string } = agency.showcase ?? {};

export function isShowcase(slug: string): boolean {
  return !!showcase.client && slug === showcase.client;
}

export function pagePath(slug: string): string {
  return isShowcase(slug) && showcase.path ? showcase.path : slug;
}

/** Resolve an asset reference from brand.json to a public URL. */
export function assetUrl(slug: string, ref?: string): string | undefined {
  if (!ref) return undefined;
  if (/^https?:\/\//.test(ref)) return ref;
  return `/assets/${slug}/${ref.replace(/^\.?\/?(assets\/)?/, "")}`;
}

/** Pick black or white text for a given background hex. */
export function inkFor(bgHex: string): string {
  const n = parseInt(bgHex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? "#0b1220" : "#ffffff";
}

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits.startsWith("0") ? "+44" + digits.slice(1) : digits}`;
}
