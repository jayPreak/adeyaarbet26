'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { getMatch, getTeam } from '@/lib/data';
import { BetCard } from '@/components';

function NetWorthGraph({ bets }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const { points, minY, maxY } = useMemo(() => {
    const resolved = bets
      .filter(b => b.match_id !== '_topup' && (b.status === 'won' || b.status === 'lost'))
      .sort((a, b) => new Date(a.resolved_at || a.created_at) - new Date(b.resolved_at || b.created_at));

    if (resolved.length === 0) return { points: [], minY: 0, maxY: 0 };

    let running = 0;
    const pts = [{ x: 0, y: 0, bet: null }];

    resolved.forEach((b, i) => {
      if (b.status === 'won') {
        running += (b.payout || 0) - b.amount;
      } else {
        running -= b.amount;
      }
      const roi = b.status === 'won'
        ? Math.round(((b.payout - b.amount) / b.amount) * 100)
        : -100;

      let matchLabel = b.match_id;
      if (b.match_id === 'CUP_WINNER') {
        matchLabel = 'Cup Winner';
      } else {
        const m = getMatch(b.match_id);
        if (m) matchLabel = `${getTeam(m.home).code} v ${getTeam(m.away).code}`;
      }

      pts.push({
        x: i + 1,
        y: running,
        bet: {
          matchLabel,
          amount: b.amount,
          payout: b.payout || 0,
          status: b.status,
          roi,
        },
      });
    });

    const ys = pts.map(p => p.y);
    return { points: pts, minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [bets]);

  if (points.length < 2) return null;

  const W = 320, H = 120, PX = 16, PY = 20;
  const chartW = W - PX * 2, chartH = H - PY * 2;
  const range = maxY - minY || 1;

  const toSvg = (pt) => ({
    sx: PX + (pt.x / (points.length - 1)) * chartW,
    sy: PY + (1 - (pt.y - minY) / range) * chartH,
  });

  const pathD = points.map((pt, i) => {
    const { sx, sy } = toSvg(pt);
    return `${i === 0 ? 'M' : 'L'}${sx},${sy}`;
  }).join(' ');

  const zeroY = PY + (1 - (0 - minY) / range) * chartH;

  const handleTap = useCallback((e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const scaleX = W / rect.width;
    const x = tapX * scaleX;

    let closest = null, closestDist = Infinity;
    points.forEach((pt) => {
      if (!pt.bet) return;
      const { sx } = toSvg(pt);
      const dist = Math.abs(sx - x);
      if (dist < closestDist) { closestDist = dist; closest = pt; }
    });

    if (closest && closestDist < 25) {
      setTooltip(closest);
    } else {
      setTooltip(null);
    }
  }, [points]);

  const lastPt = points[points.length - 1];
  const isUp = lastPt.y >= 0;

  return (
    <div style={{ margin: '0 16px 12px', padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
      <div style={{ padding: '0 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Worth</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: isUp ? 'var(--win)' : 'var(--loss)' }}>
          {lastPt.y >= 0 ? '+' : ''}{fmtMoney(lastPt.y)}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
        onClick={handleTap}
      >
        {/* Zero line */}
        <line x1={PX} y1={zeroY} x2={W - PX} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="3,3" />

        {/* Path */}
        <path d={pathD} fill="none" stroke={isUp ? '#4ade80' : '#f87171'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Keypoints */}
        {points.filter(pt => pt.bet).map((pt, i) => {
          const { sx, sy } = toSvg(pt);
          const isActive = tooltip === pt;
          return (
            <circle
              key={i}
              cx={sx} cy={sy} r={isActive ? 5 : 3}
              fill={pt.bet.status === 'won' ? '#4ade80' : '#f87171'}
              stroke={isActive ? '#fff' : 'none'}
              strokeWidth={isActive ? 1.5 : 0}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && tooltip.bet && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 4, padding: '8px 12px', borderRadius: 8,
          background: '#1a1d24', border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', zIndex: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
            {tooltip.bet.matchLabel}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
            {tooltip.bet.status === 'won' ? (
              <span style={{ color: 'var(--win)' }}>Won {fmtMoney(tooltip.bet.payout)} (+{tooltip.bet.roi}%)</span>
            ) : (
              <span style={{ color: 'var(--loss)' }}>Lost {fmtMoney(tooltip.bet.amount)} ({tooltip.bet.roi}%)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSection({ user, onProfileUpdate }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (onProfileUpdate) onProfileUpdate(data);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Max 2MB'); return; }

    setError(null);
    setSaving(true);
    try {
      const supabaseBrowser = (await import('@/lib/supabase-browser')).default;
      if (!supabaseBrowser) throw new Error('Not available');

      const ext = file.name.split('.').pop();
      const path = `${user.id}.${ext}`;
      const { error: upErr } = await supabaseBrowser.storage
        .from('user_pics')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabaseBrowser.storage.from('user_pics').getPublicUrl(path);
      const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, avatarUrl }),
      });
      if (!res.ok) throw new Error('Failed to save');
      if (onProfileUpdate) onProfileUpdate({ avatar_url: avatarUrl });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = user?.avatar_url;

  return (
    <div style={{ padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: avatarSrc ? `url(${avatarSrc}) center/cover` : 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer', border: '2px solid rgba(255,255,255,0.15)',
          }}
        >
          {!avatarSrc && (user?.display_name?.[0] || '?')}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display name"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: 13 }}
              />
              <input
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 10px', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
              />
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{user?.display_name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>@{user?.username}</div>
            </>
          )}
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} disabled={saving} style={{ background: '#4ade80', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '...' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setError(null); }} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
            Edit
          </button>
        )}
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>{error}</div>}
    </div>
  );
}


function SettlementCard({ user, bets = [] }) {
  const [myPosition, setMyPosition] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    fetch('/api/settlement')
      .then(r => r.json())
      .then(data => {
        if (data.positions) {
          const me = data.positions.find(p => p.id === user.id);
          if (me) setMyPosition(me.net);
        }
      })
      .catch(() => {});
  }, [user]);

  if (myPosition === null) return null;

  const resolvedBets = bets.filter(b => b.match_id !== '_topup' && (b.status === 'won' || b.status === 'lost'));
  const totalStaked = resolvedBets.reduce((s, b) => s + b.amount, 0);
  const totalWon = resolvedBets.filter(b => b.status === 'won').reduce((s, b) => s + (b.payout || 0), 0);

  const isOwing = myPosition < 0;
  const isEven = myPosition === 0;
  return (
    <div style={{
      margin: '0 16px 12px', padding: '14px 16px', borderRadius: 12,
      background: isEven ? 'rgba(255,255,255,0.04)' : isOwing ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
      border: `1px solid ${isEven ? 'rgba(255,255,255,0.08)' : isOwing ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Real money settlement
        </div>
        {resolvedBets.length > 0 && (
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showBreakdown ? 'Hide' : 'How?'}
          </button>
        )}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: isEven ? 'var(--ink-2)' : isOwing ? 'var(--loss)' : 'var(--win)' }}>
        {isEven
          ? "You're even — no payment needed"
          : isOwing
            ? `You owe ${CURRENCY_SYMBOL}${Math.abs(myPosition).toLocaleString('en-IN')}`
            : `You receive ${CURRENCY_SYMBOL}${myPosition.toLocaleString('en-IN')}`
        }
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
        Based on resolved bets only · settled at end of tournament
      </div>

      {showBreakdown && resolvedBets.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8, fontWeight: 600 }}>Breakdown</div>
          {resolvedBets.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--ink-2)' }}>
                {b.match_id} · {b.pick} · staked {CURRENCY_SYMBOL}{b.amount.toLocaleString('en-IN')}
              </span>
              <span style={{ color: b.status === 'won' ? 'var(--win)' : 'var(--loss)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {b.status === 'won' ? `+${CURRENCY_SYMBOL}${(b.payout || 0).toLocaleString('en-IN')}` : `-${CURRENCY_SYMBOL}${b.amount.toLocaleString('en-IN')}`}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Total staked</span>
            <span className="mono" style={{ fontWeight: 700 }}>-{CURRENCY_SYMBOL}{totalStaked.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Total won back</span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--win)' }}>+{CURRENCY_SYMBOL}{totalWon.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: 'var(--ink)', fontWeight: 700 }}>Net</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: isOwing ? 'var(--loss)' : 'var(--win)' }}>
              {myPosition >= 0 ? '+' : ''}{CURRENCY_SYMBOL}{myPosition.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BetsScreen({ bets = [], onCancelBet, user, onProfileUpdate, onRefreshBets }) {
  const [tab, setTab] = useState('pending');

  const realBets = useMemo(() => bets.filter(b => b.match_id !== '_topup'), [bets]);

  const filtered = useMemo(() => {
    if (tab === 'all') return realBets;
    return realBets.filter(b => b.status === tab);
  }, [realBets, tab]);

  const totalOpen = useMemo(
    () => realBets.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0),
    [realBets]
  );
  const totalWon = useMemo(
    () => realBets.filter(b => b.status === 'won').reduce((s, b) => s + ((b.payout || 0) - b.amount), 0),
    [realBets]
  );
  const settled = realBets.filter(b => b.status === 'won' || b.status === 'lost');
  const winRate = settled.length
    ? Math.round(100 * realBets.filter(b => b.status === 'won').length / settled.length)
    : 0;

  return (
    <div>
      <AccountSection user={user} onProfileUpdate={onProfileUpdate} />
      <SettlementCard user={user} bets={bets} />
      <NetWorthGraph bets={bets} />

      <div className="section-head" style={{ marginTop: 0 }}>
        <div className="section-head__title display">My Bets</div>
      </div>

      <div className="stats-strip">
        {[
          { label: 'Open stake', val: fmtMoney(totalOpen), tint: 'gold' },
          { label: 'Won',        val: '+' + fmtMoney(totalWon), tint: 'win' },
          { label: 'Win rate',   val: winRate + '%', tint: null },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{
              fontSize: 18,
              color: s.tint === 'gold' ? 'var(--gold)' : s.tint === 'win' ? 'var(--win)' : 'var(--ink)',
            }}>{s.val}</div>
          </div>
        ))}
      </div>


      <div className="chip-row" style={{ marginBottom: 12 }}>
        {[
          { id: 'pending', label: `Open · ${realBets.filter(b => b.status === 'pending').length}` },
          { id: 'won',  label: 'Won' },
          { id: 'lost', label: 'Lost' },
          { id: 'all',  label: 'All' },
        ].map(t => (
          <button
            key={t.id}
            className={'chip ' + (tab === t.id ? 'active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>
            {realBets.length === 0 ? 'Place your first bet!' : `No ${tab} bets yet`}
          </div>
        )}
        {filtered.map(b => <BetCard key={b.id} bet={b} onCancelBet={onCancelBet} />)}
      </div>
    </div>
  );
}
