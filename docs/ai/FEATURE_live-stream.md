# Feature Spec: Live match stream on Home page

**Status:** NOT STARTED. Spec only. Written before a context clear so a fresh
agent can implement without prior conversation.

Read root `CLAUDE.md` first (esp. Known Failure Modes). This feature is
display-only — it touches NO money/betting/settlement logic.

---

## What the user wants

When a World Cup match is **live**, show an embedded video stream on the
**Home page** (`components/screens/HomeScreen.jsx`), near the featured/hero
match card. Users can **switch between 2–3 stream sources** (mirrors) because
streams flake/buffer. All inline on the homepage — no new route.

## Decisions already made (do NOT re-litigate)

1. **Placement:** on the Home page, near the HeroMatch. A collapsible
   "📺 Watch live" panel. **Default COLLAPSED** — embedded streams autoplay,
   eat mobile data/battery, may carry ads. User taps to open.
2. **Source switching:** a small row of buttons "Source 1 / 2 / 3" (or
   HD/language labels) to swap the iframe `src` between mirrors of the SAME
   match. Streams die often; switching is the whole point.
3. **No runtime blocking API call.** The user explicitly does NOT want a
   live fetch to streamed.pk on page load. Instead: **call the API ONCE at
   build/dev time, hardcode the resulting embed URLs into a static config**
   (e.g. `lib/streams.js`). Only ~few matches left in the tournament, so a
   static map keyed by static match id (A1…L6, R16-*, QF-*, SF-*, FIN) is
   fine and cheapest.
4. Third-party unofficial PPV embeds — availability is out of our control.
   Pure convenience overlay. If a slug/URL is dead, the iframe just shows
   blank; never crash.

## The stream source: streamed.pk API (free, no auth)

Docs: https://streamed.pk/docs/matches and https://streamed.pk/docs/streams
Base URL: `https://streamed.pk`

### Get matches
- `GET /api/matches/football` — all football matches
- `GET /api/matches/live` — currently live
- `GET /api/matches/all-today`

Match object shape:
```json
{
  "id": "match_123",
  "title": "France vs Morocco",
  "category": "football",
  "date": 1720598400000,
  "poster": "…",
  "popular": true,
  "teams": { "home": {"name":"France","badge":"…"}, "away": {"name":"Morocco","badge":"…"} },
  "sources": [ {"source":"alpha","id":"…"}, {"source":"bravo","id":"…"} ]
}
```

### Get streams for a match source
- `GET /api/stream/[source]/[id]`  (source ∈ alpha,bravo,charlie,delta,echo,foxtrot,golf,hotel,intel)

Stream object shape:
```json
[ { "id":"…", "streamNo":1, "language":"English", "hd":true,
    "embedUrl":"https://embed.example.com/watch?v=…", "source":"alpha" } ]
```
→ The `embedUrl` goes straight into `<iframe src>`.

### EXACT iframes the user shared (VERBATIM — preserve these)

The user provided two working embed iframes for the France vs Morocco match.
The ONLY difference between them is the trailing number = the **stream
source/mirror** (`/1` vs `/3` = different feeds of the SAME match; if one
buffers/dies, switch to the other). This is exactly the "switch between
sources 1–3" behavior to build.

```html
<iframe title="France vs Morocco Player" marginheight="0" marginwidth="0" src="https://embed.st/embed/admin/ppv-france-vs-morocco/1" scrolling="no" allowfullscreen="yes" allow="encrypted-media; picture-in-picture;" width="100%" height="100%" frameborder="0"></iframe>
```
```html
<iframe title="France vs Morocco Player" marginheight="0" marginwidth="0" src="https://embed.st/embed/admin/ppv-france-vs-morocco/3" scrolling="no" allowfullscreen="yes" allow="encrypted-media; picture-in-picture;" width="100%" height="100%" frameborder="0"></iframe>
```

