'use client';

import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { useBetting } from '@/lib/BettingContext';
import { getTeam } from '@/lib/data';
import { fmtMoney } from '@/lib/currency';

const STAGE_ORDER = ['R32', 'R16', 'QF', 'SF', 'Final'];
const STAGE_LABELS = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarterfinals',
  SF: 'Semifinals',
  Final: 'Final',
  '3rd': '3rd Place',
};

function formatPlaceholder(raw) {
  if (!raw) return 'TBD';
  return raw.replace(/^W(\d+)$/, 'W$1')
            .replace(/^L(\d+)$/, 'L$1')
            .replace(/^(\d)([A-L])$/, '$2$1');
}

function formatIST(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
}

function Countdown({ kickoffTs }) {
  const [diff, setDiff] = useState('');

  useEffect(() => {
    if (!kickoffTs) return;
    function update() {
      const ms = new Date(kickoffTs).getTime() - Date.now();
      if (ms <= 0) { setDiff(''); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      if (h > 48) {
        const days = Math.floor(h / 24);
        setDiff(`${days}d ${h % 24}h`);
      } else {
        setDiff(`${h}h ${m}m ${s}s`);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [kickoffTs]);

  if (!diff) return null;
  return <span className="ko-node__countdown">{diff}</span>;
}

function KnockoutNode({ match, onTap, myBets, poolData }) {
  const home = match.home ? getTeam(match.home) : null;
  const away = match.away ? getTeam(match.away) : null;
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const hasBet = myBets.length > 0;
  const myBet = myBets[0];
  const betWon = myBets.some(b => b.status === 'won');
  const betLost = myBets.some(b => b.status === 'lost');
  const myPick = myBet?.pick;

  const homePool = poolData?.bySide?.home || 0;
  const awayPool = poolData?.bySide?.away || 0;
  const drawPool = poolData?.bySide?.draw || 0;
  const totalPool = poolData?.total || 0;
  const homePct = totalPool > 0 ? Math.round((homePool / totalPool) * 100) : 0;
  const awayPct = totalPool > 0 ? Math.round((awayPool / totalPool) * 100) : 0;

  const winner = isFinished && match.score
    ? (match.score[0] > match.score[1] ? 'home' : match.score[1] > match.score[0] ? 'away' : null)
    : null;

  const borderColor = betWon ? 'var(--win)' : betLost ? 'var(--loss)' : isLive ? 'var(--live)' : hasBet ? 'var(--gold)' : 'var(--line)';

  return (
    <button
      id={`ko-node-${match.id}`}
      className="ko-node"
      onClick={(e) => { e.stopPropagation(); onTap(match); }}
      style={{ borderColor }}
    >
      {isLive && (
        <div className="ko-node__live">
          <span className="ko-node__live-dot" />
          <span>LIVE</span>
        </div>
      )}

      <div className="ko-node__team" style={isFinished && winner === 'home' ? { background: 'rgba(0,255,133,0.06)', borderRadius: 4, margin: '-2px -4px', padding: '2px 4px' } : undefined}>
        <div className="ko-node__team-info">
          <span className="ko-node__flag">{home ? home.flag : '🏳️'}</span>
          <span className="ko-node__name" style={isFinished && winner === 'home' ? { color: 'var(--win)' } : undefined}>
            {home ? home.name : formatPlaceholder(match.placeholderA)}
          </span>
          {myPick === 'home' && <span className="ko-node__my-pick">●</span>}
        </div>
        <div className="ko-node__team-right">
          {homePool > 0 && <span className="ko-node__team-pool">{fmtMoney(homePool)}</span>}
          {(isFinished || isLive) && match.score && (
            <span className={'ko-node__score' + (isLive ? ' live' : '')} style={isFinished && winner === 'home' ? { color: 'var(--win)' } : undefined}>
              {match.score[0]}
            </span>
          )}
        </div>
      </div>

      <div className="ko-node__divider" />

      <div className="ko-node__team" style={isFinished && winner === 'away' ? { background: 'rgba(0,255,133,0.06)', borderRadius: 4, margin: '-2px -4px', padding: '2px 4px' } : undefined}>
        <div className="ko-node__team-info">
          <span className="ko-node__flag">{away ? away.flag : '🏳️'}</span>
          <span className="ko-node__name" style={isFinished && winner === 'away' ? { color: 'var(--win)' } : undefined}>
            {away ? away.name : formatPlaceholder(match.placeholderB)}
          </span>
          {myPick === 'away' && <span className="ko-node__my-pick">●</span>}
        </div>
        <div className="ko-node__team-right">
          {awayPool > 0 && <span className="ko-node__team-pool">{fmtMoney(awayPool)}</span>}
          {(isFinished || isLive) && match.score && (
            <span className={'ko-node__score' + (isLive ? ' live' : '')} style={isFinished && winner === 'away' ? { color: 'var(--win)' } : undefined}>
              {match.score[1]}
            </span>
          )}
        </div>
      </div>

      {totalPool > 0 && (
        <div className="ko-node__pool-bar">
          <div className="ko-node__pool-home" style={{ width: `${homePct}%` }} />
          <div className="ko-node__pool-away" style={{ width: `${awayPct}%` }} />
        </div>
      )}

      <div className="ko-node__footer-bar">
        <div className="ko-node__timer">
          {!isFinished && !isLive && match.kickoffTs && (
            <>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="ko-node__clock-icon">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="ko-node__timer-text">{formatIST(match.kickoffTs)}</span>
              <Countdown kickoffTs={match.kickoffTs} />
            </>
          )}
          {isFinished && <span className="ko-node__ft">FT</span>}
          {isLive && match.minute && <span className="ko-node__minute">{match.minute}'</span>}
        </div>
        <div className="ko-node__meta">
          {betWon && <span className="ko-node__badge won">WON</span>}
          {betLost && <span className="ko-node__badge lost">LOST</span>}
          {hasBet && !betWon && !betLost && <span className="ko-node__badge">{fmtMoney(myBet.amount)}</span>}
          {!hasBet && totalPool === 0 && <span className="ko-node__tap-hint">Tap ›</span>}
          {!hasBet && totalPool > 0 && <span className="ko-node__pool-total">{fmtMoney(totalPool)}</span>}
        </div>
      </div>
    </button>
  );
}

// Get element position relative to container using offsetLeft/offsetTop (unaffected by CSS transforms)
function getOffsetPos(el, container) {
  let x = 0, y = 0;
  let node = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

// SVG path between two nodes (curved bracket connector)
function computeSvgPath(fromEl, toEl, container) {
  if (!fromEl || !toEl || !container) return '';
  const from = getOffsetPos(fromEl, container);
  const to = getOffsetPos(toEl, container);

  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;

  const midX = (x1 + x2) / 2;

  // Straight horizontal if same y
  if (Math.abs(y1 - y2) < 2) {
    return `M${x1},${y1} L${x2},${y2}`;
  }

  // Curved path: horizontal out, curve down/up, horizontal in
  return `M${x1},${y1} L${midX - 8},${y1} Q${midX},${y1} ${midX},${y1 + Math.sign(y2 - y1) * 8} L${midX},${y2 - Math.sign(y2 - y1) * 8} Q${midX},${y2} ${midX + 8},${y2} L${x2},${y2}`;
}

// Build the edge list using FIFA MatchNumber + placeholder references (W73 = winner of match #73)
function buildEdges(byStage, allKnockout) {
  const edges = [];

  // Map FIFA MatchNumber → our static ID
  const matchNumToId = {};
  for (const m of allKnockout) {
    if (m.matchNumber) matchNumToId[m.matchNumber] = m.id;
  }

  // For each match with placeholders (W73, W75, etc.), link from source match
  for (const m of allKnockout) {
    for (const ph of [m.placeholderA, m.placeholderB]) {
      if (!ph) continue;
      const wMatch = ph.match(/^W(\d+)$/);
      if (wMatch) {
        const srcId = matchNumToId[parseInt(wMatch[1])];
        if (srcId) edges.push([srcId, m.id]);
      }
    }
  }

  // Fallback: positional pairing if no placeholder-based edges
  if (edges.length === 0) {
    const stages = STAGE_ORDER.filter(s => byStage[s]?.length);
    for (let i = 0; i < stages.length - 1; i++) {
      const cur = byStage[stages[i]];
      const next = byStage[stages[i + 1]];
      for (let j = 0; j < next.length; j++) {
        const srcA = cur[j * 2];
        const srcB = cur[j * 2 + 1];
        const dest = next[j];
        if (srcA && dest) edges.push([srcA.id, dest.id]);
        if (srcB && dest) edges.push([srcB.id, dest.id]);
      }
    }
  }

  return edges;
}

const STORAGE_KEY = 'ko_bracket_view_state';

function saveViewState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadViewState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.scale === 'number') return s;
  } catch {}
  return null;
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="ko-canvas__controls">
      <button className="ko-canvas__btn" onClick={() => zoomIn()}>+</button>
      <button className="ko-canvas__btn" onClick={() => zoomOut()}>−</button>
      <button className="ko-canvas__btn" onClick={() => { resetTransform(); saveViewState({ scale: 0.65, positionX: 0, positionY: 0 }); }}>⟲</button>
    </div>
  );
}

export default function KnockoutPage() {
  const { matches, openBet, bets, poolMap } = useBetting();
  const bracketRef = useRef(null);
  const readyRef = useRef(false);
  const wrapperRef = useRef(null);
  const [paths, setPaths] = useState([]);

  const knockoutMatches = useMemo(() => {
    return matches.filter(m => m.knockout);
  }, [matches]);

  const byStage = useMemo(() => {
    const grouped = {};
    for (const m of knockoutMatches) {
      const stage = m.stage || 'R32';
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(m);
    }
    return grouped;
  }, [knockoutMatches]);

  const edges = useMemo(() => buildEdges(byStage, knockoutMatches), [byStage, knockoutMatches]);

  const betStatusByMatch = useMemo(() => {
    const map = {};
    for (const b of bets) {
      if (b.status === 'cancelled') continue;
      const mid = b.match_id || b.matchId;
      if (!map[mid]) map[mid] = b.status;
      if (b.status === 'won') map[mid] = 'won';
      else if (b.status === 'lost' && map[mid] !== 'won') map[mid] = 'lost';
    }
    return map;
  }, [bets]);

  const computePaths = useCallback(() => {
    const container = bracketRef.current;
    if (!container || !edges.length) { setPaths([]); return; }
    const result = [];
    for (const [fromId, toId] of edges) {
      const fromEl = container.querySelector(`#ko-node-${CSS.escape(fromId)}`);
      const toEl = container.querySelector(`#ko-node-${CSS.escape(toId)}`);
      const p = computeSvgPath(fromEl, toEl, container);
      if (p) {
        const status = betStatusByMatch[fromId];
        const color = status === 'won' ? 'var(--win)' : status === 'lost' ? 'var(--loss)' : null;
        result.push({ d: p, color });
      }
    }
    setPaths(result);
  }, [edges, betStatusByMatch]);

  // Recompute paths after layout
  useLayoutEffect(() => {
    const t = setTimeout(computePaths, 60);
    return () => clearTimeout(t);
  }, [computePaths, knockoutMatches]);

  // readyRef gates saves — only allow after restore is done

  function handleTap(match) {
    const betMatch = {
      id: match.id,
      home: match.home || 'TBD',
      away: match.away || 'TBD',
      status: match.status,
      kickoffTs: match.kickoffTs,
    };
    openBet(betMatch, 'home');
  }

  if (!knockoutMatches.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
        Loading bracket...
      </div>
    );
  }

  const thirdPlace = byStage['3rd'] || [];

  return (
    <div>
      <div style={{ padding: '6px 20px 2px', fontSize: 10, color: 'var(--ink-3)' }}>
        Pinch to zoom · Drag to pan · Tap match to bet
      </div>
      <div className="ko-canvas">
        <TransformWrapper
          ref={wrapperRef}
          initialScale={0.65}
          initialPositionX={0}
          initialPositionY={0}
          minScale={0.3}
          maxScale={2.5}
          limitToBounds={false}
          doubleClick={{ disabled: true }}
          onInit={(ref) => {
            const saved = loadViewState();
            if (saved && ref) {
              ref.setTransform(saved.positionX, saved.positionY, saved.scale, 0);
            }
            // Delay enabling saves to prevent onTransform from overwriting with init values
            setTimeout(() => { readyRef.current = true; }, 300);
          }}
          onTransform={(_, state) => { if (readyRef.current) saveViewState(state); }}
        >
          <ZoomControls />
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ padding: 16 }}>
            <div className="ko-bracket" ref={bracketRef} style={{ position: 'relative' }}>
              {/* SVG overlay for connector lines */}
              <svg className="ko-bracket__svg">
                {paths.map((p, i) => (
                  <path key={i} d={p.d} fill="none" stroke={p.color || 'rgba(255,255,255,0.15)'} strokeWidth="1.5" opacity={p.color ? 0.7 : 1} />
                ))}
              </svg>

              {STAGE_ORDER.map((stage) => {
                const stageMatches = byStage[stage] || [];
                if (!stageMatches.length) return null;
                const isGold = stage === 'Final';
                return (
                  <div key={stage} className="ko-bracket__round">
                    <div className={'ko-bracket__title' + (isGold ? ' gold' : '')}>
                      {STAGE_LABELS[stage]}
                    </div>
                    <div className="ko-bracket__matches">
                      {stageMatches.map(m => {
                        const myBets2 = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status !== 'cancelled');
                        return (
                          <KnockoutNode
                            key={m.id}
                            match={m}
                            onTap={handleTap}
                            myBets={myBets2}
                            poolData={poolMap[m.id]}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {thirdPlace.length > 0 && (
              <div style={{ marginTop: 20, paddingLeft: 4 }}>
                <div className="ko-bracket__title">3rd Place</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {thirdPlace.map(m => {
                    const myBets2 = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status !== 'cancelled');
                    return <KnockoutNode key={m.id} match={m} onTap={handleTap} myBets={myBets2} poolData={poolMap[m.id]} />;
                  })}
                </div>
              </div>
            )}
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}
