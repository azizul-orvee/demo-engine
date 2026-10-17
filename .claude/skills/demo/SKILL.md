---
name: demo
description: Build a personalised demo website for a UK heating/boiler/HVAC engineer from their website, their Google Maps profile, or both. Use when the user runs /demo <url> [<maps url>], pastes a prospect's site or Maps link, or asks to make a demo/concept site for a prospect.
argument-hint: <website url> and/or <google maps url>
---

# /demo — build a prospect demo

Inputs: `$ARGUMENTS` (a website URL, a Google Maps link, or both, in any order; a `maps.app.goo.gl` or
`google.com/maps` link is the Maps one).

Follow **`AGENTS.md`** at the repo root step by step. It is the single playbook shared with other AI tools, so don't
work from memory of older versions of these rules.

Claude Code specifics:

- For the Google Maps step, use the built-in browser (or Claude in Chrome): open the link with `hl=en-GB`, wait
  about 4s, run `scripts/maps-extract.js` with the JavaScript tool, and save the returned JSON to `raw/maps.json`.
- For the visual check, start the `demo-engine` preview (or `demo-engine-build` if port 4321 is taken) and check
  `/<slug>/` at desktop and 375px.
- Finish with the report described in AGENTS.md step 9.
