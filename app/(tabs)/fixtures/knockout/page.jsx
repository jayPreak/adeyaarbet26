'use client';

import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { useBetting } from '@/lib/BettingContext';
import { getTeam } from '@/lib/data';
import { fmtMoney, getMinBet, CURRENCY_SYMBOL } from '@/lib/currency';

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


function KnockoutNode({ match, onTap, myBets, poolData }) {
  const home = match.home ? getTeam(match.home) : null;
  const away = match.away ? getTeam(match.away) : null;
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const hasBet = myBets.length > 0;
  const myBet = myBets[0];
  const betWon = myBets.some(b => b.status === 'won');
  const betLost = myBets.some(b => b.status === 'lost');

  const myPick = myBet?.pick; // 'home' | 'away' | 'draw'

  const winner = isFinished && match.score
    ? (match.score[0] > match.score[1] ? 'home' : match.score[1] > match.score[0] ? 'away' : null)
    : null;

  // Minimal: only live gets a distinct border
  const borderColor = isLive ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.08)';
  // Slightly dim finished no-bet matches (0.65 not 0.5 — still readable)
  const nodeOpacity = isFinished && !hasBet ? 0.65 : 1;

  // Tiny left accent for bet status (like a 3px colored strip)
  const accentColor = betWon ? 'var(--win)' : betLost ? 'var(--loss)' : hasBet ? 'var(--gold)' : 'transparent';

  return (
    <button
      id={`ko-node-${match.id}`}
      className="ko-node"
      onClick={(e) => { e.stopPropagation(); onTap(match); }}
      style={{ borderColor, opacity: nodeOpacity, borderLeftColor: accentColor, borderLeftWidth: hasBet || betWon || betLost ? 3 : 1.5 }}
    >
      {isLive && (
        <div className="ko-node__live">
          <span className="ko-node__live-dot" />
          <span>LIVE</span>
        </div>
      )}

      {/* Home team row */}
      <div className="ko-node__team">
        <div className="ko-node__team-info">
          <span className="ko-node__flag">{home ? home.flag : '🏳️'}</span>
          <span className="ko-node__name" style={{
            fontWeight: winner === 'home' ? 700 : 400,
            color: winner && winner !== 'home' ? 'var(--ink-3)' : 'var(--ink)',
          }}>
            {home ? home.name : formatPlaceholder(match.placeholderA)}
          </span>
          {myPick === 'home' && <span className="ko-node__pick-chip">Pick</span>}
        </div>
        {(isFinished || isLive) && match.score && (
          <span className="ko-node__score" style={{
            fontWeight: winner === 'home' || winner === 'draw' ? 700 : 400,
            color: isLive ? 'var(--ink)' : winner === 'home' || winner === 'draw' ? 'var(--ink)' : 'var(--ink-3)',
          }}>
            {match.score[0]}
          </span>
        )}
      </div>

      <div className="ko-node__divider" />

      {/* Away team row */}
      <div className="ko-node__team">
        <div className="ko-node__team-info">
          <span className="ko-node__flag">{away ? away.flag : '🏳️'}</span>
          <span className="ko-node__name" style={{
            fontWeight: winner === 'away' ? 700 : 400,
            color: winner && winner !== 'away' ? 'var(--ink-3)' : 'var(--ink)',
          }}>
            {away ? away.name : formatPlaceholder(match.placeholderB)}
          </span>
          {myPick === 'away' && <span className="ko-node__pick-chip">Pick</span>}
        </div>
        {(isFinished || isLive) && match.score && (
          <span className="ko-node__score" style={{
            fontWeight: winner === 'away' || winner === 'draw' ? 700 : 400,
            color: isLive ? 'var(--ink)' : winner === 'away' || winner === 'draw' ? 'var(--ink)' : 'var(--ink-3)',
          }}>
            {match.score[1]}
          </span>
        )}
      </div>

      {/* Footer: minimal — just status + time */}
      <div className="ko-node__footer">
        {isLive && match.minute && <span className="ko-node__minute">{match.minute}'</span>}
        {isFinished && <span className="ko-node__ft">FT</span>}
        {!isFinished && !isLive && match.kickoffTs && (
          <span className="ko-node__timer-text">{formatIST(match.kickoffTs)}</span>
        )}
        {hasBet && (
          <span className="ko-node__bet-tag" style={{
            color: betWon ? 'var(--win)' : betLost ? 'var(--loss)' : 'var(--ink-2)',
          }}>
            {betWon ? `+${fmtMoney((myBet.payout || 0) - myBet.amount)}` : betLost ? `-${fmtMoney(myBet.amount)}` : fmtMoney(myBet.amount)}
          </span>
        )}
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

// Build bracket edges by matching teams across stages, with placeholder fallback.
function buildEdges(byStage, allKnockout) {
  const edges = [];
  const stages = STAGE_ORDER.filter(s => byStage[s]?.length);

  // matchNumber → match lookup for placeholder resolution
  const byMatchNum = {};
  for (const m of allKnockout) {
    if (m.matchNumber) byMatchNum[m.matchNumber] = m;
  }

  for (let i = 1; i < stages.length; i++) {
    const children = byStage[stages[i - 1]];
    const parents = byStage[stages[i]];
    const childIds = new Set(children.map(c => c.id));

    for (const parent of parents) {
      for (const [team, placeholder] of [[parent.home, parent.placeholderA], [parent.away, parent.placeholderB]]) {
        // Method 1: team match
        if (team) {
          const src = children.find(c => c.home === team || c.away === team);
          if (src) { edges.push([src.id, parent.id]); continue; }
        }
        // Method 2: placeholder W{matchNumber}
        if (placeholder) {
          const wMatch = placeholder.match(/^W(\d+)$/);
          if (wMatch) {
            const srcMatch = byMatchNum[parseInt(wMatch[1])];
            if (srcMatch && childIds.has(srcMatch.id)) {
              edges.push([srcMatch.id, parent.id]); continue;
            }
          }
        }
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
    // Reorder nodes so paired matches are adjacent (standard bracket tree layout).
    // For each parent match, find its two feeder children by:
    // 1. Team matching (if teams are resolved)
    // 2. Placeholder/matchNumber matching (W73 → child with matchNumber 73)
    const stages = STAGE_ORDER.filter(s => grouped[s]?.length);

    // Build matchNumber → match lookup across all knockout matches
    const byMatchNum = {};
    for (const stage of stages) {
      for (const m of grouped[stage]) {
        if (m.matchNumber) byMatchNum[m.matchNumber] = m;
      }
    }

    for (let i = stages.length - 1; i >= 1; i--) {
      const parentStage = stages[i];
      const childStage = stages[i - 1];
      const parents = grouped[parentStage];
      const children = grouped[childStage];
      if (!parents?.length || !children?.length) continue;

      const childIds = new Set(children.map(c => c.id));
      const ordered = [];
      const placed = new Set();

      for (const parent of parents) {
        // Try team matching first, then placeholder matching
        for (const [team, placeholder] of [[parent.home, parent.placeholderA], [parent.away, parent.placeholderB]]) {
          // Method 1: team name match
          if (team) {
            const child = children.find(c => !placed.has(c.id) && (c.home === team || c.away === team));
            if (child) { ordered.push(child); placed.add(child.id); continue; }
          }
          // Method 2: placeholder W{matchNumber} match
          if (placeholder) {
            const wMatch = placeholder.match(/^W(\d+)$/);
            if (wMatch) {
              const srcMatch = byMatchNum[parseInt(wMatch[1])];
              if (srcMatch && childIds.has(srcMatch.id) && !placed.has(srcMatch.id)) {
                ordered.push(srcMatch); placed.add(srcMatch.id); continue;
              }
            }
          }
        }
      }
      // Append any unmatched children
      for (const c of children) {
        if (!placed.has(c.id)) ordered.push(c);
      }
      if (ordered.length === children.length) {
        grouped[childStage] = ordered;
      }
    }
    return grouped;
  }, [knockoutMatches]);

  const edges = useMemo(() => buildEdges(byStage, knockoutMatches), [byStage, knockoutMatches]);


  const computePaths = useCallback(() => {
    const container = bracketRef.current;
    if (!container || !edges.length) { setPaths([]); return; }
    const result = [];
    for (const [fromId, toId] of edges) {
      const fromEl = container.querySelector(`#ko-node-${CSS.escape(fromId)}`);
      const toEl = container.querySelector(`#ko-node-${CSS.escape(toId)}`);
      const p = computeSvgPath(fromEl, toEl, container);
      if (p) {
        result.push({ d: p });
      }
    }
    setPaths(result);
  }, [edges]);

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
          limitToBounds={true}
          centerZoomedOut={true}
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
                  <path key={i} d={p.d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
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
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--ink-3)', marginLeft: 6 }}>
                        min {CURRENCY_SYMBOL}{getMinBet(`${stage}-1`)}
                      </span>
                    </div>
                    <div className="ko-bracket__matches">
                      {stageMatches.map(m => {
                        const myBets2 = bets.filter(b => (b.match_id || b.matchId) === m.id && (b.kind === 'match' || b.kind === 'penalty') && b.status !== 'cancelled');
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
                    const myBets2 = bets.filter(b => (b.match_id || b.matchId) === m.id && (b.kind === 'match' || b.kind === 'penalty') && b.status !== 'cancelled');
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
