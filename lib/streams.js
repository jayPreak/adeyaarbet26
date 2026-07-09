// Hardcoded live-stream mirror URLs + chat channel, keyed by our static match id.
// Source: streamed.pk /api/matches/football + /api/stream/{source}/{id},
// snapshot fetched 2026-07-10. Third-party unofficial PPV mirrors — availability
// is not guaranteed. If a URL is dead the iframe just renders blank; never crash.
//
// chatChannel = the streamed.pk top-level match id (used as WebSocket channel
// on wss://chat.cdn-lab.shop/chat?channel=...). Not always == the source id.
//
// To refresh:
//   curl -s https://streamed.pk/api/matches/football | jq
//   curl -s https://streamed.pk/api/stream/{source}/{id}
// and paste the resulting embedUrls below.

export const MATCH_STREAMS = {
  'QF-1': {
    chatChannel: 'france-vs-morocco-2515305',
    sources: [
      { label: 'TSN (EN)',     url: 'https://embed.st/embed/admin/ppv-france-vs-morocco/1' },
      { label: 'FOX (EN)',     url: 'https://embed.st/embed/admin/ppv-france-vs-morocco/3' },
      { label: 'BBC/ITV (EN)', url: 'https://embed.st/embed/admin/ppv-france-vs-morocco/5' },
    ],
  },
  'QF-2': {
    chatChannel: 'spain-vs-belgium-2519345',
    sources: [
      { label: 'TSN (EN)',     url: 'https://embed.st/embed/admin/ppv-spain-vs-belgium/1' },
      { label: 'FOX (EN)',     url: 'https://embed.st/embed/admin/ppv-spain-vs-belgium/3' },
      { label: 'BBC/ITV (EN)', url: 'https://embed.st/embed/admin/ppv-spain-vs-belgium/5' },
    ],
  },
  'QF-3': {
    chatChannel: '23677',
    sources: [
      { label: 'Source 1', url: 'https://embed.st/embed/golf/23677/1' },
      { label: 'Source 2', url: 'https://embed.st/embed/golf/23677/2' },
    ],
  },
  'QF-4': {
    chatChannel: '23678',
    sources: [],
  },
};

export function getStreams(matchId) {
  if (!matchId) return [];
  const entry = MATCH_STREAMS[matchId];
  return Array.isArray(entry?.sources) ? entry.sources : [];
}

export function getChatChannel(matchId) {
  if (!matchId) return null;
  return MATCH_STREAMS[matchId]?.chatChannel || null;
}
