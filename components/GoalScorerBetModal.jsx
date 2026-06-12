'use client';

import { useState, useEffect } from 'react';
import { MATCHES, getTeam, getMatch } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { Flag, Icon } from './index';

const POSITION_COLORS = { GK: '#6b7280', DEF: '#3b82f6', MID: '#22c55e', FWD: '#f97316' };

function PlayerButton({ player, selected, disabled, onClick }) {
  const posColor = POSITION_COLORS[player.position_label] || '#6b7280';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 10px', borderRadius: 10, textAlign: 'left',
        background: selected ? 'rgba(0,255,133,0.14)' : '#1A1D24',
        border: selected ? '1px solid #00FF85' : '1px solid rgba(255,255,255,0.10)',
        color: '#F2F3F5', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !selected ? 0.5 : 1,
        transition: 'border-color 0.12s ease, background 0.12s ease',
        minWidth: 0, width: '100%',
      }}
    >
      <span style={{
        minWidth: 22, fontSize: 11, fontFamily: 'var(--font-mono)',
        color: '#8089A0', textAlign: 'right', flexShrink: 0,
      }}>
        {player.jersey_num ?? ''}
      </span>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player.player_name}
      </span>
      {player.position_label && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
          background: `${posColor}22`, color: posColor, flexShrink: 0,
        }}>
          {player.position_label}
        </span>
      )}
    </button>
  );
}

