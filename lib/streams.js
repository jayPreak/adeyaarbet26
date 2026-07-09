// Hardcoded live-stream mirror URLs, keyed by our static match id.
// Source: streamed.pk /api/matches/football + /api/stream/{source}/{id},
// snapshot fetched 2026-07-10. Third-party unofficial PPV mirrors — availability
// is not guaranteed. If a URL is dead the iframe just renders blank; never crash.
//
// To refresh:
//   curl -s https://streamed.pk/api/matches/football | jq
//   curl -s https://streamed.pk/api/stream/{source}/{id}
// and paste the resulting embedUrls below.

export const MATCH_STREAMS = {
  // QF-1: France vs Morocco — 2026-07-09 20:00 UTC
  'QF-1': [
    { label: 'TSN (EN)',     url: 'https://embed.st/embed/admin/ppv-france-vs-morocco/1' },
    { label: 'FOX (EN)',     url: 'https://embed.st/embed/admin/ppv-france-vs-morocco/3' },
    { label: 'BBC/ITV (EN)', url: 'https://embed.st/embed/admin/ppv-france-vs-morocco/5' },
  ],
  // QF-2: Spain vs Belgium — 2026-07-10 19:00 UTC
  'QF-2': [
    { label: 'TSN (EN)',     url: 'https://embed.st/embed/admin/ppv-spain-vs-belgium/1' },
    { label: 'FOX (EN)',     url: 'https://embed.st/embed/admin/ppv-spain-vs-belgium/3' },
    { label: 'BBC/ITV (EN)', url: 'https://embed.st/embed/admin/ppv-spain-vs-belgium/5' },
  ],
  // QF-3: Norway vs England — 2026-07-11 21:00 UTC (only 1 mirror listed at snapshot time)
  'QF-3': [
    { label: 'Source 1', url: 'https://embed.st/embed/golf/23677/1' },
    { label: 'Source 2', url: 'https://embed.st/embed/golf/23677/2' },
  ],
  // QF-4: Argentina vs Switzerland — 2026-07-12 01:00 UTC (streams not yet populated at snapshot)
  // Add mirrors when they appear on streamed.pk. Empty → panel simply won't render.
  'QF-4': [],
};

export function getStreams(matchId) {
  if (!matchId) return [];
  const list = MATCH_STREAMS[matchId];
  return Array.isArray(list) ? list : [];
}
