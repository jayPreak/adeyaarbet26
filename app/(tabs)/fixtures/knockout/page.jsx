'use client';

import { useState, useEffect, useMemo } from 'react';
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
  return <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{diff}</span>;
}

function KnockoutNode({ match, onTap, myBets, poolData }) {
  const home = match.home ? getTeam(match.home) : null;
  const away = match.away ? getTeam(match.away) : null;
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const hasBet = myBets.length > 0;

  return (
    <button className="ko-node" onClick={(e) => { e.stopPropagation(); onTap(match); }}>
      {isLive && (
        <div className="ko-node__live">
          <span className="ko-node__live-dot" />
          <span>LIVE</span>
        </div>
      )}

      <div className="ko-node__team">
        <div className="ko-node__team-info">
          <span className="ko-node__flag">{home ? home.flag : '🏳️'}</span>
          <span className="ko-node__name">{home ? home.name : formatPlaceholder(match.placeholderA)}</span>
        </div>
        {(isFinished || isLive) && match.score && (
          <span className={'ko-node__score' + (isLive ? ' live' : '')}>{match.score[0]}</span>
        )}
      </div>

      <div className="ko-node__divider" />

      <div className="ko-node__team">
        <div className="ko-node__team-info">
          <span className="ko-node__flag">{away ? away.flag : '🏳️'}</span>
          <span className="ko-node__name">{away ? away.name : formatPlaceholder(match.placeholderB)}</span>
        </div>
        {(isFinished || isLive) && match.score && (
          <span className={'ko-node__score' + (isLive ? ' live' : '')}>{match.score[1]}</span>
        )}
      </div>

      <div className="ko-node__footer">
        <div className="ko-node__time">
          {!isFinished && !isLive && match.kickoffTs && (
            <>
              <span>{formatIST(match.kickoffTs)}</span>
              <Countdown kickoffTs={match.kickoffTs} />
            </>
          )}
          {isFinished && <span>Full time</span>}
        </div>
        <div className="ko-node__meta">
          {hasBet && <span className="ko-node__badge">BET</span>}
          {poolData && poolData.total > 0 && (
            <span className="ko-node__pool">{fmtMoney(poolData.total)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function BracketConnectors({ count }) {
  const pairs = count / 2;
  return (
    <div className="ko-connectors">
      {Array.from({ length: pairs }, (_, i) => (
        <div key={i} className="ko-connector-pair">
          <div className="ko-connector-line ko-connector-top" />
          <div className="ko-connector-line ko-connector-bot" />
          <div className="ko-connector-merge" />
        </div>
      ))}
    </div>
  );
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
  const saved = useMemo(() => loadViewState(), []);

  return (
    <div>
      <div style={{ padding: '6px 20px 2px', fontSize: 10, color: 'var(--ink-3)' }}>
        Pinch to zoom · Drag to pan · Tap match to bet
      </div>
      <div className="ko-canvas">
        <TransformWrapper
          initialScale={saved?.scale || 0.65}
          initialPositionX={saved?.positionX || 0}
          initialPositionY={saved?.positionY || 0}
          minScale={0.3}
          maxScale={2.5}
          limitToBounds={false}
          doubleClick={{ disabled: true }}
          onTransformed={(_, state) => { saveViewState({ scale: state.scale, positionX: state.positionX, positionY: state.positionY }); }}
        >
          <ZoomControls />
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ padding: 16 }}>
            <div className="ko-bracket">
              {STAGE_ORDER.map((stage, idx) => {
                const stageMatches = byStage[stage] || [];
                if (!stageMatches.length) return null;
                const isGold = stage === 'Final';
                const nextStage = STAGE_ORDER[idx + 1];
                const nextCount = byStage[nextStage]?.length || 0;
                const showConnectors = nextCount > 0 && stageMatches.length === nextCount * 2;
                return (
                  <div key={stage} className="ko-bracket__stage-group">
                    <div className="ko-bracket__round">
                      <div className={'ko-bracket__title' + (isGold ? ' gold' : '')}>
                        {STAGE_LABELS[stage]}
                      </div>
                      <div className="ko-bracket__matches">
                        {stageMatches.map(m => {
                          const myBets2 = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending');
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
                    {showConnectors && <BracketConnectors count={stageMatches.length} />}
                  </div>
                );
              })}
            </div>

            {thirdPlace.length > 0 && (
              <div style={{ marginTop: 20, paddingLeft: 4 }}>
                <div className="ko-bracket__title">3rd Place</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {thirdPlace.map(m => {
                    const myBets2 = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending');
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
