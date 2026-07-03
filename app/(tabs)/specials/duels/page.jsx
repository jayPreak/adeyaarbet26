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
  return `${h.flag} ${h.code} vs ${a.code} ${a.flag}`;
}

function pickTeamName(matches, matchId, pick) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return pick;
  const code = pick === 'home' ? m.home : m.away;
  return getTeam(code)?.name || pick;
}

const STATUS_META = {
  open:      { label: 'Waiting',  color: 'var(--gold)' },
  accepted:  { label: 'Locked in', color: '#4da8ff' },
  settled:   { label: 'Settled',  color: 'var(--win)' },
  declined:  { label: 'Declined', color: 'var(--ink-3)' },
  cancelled: { label: 'Cancelled', color: 'var(--ink-3)' },
  expired:   { label: 'Expired',  color: 'var(--ink-3)' },
  void:      { label: 'Void — draw', color: 'var(--ink-3)' },
};

function DuelCard({ duel, matches, user, onAction, busy }) {
  const isChallenger = duel.challenger_id === user?.id;
  const isOpponent = duel.opponent_id === user?.id;
  const meta = STATUS_META[duel.status] || { label: duel.status, color: 'var(--ink-3)' };
  const challengerName = duel.challenger?.display_name || '?';
  const opponentName = duel.opponent?.display_name || '?';
  const challengerTeam = pickTeamName(matches, duel.match_id, duel.challenger_pick);
  const opponentTeam = pickTeamName(matches, duel.match_id, duel.challenger_pick === 'home' ? 'away' : 'home');
  const iWon = duel.status === 'settled' && duel.winner_id === user?.id;
  const iLost = duel.status === 'settled' && (isChallenger || isOpponent) && duel.winner_id !== user?.id;

  return (
    <div className="card" style={{
      marginBottom: 10,
      ...(iWon ? { borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' } :
          iLost ? { borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)' } : {}),
    }}>
      <div className="row between" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
        <span>{matchLabel(matches, duel.match_id)}</span>
        <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: duel.winner_id === duel.challenger_id ? 'var(--win)' : 'var(--ink)' }}>
            {challengerName}{isChallenger ? ' (you)' : ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{challengerTeam}</div>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
          color: 'var(--gold)', padding: '4px 10px', borderRadius: 8,
          background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)',
        }}>
          {fmtMoney(duel.amount)}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: duel.winner_id === duel.opponent_id ? 'var(--win)' : 'var(--ink)' }}>
            {opponentName}{isOpponent ? ' (you)' : ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{opponentTeam}</div>
        </div>
      </div>

      {duel.status === 'settled' && (
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: iWon ? 'var(--win)' : iLost ? 'var(--loss)' : 'var(--ink-2)', marginBottom: 4 }}>
          {iWon ? `You won ${fmtMoney(duel.amount * 2)} (+${fmtMoney(duel.amount)})` :
           iLost ? `You lost ${fmtMoney(duel.amount)}` :
           `${duel.winner_id === duel.challenger_id ? challengerName : opponentName} took the pot`}
        </div>
      )}

      {duel.status === 'open' && isOpponent && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            disabled={busy}
            onClick={() => onAction(duel.id, 'accept')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--win)', color: '#04170c', fontWeight: 800, fontSize: 13 }}
          >
            Accept · take {opponentTeam}
          </button>
          <button
            disabled={busy}
            onClick={() => onAction(duel.id, 'decline')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--loss)', fontWeight: 700, fontSize: 13 }}
          >
            Decline
          </button>
        </div>
      )}
      {duel.status === 'open' && isChallenger && (
        <button
          disabled={busy}
          onClick={() => onAction(duel.id, 'cancel')}
          style={{ width: '100%', marginTop: 4, padding: '9px 0', borderRadius: 10, cursor: 'pointer', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--loss)', fontWeight: 600, fontSize: 12 }}
        >
          Withdraw duel · refund {fmtMoney(duel.amount)}
        </button>
      )}
      {duel.status === 'open' && !isChallenger && !isOpponent && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
          Waiting for {opponentName} to accept
        </div>
      )}
    </div>
  );
}