function PicksView({ picks, pool, currentUserId }) {
  const total = pool?.total || 0;
  if (!picks.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#8089A0', fontSize: 13 }}>
        No bets placed yet
      </div>
    );
  }
  return (
    <div>
      {picks.map((p, i) => {
        const share = total > 0 && pool.byPlayer[p.pick] > 0
          ? Math.floor((p.amount / pool.byPlayer[p.pick]) * total)
          : 0;
        const isMe = p.user_id === currentUserId;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#8089A0', border: isMe ? '2px solid #00FF85' : 'none',
            }}>
              {!p.avatar_url && (p.display_name?.[0] || '?')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isMe ? '#00FF85' : '#F2F3F5' }}>
                {p.display_name}{isMe ? ' (you)' : ''}
              </div>
              <div style={{ fontSize: 11, color: '#8089A0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.player_name}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8089A0' }}>{fmtMoney(p.amount)}</div>
              {share > 0 && (
                <div style={{ fontSize: 10, color: '#00FF85', fontFamily: 'var(--font-mono)' }}>
                  wins {fmtMoney(share)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GoalScorerBetModal({ open, onClose, matchId, user, onPlaced }) {
  const match    = matchId ? getMatch(matchId) : null;
  const homeTeam = match ? getTeam(match.home) : null;
  const awayTeam = match ? getTeam(match.away) : null;

  const [players,    setPlayers]    = useState({ home: [], away: [], homeCode: null, awayCode: null });
  const [loadingPl,  setLoadingPl]  = useState(false);
  const [playerErr,  setPlayerErr]  = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [amount,     setAmount]     = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [view,       setView]       = useState('pick'); // 'pick' | 'picks'
  const [poolData,   setPoolData]   = useState(null);
  const [picks,      setPicks]      = useState([]);
  const [myBet,      setMyBet]      = useState(null);
  const [justPlaced, setJustPlaced] = useState(false);

  useEffect(() => {
    if (!open || !matchId) return;
    setSelected(null);
    setError(null);
    setJustPlaced(false);
    loadPlayers();
    loadPool();
  }, [open, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync inputs when myBet loads
  useEffect(() => {
    if (!open || !myBet) return;
    setSelected(myBet.pick);
    setAmount(myBet.amount);
    setView('picks');
  }, [open, myBet?.pick, myBet?.amount]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlayers() {
    setLoadingPl(true);
    setPlayerErr(null);
    try {
      const res  = await fetch(`/api/goalscorer-players/${matchId}`);
      const data = await res.json();
      if (res.ok) setPlayers(data.players || { home: [], away: [] });
      else setPlayerErr(data.error || 'Failed to load players');
    } catch {
      setPlayerErr('Failed to load players');
    } finally {
      setLoadingPl(false);
    }
  }

  async function loadPool() {
    try {
      const url = user?.id
        ? `/api/goalscorer-bet?match_id=${matchId}&user_id=${user.id}`
        : `/api/goalscorer-bet?match_id=${matchId}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setPoolData(data.pool  || null);
        setPicks(data.picks    || []);
        setMyBet(data.myBet    || null);
      }
    } catch { /* ignore */ }
  }

  async function handleSubmit() {
    if (!user || !selected || !matchId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/goalscorer-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId, playerId: selected, amount }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to place bet'); return; }
      onPlaced?.(data);
      setJustPlaced(true);
      setMyBet({ ...data, pick: selected });
      setView('picks');
      loadPool();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!user || !matchId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/goalscorer-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to cancel'); return; }
      setMyBet(null);
      setSelected(null);
      setView('pick');
      loadPool();
      onPlaced?.(data);
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !match) return null;

  const presets    = [250, 500, 1000, 2000].filter(p => p <= MAX_BET);
  const sliderMax  = Math.max(100, MAX_BET);
  const hasBet     = !!myBet;
  const isChange   = hasBet && (selected !== myBet.pick || amount !== myBet.amount);
  const canSubmit  = !submitting && !!selected && amount > 0 && amount <= MAX_BET && (!hasBet || isChange);
  const submitLabel = submitting
    ? 'Placing…'
    : amount > MAX_BET ? `Max ${CURRENCY_SYMBOL}${MAX_BET.toLocaleString('en-IN')}`
    : !selected ? 'Pick a player'
    : hasBet ? (isChange ? 'Update pick' : 'Done') : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`;
  const finalOnClick = canSubmit ? handleSubmit : (hasBet && !isChange ? onClose : undefined);

  const allPlayers = [...(players.home || []), ...(players.away || [])];

  return (
    <div className="sheet-backdrop gs-modal" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>⚽</span>
            <div style={{ minWidth: 0 }}>
              <div className="display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
                {justPlaced ? '🎉 Bet placed!' : 'Anytime Goalscorer'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                <Flag code={match.home} size="xs" style={{ display: 'inline' }} />
                {' '}{homeTeam?.name} vs {awayTeam?.name}{' '}
                <Flag code={match.away} size="xs" style={{ display: 'inline' }} />
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--line)',
            color: 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}>
            {Icon.close}
          </button>
        </div>

        {/* View switcher */}
        {(hasBet || picks.length > 0) && (
          <div className="gs-modal__viewswitch">
            <button type="button" className={view === 'pick' ? 'active' : ''} onClick={() => setView('pick')}>
              {hasBet ? 'Change pick' : 'Pick player'}
            </button>
            <button type="button" className={view === 'picks' ? 'active' : ''} onClick={() => { setView('picks'); loadPool(); }}>
              See picks ({picks.length})
            </button>
          </div>
        )}

        {/* Body */}
        <div className="gs-modal__body">
          {view === 'picks' ? (
            <PicksView picks={picks} pool={poolData} currentUserId={user?.id} />
          ) : loadingPl ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8089A0', fontSize: 13 }}>
              Loading squad…
            </div>
          ) : playerErr ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#f87171', fontSize: 13 }}>
              {playerErr}
              <br />
              <button onClick={loadPlayers} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 12px', color: '#F2F3F5', fontSize: 12, cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          ) : allPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#8089A0', fontSize: 13 }}>
              Squad not yet available
            </div>
          ) : (
            <>
              {hasBet && myBet && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', marginBottom: 12,
                  background: 'rgba(0,255,133,0.10)', border: '1px solid rgba(0,255,133,0.45)',
                  borderRadius: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8089A0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Your current pick</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F2F3F5', marginTop: 1 }}>
                      {myBet.player_name || myBet.pick} · {fmtMoney(myBet.amount)}
                    </div>
                  </div>
                  <button onClick={handleCancel} disabled={submitting} style={{
                    background: 'none', border: '1px solid rgba(248,113,113,0.35)',
                    borderRadius: 8, padding: '5px 10px', color: '#f87171',
                    fontSize: 11, cursor: 'pointer', flexShrink: 0,
                  }}>
                    Cancel
                  </button>
                </div>
              )}

              {/* Two-column player grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Home team */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Flag code={match.home} size="sm" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8089A0' }}>{homeTeam?.name}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(players.home || []).map(p => (
                      <PlayerButton
                        key={p.player_id}
                        player={p}
                        selected={selected === p.player_id}
                        disabled={false}
                        onClick={() => setSelected(selected === p.player_id ? null : p.player_id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Away team */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Flag code={match.away} size="sm" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8089A0' }}>{awayTeam?.name}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(players.away || []).map(p => (
                      <PlayerButton
                        key={p.player_id}
                        player={p}
                        selected={selected === p.player_id}
                        disabled={false}
                        onClick={() => setSelected(selected === p.player_id ? null : p.player_id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="gs-modal__footer">
          {view === 'picks' ? (
            <button onClick={onClose} className="gs-modal__submit">Done</button>
          ) : (
            <>
              {allPlayers.length > 0 && (
                <>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span className="eyebrow" style={{ margin: 0 }}>Stake</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      Max: {fmtMoney(MAX_BET)}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
                    color: 'var(--ink)', textAlign: 'center', lineHeight: 1.1, marginBottom: 6,
                  }}>
                    {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
                  </div>
                  <input
                    type="range" className="gs-modal__slider"
                    min={100} max={sliderMax} step={50}
                    value={Math.min(amount, sliderMax)}
                    onChange={e => setAmount(Number(e.target.value))}
                  />
                  <div className="gs-modal__presets">
                    {presets.map(p => (
                      <button key={p} type="button" onClick={() => setAmount(p)} className={amount === p ? 'active' : ''}>
                        {CURRENCY_SYMBOL}{p}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: 10, borderRadius: 8,
                  background: 'var(--hot-soft)', border: '1px solid rgba(255,61,127,0.3)',
                  color: 'var(--loss)', fontSize: 12,
                }}>
                  {error}
                </div>
              )}
              <button onClick={finalOnClick} disabled={!finalOnClick && !canSubmit} className="gs-modal__submit">
                {submitLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .gs-modal .sheet {
          background: #0B0D11; color: #F2F3F5; padding-bottom: 0;
        }
        .gs-modal__body {
          flex: 1; overflow-y: auto; overflow-x: hidden; margin-top: 8px; padding-bottom: 4px; padding-right: 2px;
        }
        .gs-modal__viewswitch {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
          padding: 3px; margin-top: 8px;
          background: #14171D; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
        }
        .gs-modal__viewswitch button {
          padding: 8px 10px; border: none; border-radius: 8px;
          background: transparent; color: #8089A0; font-weight: 600; font-size: 12px; cursor: pointer;
        }
        .gs-modal__viewswitch button.active { background: rgba(0,255,133,0.14); color: #00FF85; }
        .gs-modal__footer {
          flex-shrink: 0; padding: 14px 0 max(16px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(255,255,255,0.08); background: #0B0D11; margin-top: 6px;
        }
        .gs-modal__slider {
          appearance: none; -webkit-appearance: none; width: 100%; height: 8px;
          background: #2A2F39; border-radius: 4px; outline: none; margin-bottom: 12px; display: block;
        }
        .gs-modal__slider::-webkit-slider-thumb {
          appearance: none; -webkit-appearance: none; width: 26px; height: 26px;
          background: #00FF85; border-radius: 50%; border: 3px solid #0B0D11;
          box-shadow: 0 2px 10px rgba(0,255,133,0.45); cursor: pointer;
        }
        .gs-modal__slider::-moz-range-thumb {
          width: 26px; height: 26px; background: #00FF85; border-radius: 50%;
          border: 3px solid #0B0D11; box-shadow: 0 2px 10px rgba(0,255,133,0.45); cursor: pointer;
        }
        .gs-modal__presets {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px;
        }
        .gs-modal__presets button {
          background: #1A1D24; border: 1px solid rgba(255,255,255,0.10);
          padding: 9px 0; border-radius: 10px;
          font-family: var(--font-mono); font-weight: 600; font-size: 12.5px; color: #F2F3F5; cursor: pointer;
        }
        .gs-modal__presets button.active { background: rgba(0,255,133,0.14); border-color: #00FF85; color: #00FF85; }
        .gs-modal__submit {
          width: 100%; padding: 14px 16px; border-radius: 14px;
          font-family: var(--font-display); font-weight: 700; font-size: 15px;
          border: none; cursor: pointer; background: #00FF85; color: #051912;
          transition: transform 0.08s ease;
        }
        .gs-modal__submit:active:not(:disabled) { transform: scale(0.985); }
        .gs-modal__submit:disabled { background: #1F2229; color: #5B6473; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
