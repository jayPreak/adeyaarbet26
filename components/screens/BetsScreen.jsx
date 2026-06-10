'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { computeGenerated } from '@/lib/ledger';
import { BetCard } from '@/components';

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

function TopupSection({ user, onTopup }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleTopup = async () => {
    const val = parseInt(amount, 10);
    if (!val || val <= 0) { setMsg('Enter a valid amount'); return; }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`+${CURRENCY_SYMBOL}${val.toLocaleString('en-IN')} added to wallet`);
      setAmount('');
      if (onTopup) onTopup();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
          style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--font-mono)' }}
        />
        <button
          onClick={handleTopup}
          disabled={loading}
          style={{ background: 'var(--gold)', color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {loading ? '...' : 'Add Funds'}
        </button>
      </div>
      {msg && <div style={{ marginTop: 6, fontSize: 11, color: msg.startsWith('Error') ? '#f87171' : 'var(--win)' }}>{msg}</div>}
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
  // Generated (top-up) funds are excluded from settlement — shown for clarity.
  const totalGenerated = computeGenerated(bets);
  const hasDetail = resolvedBets.length > 0 || totalGenerated > 0;

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
        {hasDetail && (
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
      {totalGenerated > 0 && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          {CURRENCY_SYMBOL}{totalGenerated.toLocaleString('en-IN')} generated · excluded from settlement
        </div>
      )}

      {showBreakdown && hasDetail && (
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
          {totalGenerated > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Generated (excluded)</span>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'line-through' }}>
                +{CURRENCY_SYMBOL}{totalGenerated.toLocaleString('en-IN')}
              </span>
            </div>
          )}
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

export default function BetsScreen({ bets = [], onCancelBet, user, onProfileUpdate, onRefreshBets, wallet }) {
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

      {/* Wallet balance + topup */}
      <div style={{ padding: '0 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Wallet</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{fmtMoney(wallet)}</span>
      </div>
      <TopupSection user={user} onTopup={onRefreshBets || onProfileUpdate} />

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