export default function DuelsPage() {
  const { user, matches, allUsers, setToast, refreshData } = useBetting();
  const [duels, setDuels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Create form state
  const [opponentId, setOpponentId] = useState(null);
  const [matchId, setMatchId] = useState('');
  const [side, setSide] = useState('home');
  const [amount, setAmount] = useState(250);

  const load = useCallback(() => {
    fetch('/api/challenge')
      .then(r => r.json())
      .then(d => setDuels(d.challenges || []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const bettableMatches = useMemo(() =>
    matches
      .filter(m => m.home && m.away && m.status !== 'finished' && m.status !== 'live' && isMatchBettingOpen(m))
      .sort((a, b) => (getMatchKickoffTs(a) || 0) - (getMatchKickoffTs(b) || 0)),
    [matches]
  );

  const selectedMatch = bettableMatches.find(m => m.id === matchId) || null;
  const friends = allUsers.filter(u => u.id !== user?.id);

  async function createDuel() {
    if (!user || !opponentId || !matchId || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, opponentId, matchId, pick: side, amount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create duel');
      setToast(`Duel sent · ${fmtMoney(amount)} on ${pickTeamName(matches, matchId, side)}`);
      setShowForm(false);
      setOpponentId(null); setMatchId(''); setSide('home'); setAmount(250);
      load();
      refreshData();
    } catch (e) {
      setToast(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function actOnDuel(challengeId, action) {
    if (!user || busy) return;
    if (action === 'decline' && !confirm('Decline this duel?')) return;
    if (action === 'cancel' && !confirm('Withdraw this duel? Your stake will be refunded.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/challenge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, challengeId, action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');
      setToast(action === 'accept' ? 'Duel accepted — winner takes all! ⚔️'
        : action === 'decline' ? 'Duel declined'
        : 'Duel withdrawn · stake refunded');
      load();
      refreshData();
    } catch (e) {
      setToast(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const incoming = duels.filter(d => d.status === 'open' && d.opponent_id === user?.id);
  const openOthers = duels.filter(d => d.status === 'open' && d.opponent_id !== user?.id);
  const active = duels.filter(d => d.status === 'accepted');
  const history = duels.filter(d => !['open', 'accepted'].includes(d.status));

  const selBtn = (active) => ({
    padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: active ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
    color: active ? 'var(--gold)' : 'var(--ink)',
  });

  return (
    <div>
      <div className="section-head">
        <div className="section-head__title display">⚔️ Duels</div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>
          Challenge a friend 1v1 on any match. They take the other side, same stake —
          winner takes the whole pot. Draw? Both refunded.
        </div>

        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            width: '100%', padding: '13px', marginBottom: 14, borderRadius: 12,
            background: showForm ? 'rgba(255,255,255,0.06)' : 'var(--gold)',
            color: showForm ? 'var(--ink-2)' : '#0a0a0a',
            border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}
        >
          {showForm ? 'Close' : '⚔️ Challenge a friend'}
        </button>

        {showForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Who are you calling out?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {friends.map(f => (
                <button key={f.id} onClick={() => setOpponentId(f.id)} style={selBtn(opponentId === f.id)}>
                  {(f.display_name || f.username || '?').split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="eyebrow" style={{ marginBottom: 8 }}>Match</div>
            <select
              value={matchId}
              onChange={e => { setMatchId(e.target.value); setSide('home'); }}
              style={{
                width: '100%', padding: '11px 12px', marginBottom: 14, borderRadius: 10,
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

            {selectedMatch && (
              <>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Your side (they get the other)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {['home', 'away'].map(s => {
                    const t = getTeam(s === 'home' ? selectedMatch.home : selectedMatch.away);
                    return (
                      <button key={s} onClick={() => setSide(s)} style={{ ...selBtn(side === s), padding: '12px 8px' }}>
                        {t.flag} {t.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="eyebrow" style={{ marginBottom: 6 }}>Stake (each)</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, marginBottom: 6 }}>
              {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
            </div>
            <input
              type="range" className="slider"
              min={50} max={MAX_BET} step={50}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              style={{ marginBottom: 10 }}
            />
            <div className="amount-presets" style={{ marginBottom: 12 }}>
              {PRESETS.map(p => (
                <button key={p} className={amount === p ? 'active' : ''} onClick={() => setAmount(p)}>
                  {CURRENCY_SYMBOL}{p}
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
              Winner takes {fmtMoney(amount * 2)} · your stake is held until they respond
            </div>

            <button
              className="btn primary block lg"
              disabled={busy || !opponentId || !matchId}
              onClick={createDuel}
            >
              {busy ? 'Sending…'
                : !opponentId ? 'Pick a friend'
                : !matchId ? 'Pick a match'
                : `Send duel · ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`}
            </button>
          </div>
        )}

        {incoming.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '4px 0 8px' }}>
              🔥 You&apos;ve been challenged ({incoming.length})
            </div>
            {incoming.map(d => <DuelCard key={d.id} duel={d} matches={matches} user={user} onAction={actOnDuel} busy={busy} />)}
          </>
        )}

        {openOthers.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 0 8px' }}>
              Open duels
            </div>
            {openOthers.map(d => <DuelCard key={d.id} duel={d} matches={matches} user={user} onAction={actOnDuel} busy={busy} />)}
          </>
        )}

        {active.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4da8ff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 0 8px' }}>
              Locked in
            </div>
            {active.map(d => <DuelCard key={d.id} duel={d} matches={matches} user={user} onAction={actOnDuel} busy={busy} />)}
          </>
        )}

        {history.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 0 8px' }}>
              History
            </div>
            {history.map(d => <DuelCard key={d.id} duel={d} matches={matches} user={user} onAction={actOnDuel} busy={busy} />)}
          </>
        )}

        {duels.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--ink-3)' }}>
            No duels yet — call someone out. 😤
          </div>
        )}
      </div>
    </div>
  );
}
