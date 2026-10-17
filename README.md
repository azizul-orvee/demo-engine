# demo-engine

One template, many prospect demos. Each lead = `clients/<slug>/brand.json` + `clients/<slug>/assets/`.
The template in `src/` is shared and is never edited per client.

## Make a demo

Give an AI agent the prospect's website, their Google Maps link, or both. In Claude Code:

```
/demo https://their-current-site.co.uk https://maps.app.goo.gl/…
```

In any other tool (Codex, Cursor, Copilot, Gemini…), say: *"Make a demo for <website> <maps link>, following AGENTS.md."*

The full pipeline is: create the client → scrape the site and read the Maps profile → pick logo/colours/photos →
write better copy → validate → build → visual check → `NOTES.md` with pitch points.
**The rules for every tool live in [`AGENTS.md`](AGENTS.md).** Reading Google Maps needs an agent with a browser
(or you can paste the profile text in).

Manual commands:

| Command | What it does |
|---|---|
| `npm run new -- "Business Name"` | Create `clients/<name>-<random>/` and print the slug |
| `npm run scrape -- <url> <slug>` | Crawl their site → `clients/<slug>/raw/` (facts, text, images) |
| `scripts/maps-extract.js` | Run in a browser on their Maps profile; save the JSON as `raw/maps.json` |
| `npm run maps-photos -- <slug>` | Download the Maps profile photos → `raw/images/maps-NN.jpg` |
| `npm run validate [-- <slug>]` | Schema errors and rule warnings (repeated proof points, accent contrast, missing NOTES.md…) |
| `npm run dev` | Local preview at http://localhost:4321/<slug>/ |
| `npm run build` | Static site in `dist/` (one page per client) |

## How it fits together

- `src/lib/schema.ts`: the brand.json contract. Optional sections that are empty don't render.
- `src/pages/[slug].astro`: builds one page per client folder.
- `src/components/*`: the sections. Change these to improve **every** demo at once.
- `agency.json`: your name/link for the "concept prepared by" banner, plus `showcase`: the client served at
  `/<showcase.path>/` (currently the fictional sample at `/main95/`) as a complete-looking site with a
  "Client demos" dropdown. Client demos never link back to it.
- Brand colours become CSS variables, and the text colour on each is picked automatically for contrast.

## Privacy

Demos are `noindex`, `robots.txt` blocks everything, `/` lists nothing, and slugs carry a random suffix.
The footer says it's a concept, not the official site. Delete client folders that don't convert after ~30 days.

## Deploy

Static output, so any static host works. Easiest: connect the repo to **Cloudflare Pages** or **Vercel**
(build command `npm run build`, output `dist`) on a domain like `demos.youragency.co.uk`.
Each new client is just a push.
