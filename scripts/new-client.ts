// Usage: npm run new -- "Joe's Heating Ltd"
// Creates clients/<slug>/ with an unguessable slug (name + random suffix).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.error('usage: npm run new -- "Business Name"');
  process.exit(1);
}
const base = name
  .toLowerCase()
  .replace(/&/g, "and")
  .replace(/\b(ltd|limited|llp|plc)\b/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 40);
const slug = `${base}-${crypto.randomBytes(3).toString("hex")}`;
const dir = path.resolve("clients", slug);
fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
console.log(slug);