embed.st slug pattern (inferred): `https://embed.st/embed/admin/ppv-{home}-vs-{away}/{sourceNo}`
where `{home}`/`{away}` are full team names lowercased, spaces→hyphens
(`france`, `morocco`), and `{sourceNo}` is 1,2,3… for mirrors.

⚠️ This slug pattern is UNVERIFIED for other matchups (could be curated per
event). The streamed.pk `/api/matches` + `/api/stream` route is the reliable
enumerable source — prefer it. Keep embed.st as a documented fallback / for
matches where the slug happens to work. The hardcoded `MATCH_STREAMS` map
should just store final iframe `src` URLs regardless of which provider they
came from — the UI doesn't care about the provider, only the URL + a label.

Iframe attributes to keep from the user's example:
`allow="encrypted-media; picture-in-picture;"`, `allowfullscreen`,
`scrolling="no"`, `frameborder="0"`, responsive `width:100%` in a 16:9 wrapper.

## Build-time data-gathering step (do this first, in the implementing session)

1. `curl -s https://streamed.pk/api/matches/football` (and `/live`,
   `/all-today`) → find the remaining WC matches (QF/SF/Final).
2. For each, read `sources[]`, then `curl /api/stream/{source}/{id}` to get
   the actual `embedUrl`s (2–3 per match).
3. Hardcode into `lib/streams.js` as a map:
   ```js
   // key = our static match id (see lib/data.js MATCHES + knockout ids)
   export const MATCH_STREAMS = {
     'QF-1': [
       { label: 'Source 1', url: 'https://…embedUrl1' },
       { label: 'Source 2', url: 'https://…embedUrl2' },
     ],
     // …
   };
   export function getStreams(matchId) { return MATCH_STREAMS[matchId] || []; }
   ```
   NOTE: mapping streamed.pk titles ("France vs Morocco") → our static match
   id needs the team codes. Use `getTeam().name` from lib/data.js to match on
   home/away names. Confirm the id mapping by hand for the few live matches.

## UI implementation

- New component, e.g. `components/LiveStreamPanel.jsx`:
  - Props: `match` (our match object, has `.id`, `.home`, `.away`, `.status`).
  - `const streams = getStreams(match.id)` — if empty, render nothing.
  - Collapsed by default: a tappable bar "📺 Watch <Home> vs <Away> — live".
  - Expanded: `<iframe>` (16:9, `width:100%`, `allowfullscreen`,
    `allow="encrypted-media; picture-in-picture"`) + a row of source buttons
    that set which stream index is active (`useState`).
  - `loading="lazy"` on the iframe; only mount the iframe when expanded (don't
    render offscreen iframes — they autoplay/consume data).
- Render it in `HomeScreen.jsx` for live matches. HomeScreen already computes
  `const live = matches.filter(m => m.status === 'live')` and
  `const featured = live[0] || upcoming[0]`. Place the panel right ABOVE the
  `<HeroMatch>` (line ~242) when `featured?.status === 'live'`, OR iterate all
  `live` matches. Keep it above the hero card per user ("above it").

## Guardrails / gotchas

- iframe sandboxing: these PPV embeds often try popups/redirects. Consider
  `sandbox="allow-scripts allow-same-origin allow-presentation"` — but test,
  as too strict a sandbox can break the player. Start WITHOUT sandbox to
  confirm it plays, then tighten if popups are abusive.
- Do NOT block Home render on anything stream-related. Static map = instant.
- Mobile: iframe must be responsive (aspect-ratio 16/9 wrapper).
- This is display-only. No changes to bets, pools, settlement, RPCs.
- Follow Documentation Protocol on commit (CHANGELOG, SESSION_LOG, STATE).

## Acceptance

- On Home, when a match is live and has a stream mapping, a collapsed
  "Watch live" bar appears above the hero card.
- Tapping expands an embedded player; source buttons switch mirrors.
- No stream mapping → nothing shows. Dead URL → blank iframe, no crash.
- Zero new runtime API calls to streamed.pk (static hardcoded map).
