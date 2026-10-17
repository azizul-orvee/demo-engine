// Google Maps business profile -> JSON. Save the result as clients/<slug>/raw/maps.json.
//
// Google Maps only renders in a real browser (a plain fetch gets an empty JS shell), so this runs IN the page:
//   - an agent's browser tool: open the place URL with &hl=en-GB, wait ~4s, execute this file's contents;
//   - or a person: paste it into the DevTools console on the place page (the JSON is also copied to the clipboard).
// It only reads what the profile shows. Selectors use Google's data-item-id / aria-label hooks, not class names,
// so they survive restyles better; if a field comes back null, read it off the page by eye instead of guessing.
await (async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const label = (el) => (el?.getAttribute("aria-label") || el?.innerText || "").trim();
  const strip = (s, prefix) => s.replace(new RegExp(`^${prefix}:\\s*`, "i"), "").trim() || null;
  const tab = (re) => $$('button[role="tab"]').find((b) => re.test(label(b)));

  // The profile panel can render seconds after the page loads; wait for it (up to ~15s) before reading anything.
  for (let i = 0; i < 30 && !$('button[data-item-id="address"], button[data-item-id^="phone"]'); i++) await wait(500);
  tab(/overview/i)?.click();
  await wait(1200);
  const ratingText = $$('[role="img"][aria-label]').map(label).find((a) => /^\d(\.\d)?\s*stars?/i.test(a)) || "";
  const countText = $$("button, span[aria-label]").map(label).find((a) => /^[\d,]+ reviews?$/i.test(a)) || "";

  const out = {
    source: "google-maps",
    url: location.href.split("?")[0],
    readAt: new Date().toISOString(),
    name: $("h1")?.innerText.trim() || null,
    category: $('button[jsaction*="category"]')?.innerText.trim() || null,
    rating: parseFloat(ratingText) || null,
    reviewCount: parseInt(countText.replace(/,/g, ""), 10) || null,
    address: strip(label($('button[data-item-id="address"]')), "Address"),
    phone: strip(label($('button[data-item-id^="phone"]')), "Phone"),
    website: $('a[data-item-id="authority"]')?.href || null,
    plusCode: strip(label($('button[data-item-id="oloc"]')), "Plus code"),
    // "Claim this business" means the owner has never claimed the profile: a strong pitch point.
    claimed: !$$("a, button").some((e) => /claim this business/i.test(label(e))),
    hours: $$("table tr")
      .map((tr) => $$("td", tr).map((td) => td.innerText.trim().replace(/\s+/g, " ")).filter(Boolean))
      .filter((r) => r.length >= 2 && /day$/i.test(r[0]))
      .map(([day, time]) => ({ day, time })),
    // Place photos only (grass-cs / p / gps-*); /a/ URLs are reviewers' avatars and are skipped.
    photos: [...new Set($$("img").map((i) => i.currentSrc || i.src)
      .filter((s) => /googleusercontent\.com\/(grass-cs|p|gps-cs-s|gps-proxy)\//.test(s))
      .map((s) => s.split("=")[0]))],
    reviews: [],
  };

  // Reviews: open the tab, scroll its pane a few times to load more, expand truncated ones.
  tab(/reviews/i)?.click();
  await wait(2500);
  const pane = $$('[role="main"] div').find((d) => d.scrollHeight > d.clientHeight + 300 && /auto|scroll/.test(getComputedStyle(d).overflowY));
  for (let i = 0; i < 4 && pane; i++) {
    pane.scrollTop = pane.scrollHeight;
    await wait(1200);
  }
  $$('button[aria-label="See more"]').forEach((b) => b.click());
  await wait(400);
  const seen = new Set();
  for (const el of $$("[data-review-id]")) {
    const id = el.getAttribute("data-review-id");
    const stars = $('[role="img"][aria-label*="star"]', el);
    if (seen.has(id) || !stars) continue;
    seen.add(id);
    // Prefer the review body; skip the owner's reply, which sits in the same card.
    const spans = $$("span", el).filter((s) => !s.closest('[aria-label*="Response from the owner"]') && !/^Response from the owner/i.test(s.innerText));
    const text = ($(".wiI7pd", el)?.innerText || spans.map((s) => s.innerText.trim()).sort((a, b) => b.length - a.length)[0] || "").trim();
    const when = spans.map((s) => s.innerText.trim()).find((t) => /\bago$|^a (day|week|month|year) ago$/i.test(t)) || null;
    if (text) out.reviews.push({ name: label(el) || null, rating: parseInt(label(stars), 10) || null, when, text });
  }

  const json = JSON.stringify(out, null, 2);
  try { await navigator.clipboard.writeText(json); } catch {}
  return out;
})();
