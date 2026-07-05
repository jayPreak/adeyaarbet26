'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { getTeam, getMatchKickoffTs, isMatchBettingOpen, fmtKickoffIST, fmtKnockoutStage } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';

const PRESETS = [100, 250, 500, 1000];

function matchLabel(matches, matchId) {
  const m = matches.find(x => x.id === matchId);
  if (!m || !m.home || !m.away) return fmtKnockoutStage(matchId) || matchId;
  const h = getTeam(m.home), a = getTeam(m.away);
  return `${h.code} vs ${a.code}`;
}

function pickTeamName(matches, matchId, pick) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return pick;
  const code = pick === 'home' ? m.home : m.away;
  return getTeam(code)?.name || pick;
}

function pickTeamCode(matches, matchId, pick) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return '?';
  const code = pick === 'home' ? m.home : m.away;
  return getTeam(code)?.code || '?';
}

function pickTeamFlag(matches, matchId, pick) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return '🏳️';
  const code = pick === 'home' ? m.home : m.away;
  return getTeam(code)?.flag || '🏳️';
}

function timeUntil(isoTs) {
  if (!isoTs) return '';
  const diff = new Date(isoTs).getTime() - Date.now();
  if (diff <= 0) return 'LIVE';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getOpponentRecord(allDuels, userId, opponentId) {
  const head2head = allDuels.filter(d =>
    d.status === 'settled' &&
    ((d.challenger_id === userId && d.opponent_id === opponentId) ||
     (d.challenger_id === opponentId && d.opponent_id === userId))
  );
  const wins = head2head.filter(d => d.winner_id === userId).length;
  const losses = head2head.length - wins;
  return { wins, losses, total: head2head.length };
}

// ─── Incoming Challenge — Fight Night Card ──────────────────────────────────
function IncomingCard({ duel, matches, user, allDuels, onAction, busy }) {
  const challengerName = (duel.challenger?.display_name || '?').split(' ')[0];
  const challengerFlag = pickTeamFlag(matches, duel.match_id, duel.challenger_pick);
  const challengerCode = pickTeamCode(matches, duel.match_id, duel.challenger_pick);
  const yourPick = duel.challenger_pick === 'home' ? 'away' : 'home';
  const yourFlag = pickTeamFlag(matches, duel.match_id, yourPick);
  const yourCode = pickTeamCode(matches, duel.match_id, yourPick);
  const m = matches.find(x => x.id === duel.match_id);
  const kickoff = timeUntil(m?.kickoffTs);
  const record = getOpponentRecord(allDuels, user?.id, duel.challenger_id);

  return (
    <div className="duel-incoming">
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: 'rgba(255,215,0,0.06)',
        borderBottom: '1px solid rgba(255,215,0,0.12)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.03em' }}>
          {challengerName.toUpperCase()} CALLED YOU OUT
        </span>
        {kickoff && (
          <span style={{ fontSize: 10, fontWeight: 700, color: kickoff === 'LIVE' ? 'var(--loss)' : 'var(--ink-3)' }}>
            {kickoff === 'LIVE' ? '🔴 LIVE' : `⏱ ${kickoff}`}
          </span>
        )}
      </div>

      {/* Fight card body */}
      <div style={{ padding: '18px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Challenger */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>{challengerFlag}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>{challengerName}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>{challengerCode}</div>
          </div>

          {/* VS + Pot */}
          <div style={{ textAlign: 'center', padding: '0 4px' }}>
            <div style={{
              fontSize: 11, fontWeight: 900, color: 'var(--gold)', letterSpacing: '0.15em',
              textShadow: '0 0 12px rgba(255,215,0,0.4)',
              marginBottom: 6,
            }}>VS</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: 'var(--gold)',
              textShadow: '0 0 20px rgba(255,215,0,0.25)',
            }}>
              {fmtMoney(duel.amount)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>EACH</div>
          </div>

          {/* You */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>{yourFlag}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>You</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>{yourCode}</div>
          </div>
        </div>

        {/* H2H record */}
        {record.total > 0 && (
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'var(--ink-3)' }}>
            You're <span style={{ color: record.wins > record.losses ? 'var(--win)' : record.wins < record.losses ? 'var(--loss)' : 'var(--ink-2)', fontWeight: 700 }}>
              {record.wins}-{record.losses}
            </span> vs {challengerName}
          </div>
        )}

        {/* Pot callout */}
        <div style={{
          textAlign: 'center', marginTop: 10, padding: '6px 0',
          fontSize: 11, color: 'var(--ink-2)', fontWeight: 600,
        }}>
          Winner takes <strong style={{ color: 'var(--gold)' }}>{fmtMoney(duel.amount * 2)}</strong>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            disabled={busy}
            onClick={() => onAction(duel.id, 'accept')}
            className="duel-accept-btn"
          >
            Accept ⚔️
          </button>
          <button
            disabled={busy}
            onClick={() => onAction(duel.id, 'decline')}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
              background: 'none', border: '1px solid rgba(248,113,113,0.25)',
              color: 'var(--loss)', fontWeight: 700, fontSize: 12,
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Active Duel Card (my locked-in fights) ──────────────────────────────────
function ActiveDuelCard({ duel, matches, user, allDuels }) {
  const isChallenger = duel.challenger_id === user?.id;
  const myPick = isChallenger ? duel.challenger_pick : (duel.challenger_pick === 'home' ? 'away' : 'home');
  const theirPick = isChallenger ? (duel.challenger_pick === 'home' ? 'away' : 'home') : duel.challenger_pick;
  const opponent = isChallenger ? duel.opponent : duel.challenger;
  const opponentName = (opponent?.display_name || '?').split(' ')[0];
  const opponentId = isChallenger ? duel.opponent_id : duel.challenger_id;
  const myFlag = pickTeamFlag(matches, duel.match_id, myPick);
  const myCode = pickTeamCode(matches, duel.match_id, myPick);
  const theirFlag = pickTeamFlag(matches, duel.match_id, theirPick);
  const theirCode = pickTeamCode(matches, duel.match_id, theirPick);
  const m = matches.find(x => x.id === duel.match_id);
  const isLive = m?.status === 'live';
  const kickoff = timeUntil(m?.kickoffTs);
  const record = getOpponentRecord(allDuels, user?.id, opponentId);

  return (
    <div style={{
      padding: '14px 14px', borderRadius: 12, marginBottom: 8,
      background: isLive ? 'rgba(255,59,48,0.03)' : 'linear-gradient(135deg, rgba(255,59,48,0.02), rgba(77,168,255,0.02))',
      border: `1px solid ${isLive ? 'rgba(255,59,48,0.2)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      {/* Match context row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>
          {matchLabel(matches, duel.match_id)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isLive ? 'var(--loss)' : 'var(--ink-3)' }}>
          {isLive ? '🔴 LIVE' : kickoff ? `⏱ ${kickoff}` : ''}
        </span>
      </div>

      {/* Fight row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* You */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{myFlag}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)' }}>You</div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{myCode}</div>
          </div>
        </div>

        {/* Pot */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--gold)',
          }}>
            {fmtMoney(duel.amount * 2)}
          </div>
          <div style={{ fontSize: 8, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>POT</div>
        </div>

        {/* Opponent */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{opponentName}</div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{theirCode}</div>
          </div>
          <span style={{ fontSize: 22 }}>{theirFlag}</span>
        </div>
      </div>

      {/* H2H record */}
      {record.total > 0 && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 9, color: 'var(--ink-3)' }}>
          <span style={{ color: record.wins >= record.losses ? 'var(--win)' : 'var(--loss)', fontWeight: 700 }}>
            {record.wins}-{record.losses}
          </span> vs {opponentName}
        </div>
      )}
    </div>
  );
}

// ─── Waiting Card (you sent, awaiting response) ──────────────────────────────
function WaitingCard({ duel, matches, user, onAction, busy }) {
  const opponentName = (duel.opponent?.display_name || '?').split(' ')[0];
  const myFlag = pickTeamFlag(matches, duel.match_id, duel.challenger_pick);
  const myCode = pickTeamCode(matches, duel.match_id, duel.challenger_pick);
  const m = matches.find(x => x.id === duel.match_id);
  const kickoff = timeUntil(m?.kickoffTs);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
      background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,215,0,0.15)',
      borderRadius: 10, marginBottom: 8,
    }}>
      <span style={{ fontSize: 18 }}>{myFlag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
          → <strong style={{ color: 'var(--ink)' }}>{opponentName}</strong>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          {fmtMoney(duel.amount)} on {myCode} · {matchLabel(matches, duel.match_id)}
          {kickoff && ` · ${kickoff}`}
        </div>
      </div>
      <button
        disabled={busy}
        onClick={() => onAction(duel.id, 'cancel')}
        style={{
          padding: '5px 9px', borderRadius: 6, cursor: 'pointer',
          background: 'none', border: '1px solid rgba(248,113,113,0.25)',
          color: 'var(--loss)', fontSize: 9, fontWeight: 700,
        }}
      >
        Withdraw
      </button>
    </div>
  );
}

// ─── Friends' Duel (compact, secondary) ──────────────────────────────────────
function FriendsDuelRow({ duel, matches }) {
  const chName = (duel.challenger?.display_name || '?').split(' ')[0];
  const opName = (duel.opponent?.display_name || '?').split(' ')[0];
  const chFlag = pickTeamFlag(matches, duel.match_id, duel.challenger_pick);
  const opFlag = pickTeamFlag(matches, duel.match_id, duel.challenger_pick === 'home' ? 'away' : 'home');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 13 }}>{chFlag}</span>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{chName}</span>
      <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>vs</span>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{opName}</span>
      <span style={{ fontSize: 13 }}>{opFlag}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
        {fmtMoney(duel.amount * 2)}
      </span>
    </div>
  );
}

// ─── History Row — minimal ───────────────────────────────────────────────────
function HistoryRow({ duel, matches, user }) {
  const isChallenger = duel.challenger_id === user?.id;
  const isOpponent = duel.opponent_id === user?.id;
  const involved = isChallenger || isOpponent;
  const opponent = isChallenger ? duel.opponent : duel.challenger;
  const opponentName = (opponent?.display_name || '?').split(' ')[0];
  const iWon = duel.status === 'settled' && duel.winner_id === user?.id;
  const iLost = duel.status === 'settled' && involved && duel.winner_id && duel.winner_id !== user?.id;

  let result, color;
  if (iWon) { result = `+${fmtMoney(duel.amount)}`; color = 'var(--win)'; }
  else if (iLost) { result = `-${fmtMoney(duel.amount)}`; color = 'var(--loss)'; }
  else if (duel.status === 'void') { result = 'Draw'; color = 'var(--ink-3)'; }
  else if (duel.status === 'expired') { result = 'Expired'; color = 'var(--ink-3)'; }
  else if (duel.status === 'declined') { result = 'Declined'; color = 'var(--ink-3)'; }
  else if (duel.status === 'cancelled') { result = 'Cancelled'; color = 'var(--ink-3)'; }
  else { result = duel.status; color = 'var(--ink-3)'; }

  if (!involved) {
    const ch = (duel.challenger?.display_name || '?').split(' ')[0];
    const op = (duel.opponent?.display_name || '?').split(' ')[0];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', flex: 1 }}>{ch} vs {op}</span>
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{matchLabel(matches, duel.match_id)}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', flex: 1 }}>vs {opponentName}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{matchLabel(matches, duel.match_id)}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 55, textAlign: 'right' }}>{result}</span>
    </div>
  );
}

// ─── Create Duel Modal ───────────────────────────────────────────────────────
function CreateDuelModal({ open, onClose, matches, allUsers, user, onCreated, setToast }) {
  const [opponentId, setOpponentId] = useState(null);
  const [matchId, setMatchId] = useState('');
  const [side, setSide] = useState('home');
  const [amount, setAmount] = useState(250);
  const [busy, setBusy] = useState(false);

  const bettableMatches = useMemo(() =>
    matches
      .filter(m => m.home && m.away && m.status !== 'finished' && m.status !== 'live' && isMatchBettingOpen(m))
      .sort((a, b) => (getMatchKickoffTs(a) || 0) - (getMatchKickoffTs(b) || 0)),
    [matches]
  );

  const selectedMatch = bettableMatches.find(m => m.id === matchId) || null;
  const friends = allUsers.filter(u => u.id !== user?.id);
  const selectedFriend = friends.find(f => f.id === opponentId);

  function reset() {
    setOpponentId(null); setMatchId(''); setSide('home'); setAmount(250);
  }

  async function submit() {
    if (!user || !opponentId || !matchId || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, opponentId, matchId, pick: side, amount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setToast(`Challenge sent to ${selectedFriend?.display_name?.split(' ')[0]} · ${fmtMoney(amount)}`);
      reset();
      onClose();
      onCreated();
    } catch (e) {
      setToast(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const chip = (active) => ({
    padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: active ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
    border: `1.5px solid ${active ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}`,
    color: active ? 'var(--gold)' : 'var(--ink-2)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
        border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 18px' }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 16 }}>
          New duel
        </div>

        {/* Step 1: Pick opponent */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Who?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {friends.map(f => (
              <button key={f.id} onClick={() => setOpponentId(f.id)} style={chip(opponentId === f.id)}>
                {(f.display_name || f.username || '?').split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Match */}
        {opponentId && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Which match?
            </div>
            <select
              value={matchId}
              onChange={e => { setMatchId(e.target.value); setSide('home'); }}
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                color: 'var(--ink)', fontSize: 13,
              }}
            >
              <option value="">Pick a match…</option>
              {bettableMatches.map(m => (
                <option key={m.id} value={m.id}>
                  {getTeam(m.home).name} vs {getTeam(m.away).name} · {fmtKickoffIST(m.kickoffTs)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Step 3: Side */}
        {selectedMatch && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Your side
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['home', 'away'].map(s => {
                  const t = getTeam(s === 'home' ? selectedMatch.home : selectedMatch.away);
                  return (
                    <button key={s} onClick={() => setSide(s)} style={{ ...chip(side === s), padding: '14px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: 18, display: 'block', marginBottom: 4 }}>{t.flag}</span>
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', marginTop: 6 }}>
                {selectedFriend?.display_name?.split(' ')[0]} gets {getTeam(side === 'home' ? selectedMatch.away : selectedMatch.home).name}
              </div>
            </div>

            {/* Step 4: Amount */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stake (each)
              </div>
              <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--gold)', marginBottom: 8 }}>
                {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
              </div>
              <input
                type="range" className="slider"
                min={50} max={MAX_BET} step={50}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                style={{ marginBottom: 8 }}
              />
              <div className="amount-presets">
                {PRESETS.map(p => (
                  <button key={p} className={amount === p ? 'active' : ''} onClick={() => setAmount(p)}>
                    {CURRENCY_SYMBOL}{p}
                  </button>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
                Winner takes <strong style={{ color: 'var(--gold)' }}>{fmtMoney(amount * 2)}</strong>
              </div>
            </div>
          </>
        )}

        <button
          className="btn primary block lg"
          disabled={busy || !opponentId || !matchId}
          onClick={submit}
          style={{ marginTop: 8 }}
        >
          {busy ? 'Sending…'
            : !opponentId ? 'Pick a friend'
            : !matchId ? 'Pick a match'
            : `Send challenge · ${fmtMoney(amount)}`}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DuelsPage() {
  const { user, matches, allUsers, setToast, refreshData } = useBetting();
  const [duels, setDuels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(() => {
    fetch('/api/challenge')
      .then(r => r.json())
      .then(d => setDuels(d.challenges || []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function actOnDuel(challengeId, action) {
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/challenge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, challengeId, action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');
      setToast(action === 'accept' ? '⚔️ Duel accepted — winner takes all!'
        : action === 'decline' ? 'Declined'
        : 'Withdrawn · stake refunded');
      load();
      refreshData();
    } catch (e) {
      setToast(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Sections — MY duels only in active sections
  const incoming = duels.filter(d => d.status === 'open' && d.opponent_id === user?.id);
  const myLockedIn = duels.filter(d => d.status === 'accepted' && (d.challenger_id === user?.id || d.opponent_id === user?.id));
  const waiting = duels.filter(d => d.status === 'open' && d.challenger_id === user?.id);
  const othersLockedIn = duels.filter(d => d.status === 'accepted' && d.challenger_id !== user?.id && d.opponent_id !== user?.id);
  const history = duels.filter(d => !['open', 'accepted'].includes(d.status));

  // My W-L record
  const mySettled = duels.filter(d => d.status === 'settled' && (d.challenger_id === user?.id || d.opponent_id === user?.id));
  const wins = mySettled.filter(d => d.winner_id === user?.id).length;
  const losses = mySettled.filter(d => d.winner_id && d.winner_id !== user?.id).length;

  const totalAtStake = myLockedIn.reduce((s, d) => s + d.amount, 0) + waiting.reduce((s, d) => s + d.amount, 0);
  const hasActivity = incoming.length > 0 || myLockedIn.length > 0 || waiting.length > 0;

  return (
    <div style={{ padding: '0 16px', paddingBottom: 40 }}>
      {/* ─── HEADER: Fight Card style ─── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              DUELS
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {hasActivity
                ? <>{myLockedIn.length} active · {waiting.length} pending · {incoming.length > 0 && <span style={{ color: 'var(--gold)' }}>{incoming.length} incoming</span>}</>
                : 'No active duels'
              }
            </div>
          </div>

          {/* W-L record */}
          {mySettled.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900 }}>
                <span style={{ color: 'var(--win)' }}>{wins}</span>
                <span style={{ color: 'var(--ink-3)', margin: '0 2px', fontSize: 13 }}>—</span>
                <span style={{ color: 'var(--loss)' }}>{losses}</span>
              </div>
              <div style={{ fontSize: 8, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.1em' }}>YOUR RECORD</div>
            </div>
          )}
        </div>

        {/* Total at stake */}
        {totalAtStake > 0 && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,215,0,0.03)', border: '1px solid rgba(255,215,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>Your money in duels</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
              {fmtMoney(totalAtStake)}
            </span>
          </div>
        )}
      </div>

      {/* ─── CTA ─── */}
      <button
        onClick={() => setCreateOpen(true)}
        className="duel-cta-btn"
      >
        <span style={{ fontSize: 15 }}>⚔️</span>
        <span>Challenge someone</span>
      </button>

      {/* ─── INCOMING ─── */}
      {incoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {incoming.map(d => (
            <IncomingCard key={d.id} duel={d} matches={matches} user={user} allDuels={duels} onAction={actOnDuel} busy={busy} />
          ))}
        </div>
      )}

      {/* ─── MY ACTIVE DUELS ─── */}
      {myLockedIn.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Your duels ({myLockedIn.length})
          </div>
          {myLockedIn.map(d => <ActiveDuelCard key={d.id} duel={d} matches={matches} user={user} allDuels={duels} />)}
        </div>
      )}

      {/* ─── WAITING (sent out) ─── */}
      {waiting.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Sent — waiting ({waiting.length})
          </div>
          {waiting.map(d => <WaitingCard key={d.id} duel={d} matches={matches} user={user} onAction={actOnDuel} busy={busy} />)}
        </div>
      )}

      {/* ─── FRIENDS' DUELS ─── */}
      {othersLockedIn.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Friends' duels ({othersLockedIn.length})
          </div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            {othersLockedIn.map(d => <FriendsDuelRow key={d.id} duel={d} matches={matches} />)}
          </div>
        </div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {!hasActivity && history.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-3)', fontSize: 13 }}>
          No duels yet.
        </div>
      )}

      {/* ─── HISTORY (collapsed) ─── */}
      {history.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--ink-3)', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            Past duels ({history.length}) <span style={{ fontSize: 8 }}>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div style={{ marginTop: 6, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              {history.map(d => <HistoryRow key={d.id} duel={d} matches={matches} user={user} />)}
            </div>
          )}
        </div>
      )}

      <CreateDuelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        matches={matches}
        allUsers={allUsers}
        user={user}
        onCreated={() => { load(); refreshData(); }}
        setToast={setToast}
      />
    </div>
  );
}
