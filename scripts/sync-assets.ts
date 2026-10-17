// Copies clients/<slug>/assets/* -> public/assets/<slug>/* so the template can serve them.
import fs from "node:fs";
import path from "node:path";

const clients = path.resolve("clients");
const out = path.resolve("public/assets");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let n = 0;
for (const slug of fs.existsSync(clients) ? fs.readdirSync(clients) : []) {
  const src = path.join(clients, slug, "assets");
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(out, slug), { recursive: true });
  n++;
}
console.log(`synced assets for ${n} client(s)`);
