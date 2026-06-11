'use client';

import { useState, useEffect, useMemo } from 'react';
import { SPECIALS, getSpecial } from '@/lib/specials';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { Flag } from '@/components';

function useDeadlineCountdown(deadlineTs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadlineTs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineTs]);
  if (!deadlineTs) return null;
  const diff = deadlineTs - now;
  if (diff <= 0) return 'closed';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function SpecialCard({ special, poolData, onOpen, deadlineTs }) {
  const total = poolData?.total || 0;
  const bettorCount = poolData?.bettorCount || 0;
  const topPicks = poolData?.topPicks || [];
  const countdown = useDeadlineCountdown(deadlineTs);

  return (
    <div
      onClick={onOpen}
      style={{
        margin: '0 16px 20px',
        padding: '18px 20px 24px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
            {special.emoji} {special.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            {special.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>POOL</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
            {fmtMoney(total)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>BETTORS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            {bettorCount}
          </div>
        </div>
      </div>

      {topPicks.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {topPicks.slice(0, 5).map(p => (
            <div key={p.pick} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 11, color: 'var(--ink-2)',
            }}>
              {special.optionType === 'team' && <Flag code={p.pick} size="xs" />}
              <span>{special.formatPick(p.pick)}</span>
              <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{fmtMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer badge — sits on bottom border */}
      {countdown && (
        <div style={{
          position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 12px', borderRadius: 10,
          background: countdown === 'closed' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.12)',
          border: countdown === 'closed' ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(74,222,128,0.25)',
          color: countdown === 'closed' ? 'var(--loss)' : 'var(--win)',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {countdown === 'closed' ? 'Betting closed' : `⏱ Closes in ${countdown}`}
        </div>
      )}
    </div>
  );
}

function TeamAccordion({ special, sorted, total, picks, myPick }) {
  const [openTeam, setOpenTeam] = useState(null);

  const picksByTeam = useMemo(() => {
    const map = {};
    for (const p of picks) {
      (map[p.pick] = map[p.pick] || []).push(p);
    }
    return map;
  }, [picks]);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>
        POOL BY TEAM
      </div>
      {sorted.map(({ pick, amount }) => {
        const isOpen = openTeam === pick;
        const teamPicks = picksByTeam[pick] || [];
        const isMyPick = myPick === pick;

        return (
          <div key={pick} style={{ marginBottom: 6 }}>
            <button
              onClick={() => setOpenTeam(isOpen ? null : pick)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: isOpen ? '10px 10px 0 0' : 10,
                background: isMyPick ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
                border: isMyPick ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {special.optionType === 'team' && <Flag code={pick} size="sm" />}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                {special.formatPick(pick)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)' }}>
                {fmtMoney(amount)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 32, textAlign: 'right' }}>
                {total > 0 ? Math.round((amount / total) * 100) : 0}%
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {isOpen && teamPicks.length > 0 && (
              <div style={{
                padding: '8px 12px', borderRadius: '0 0 10px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none',
              }}>
                <div style={{ display: 'flex', padding: '4px 0', marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>USER</span>
                  <span style={{ width: 70, fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, textAlign: 'right' }}>STAKE</span>
                  <span style={{ width: 100, fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, textAlign: 'right' }}>WINS IF</span>
                </div>
                {teamPicks.map((p, i) => {
                  const possibleWin = amount > 0 ? Math.floor((p.amount / amount) * total) : 0;
                  const roi = p.amount > 0 ? Math.round(((possibleWin - p.amount) / p.amount) * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : 'rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: 'var(--ink-3)',
                        }}>
                          {!p.avatar_url && (p.display_name?.[0] || '?')}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{p.display_name}</span>
                      </div>
                      <span style={{ width: 70, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', textAlign: 'right' }}>
                        {fmtMoney(p.amount)}
                      </span>
                      <span style={{ width: 100, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--win)', textAlign: 'right' }}>
                        {fmtMoney(possibleWin)} <span style={{ fontSize: 10, opacity: 0.7 }}>(+{roi}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PoolDetail({ special, poolData, picks, myBet, user, allUsers, onPlace, onCancel, deadlineTs }) {
  const closed = deadlineTs && Date.now() >= deadlineTs;
  const byTeam = poolData?.byTeam || {};
  const total = poolData?.total || 0;

  const sorted = Object.entries(byTeam)
    .map(([pick, amount]) => ({ pick, amount }))
    .sort((a, b) => b.amount - a.amount);

  const myPayout = myBet && byTeam[myBet.pick]
    ? Math.floor((myBet.amount / byTeam[myBet.pick]) * total)
    : 0;

  return (
    <div style={{ padding: '0 16px' }}>
      {myBet && (
        <div style={{
          marginBottom: 12, padding: '14px 16px', borderRadius: 12,
          background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>YOUR BET</div>
            {!closed && (
              <button
                onClick={onCancel}
                style={{
                  background: 'none', border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 8, padding: '4px 10px',
                  color: 'var(--loss)', fontSize: 11, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {special.optionType === 'team' && <Flag code={myBet.pick} size="sm" />}
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
              {special.formatPick(myBet.pick)}
            </span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
              {fmtMoney(myBet.amount)} staked
            </span>
          </div>
          {myPayout > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>If {special.formatPick(myBet.pick)} wins</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--win)', fontFamily: 'var(--font-mono)' }}>
                {fmtMoney(myPayout)} <span style={{ fontSize: 13, opacity: 0.8 }}>(+{Math.round(((myPayout - myBet.amount) / myBet.amount) * 100)}%)</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--win)', opacity: 0.8 }}>
                +{fmtMoney(myPayout - myBet.amount)} profit
              </div>
            </div>
          )}
        </div>
      )}

      {!closed && (
        <button
          onClick={onPlace}
          style={{
            width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12,
            background: 'var(--gold)', color: '#0a0a0a',
            border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {myBet ? 'Change pick' : 'Place bet'}
        </button>
      )}

      <TeamAccordion special={special} sorted={sorted} total={total} picks={picks} myPick={myBet?.pick} />

      {/* Haven't bet yet */}
      {allUsers.length > 0 && (() => {
        const bettorIds = new Set(picks.map(p => p.user_id));
        const notBet = allUsers.filter(u => !bettorIds.has(u.id));
        if (notBet.length === 0) return null;
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>
              HAVEN'T BET YET ({notBet.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {notBet.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: 'var(--ink-3)',
                  }}>
                    {!u.avatar_url && (u.display_name?.[0] || '?')}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ExpandedSpecial({ special, pool, picks, myBet, user, allUsers, deadlineTs, onBack, onPlace, onCancel }) {
  const countdown = useDeadlineCountdown(deadlineTs);
  return (
    <div>
      <div style={{ margin: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 18, cursor: 'pointer', padding: 0 }}
        >
          ←
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
          {special.emoji} {special.title}
        </span>
        {countdown && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
            background: countdown === 'closed' ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.1)',
            color: countdown === 'closed' ? 'var(--loss)' : 'var(--win)',
          }}>
            {countdown === 'closed' ? 'Closed' : `⏱ ${countdown}`}
          </span>
        )}
      </div>
      <PoolDetail
        special={special}
        poolData={pool}
        picks={picks}
        myBet={myBet}
        user={user}
        allUsers={allUsers}
        onPlace={onPlace}
        onCancel={onCancel}
        deadlineTs={deadlineTs}
      />
    </div>
  );
}

export default function SpecialsScreen({ user, onOpenSpecialBet, bets = [], allUsers = [] }) {
  const [poolsData, setPoolsData] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [picksData, setPicksData] = useState({});
  const [deadlines, setDeadlines] = useState({});
  const [myBetsData, setMyBetsData] = useState({});

  useEffect(() => {
    for (const s of SPECIALS) {
      fetch(`/api/cup-winner-bet?user_id=${user?.id || ''}`)
        .then(r => r.json())
        .then(data => {
          setPoolsData(prev => ({ ...prev, [s.id]: data.pool }));
          setPicksData(prev => ({ ...prev, [s.id]: data.picks || [] }));
          setMyBetsData(prev => ({ ...prev, [s.id]: data.myBet || null }));
          if (data.deadlineTs) setDeadlines(prev => ({ ...prev, [s.id]: data.deadlineTs }));
        })
        .catch(() => {});
    }
  }, [user, bets]);

  return (
    <div>
      <div className="section-head">
        <div className="section-head__title display">Special Bets</div>
      </div>

      {SPECIALS.map(special => {
        const pool = poolsData[special.id];
        const picks = picksData[special.id] || [];
        const myBet = myBetsData[special.id] || null;
        const isExpanded = expanded === special.id;

        const topPicks = pool?.byTeam
          ? Object.entries(pool.byTeam)
              .map(([pick, amount]) => ({ pick, amount }))
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 5)
          : [];

        const cardPool = {
          total: pool?.total || 0,
          bettorCount: pool?.bettorCount || 0,
          topPicks,
        };

        if (isExpanded) {
          return (
            <ExpandedSpecial
              key={special.id}
              special={special}
              pool={pool}
              picks={picks}
              myBet={myBet}
              user={user}
              allUsers={allUsers}
              deadlineTs={deadlines[special.id]}
              onBack={() => setExpanded(null)}
              onPlace={() => onOpenSpecialBet(special.id)}
              onCancel={() => onOpenSpecialBet(special.id)}
            />
          );
        }

        return (
          <SpecialCard
            key={special.id}
            special={special}
            poolData={cardPool}
            onOpen={() => setExpanded(special.id)}
            deadlineTs={deadlines[special.id]}
          />
        );
      })}
    </div>
  );
}
