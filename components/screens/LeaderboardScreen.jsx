'use client';

import { useState, useEffect } from 'react';
import { fmtMoney, fmtNet, CURRENCY_SYMBOL } from '@/lib/currency';

const TABS = [
  { id: 'total', label: 'Realised P&L' },
  { id: 'wins', label: 'Biggest Wins' },
  { id: 'losses', label: 'Biggest Losses' },
  { id: 'bettor', label: 'Biggest Bettor' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return '';
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ago`;
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  return `${m}m ago`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function SubTabs({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, margin: '12px 16px 16px', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            background: active === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: active === t.id ? 'var(--ink)' : 'var(--ink-3)',
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LeaderRow({ rank, user, entry, isMe, valueMain, valueSub, valueColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', marginBottom: 6, borderRadius: 12,
      background: isMe ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
      border: isMe ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: rank <= 3 ? 'var(--gold)' : 'var(--ink-3)', width: 18, fontWeight: rank <= 3 ? 700 : 400 }}>
        {rank <= 3 ? MEDALS[rank - 1] : rank}
      </span>
      <div className="lb-avatar" style={entry.avatar_url ? { backgroundImage: `url(${entry.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!entry.avatar_url && (entry.display_name || entry.username || '?')[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {entry.display_name || entry.username}
          {isMe && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', background: 'var(--gold)', color: '#0a0a0a', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
        </div>
        {valueSub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{valueSub}</div>}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: valueColor || 'var(--ink)' }}>
        {valueMain}
      </div>
    </div>
  );
}

function TotalWinsTab({ rankings, user }) {
  const sorted = [...rankings].sort((a, b) => (b.realisedBalance || 0) - (a.realisedBalance || 0));
  const hasAnyResolved = sorted.some(r => r.realisedBalance !== 0);

  return (
    <div style={{ margin: '0 16px' }}>
      {!hasAnyResolved && (
        <div style={{ padding: '20px 16px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No matches settled yet — everyone starts at 0</div>
        </div>
      )}
      {sorted.map((f, i) => {
        const val = f.realisedBalance || 0;
        return (
          <LeaderRow
            key={f.id}
            rank={i + 1}
            user={user}
            entry={f}
            isMe={user && f.id === user.id}
            valueMain={fmtNet(val)}
            valueSub={null}
            valueColor={val > 0 ? 'var(--win)' : val < 0 ? 'var(--loss)' : 'var(--ink-3)'}
          />
        );
      })}
    </div>
  );
}

function BiggestWinsTab({ biggestWins }) {
  return (
    <div style={{ margin: '0 16px' }}>
      {biggestWins.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>No wins yet</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Individual winning bets show up here once matches settle</div>
        </div>
      ) : (
        biggestWins.slice(0, 15).map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', marginBottom: 6, borderRadius: 12,
            background: i < 3 ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.02)',
            border: i < 3 ? '1px solid rgba(255,215,0,0.12)' : '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--gold)' : 'var(--ink-3)', width: 18, fontWeight: i < 3 ? 700 : 400 }}>
              {i < 3 ? MEDALS[i] : i + 1}
            </span>
            <div className="lb-avatar" style={w.avatarUrl ? { backgroundImage: `url(${w.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              {!w.avatarUrl && (w.displayName || '?')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{w.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                {w.matchLabel || w.matchId} · picked {w.pickLabel || w.pick}
              </div>
              {w.resolvedAt && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{fmtMoney(w.stake)} → {fmtMoney(w.payout)} · {timeAgo(w.resolvedAt)}</div>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--win)' }}>
              +{fmtMoney(w.profit)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BiggestLossesTab({ biggestLosses }) {
  return (
    <div style={{ margin: '0 16px' }}>
      {biggestLosses.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😅</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>No losses yet</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Lost bets show up here once matches settle</div>
        </div>
      ) : (
        biggestLosses.slice(0, 15).map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', marginBottom: 6, borderRadius: 12,
            background: i < 3 ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.02)',
            border: i < 3 ? '1px solid rgba(248,113,113,0.12)' : '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--loss)' : 'var(--ink-3)', width: 18, fontWeight: i < 3 ? 700 : 400 }}>
              {i < 3 ? MEDALS[i] : i + 1}
            </span>
            <div className="lb-avatar" style={w.avatarUrl ? { backgroundImage: `url(${w.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              {!w.avatarUrl && (w.displayName || '?')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{w.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                {w.matchLabel || w.matchId} · picked {w.pickLabel || w.pick}
              </div>
              {w.resolvedAt && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>staked {fmtMoney(w.amount)} · {timeAgo(w.resolvedAt)}</div>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--loss)' }}>
              -{fmtMoney(w.amount)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BiggestBettorTab({ rankings, user }) {
  const sorted = [...rankings].sort((a, b) => (b.totalStaked || 0) - (a.totalStaked || 0));
  const groupTotal = rankings.reduce((s, r) => s + (r.totalStaked || 0), 0);

  return (
    <div style={{ margin: '0 16px' }}>
      <div style={{ padding: '8px 0 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{CURRENCY_SYMBOL}{groupTotal.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>total in play across {rankings.length} players</div>
      </div>
      {sorted.map((f, i) => (
        <LeaderRow
          key={f.id}
          rank={i + 1}
          user={user}
          entry={f}
          isMe={user && f.id === user.id}
          valueMain={fmtMoney(f.totalStaked || 0)}
          valueSub={`${f.betCount || 0} bet${f.betCount !== 1 ? 's' : ''}`}
          valueColor="var(--ink)"
        />
      ))}
    </div>
  );
}

export default function LeaderboardScreen({ user }) {
  const [subTab, setSubTab] = useState('total');
  const [rankings, setRankings] = useState([]);
  const [biggestWins, setBiggestWins] = useState([]);
  const [biggestLosses, setBiggestLosses] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRankings(data);
        } else if (data?.rankings) {
          setRankings(data.rankings);
          setBiggestWins(data.biggestWins || []);
          setBiggestLosses(data.biggestLosses || []);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <SubTabs active={subTab} onChange={setSubTab} />
      {subTab === 'total' && <TotalWinsTab rankings={rankings} user={user} />}
      {subTab === 'wins' && <BiggestWinsTab biggestWins={biggestWins} />}
      {subTab === 'losses' && <BiggestLossesTab biggestLosses={biggestLosses} />}
      {subTab === 'bettor' && <BiggestBettorTab rankings={rankings} user={user} />}
    </div>
  );
}
