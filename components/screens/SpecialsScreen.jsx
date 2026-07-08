'use client';

import { useState, useEffect, useMemo } from 'react';
import { SPECIALS, getSpecial } from '@/lib/specials';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { getTeam } from '@/lib/data';
import { Flag } from '@/components';
import { useBetting } from '@/lib/BettingContext';
import FinalFourBetModal, { qfDeadlineTs } from '@/components/FinalFourBetModal';
import TotalGoalsBetModal from '@/components/TotalGoalsBetModal';
import { TOTAL_GOALS_LINE } from '@/lib/props';

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
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function SpecialCard({ special, poolData, onOpen, deadlineTs, myBet, resolvesTs, highlight, bettorCount, totalFriends }) {
  const total = poolData?.total || 0;
  const countdown = useDeadlineCountdown(deadlineTs);
  const resolvesIn = useDeadlineCountdown(resolvesTs);

  const canComputeWin = myBet?.pick && total > 0 && poolData?.byTeam?.[myBet.pick];
  const myPool = canComputeWin ? poolData.byTeam[myBet.pick] : 0;
  const potentialWin = canComputeWin ? Math.floor((myBet.amount / myPool) * total) : 0;
  const roi = canComputeWin && myBet.amount > 0 ? Math.round(((potentialWin - myBet.amount) / myBet.amount) * 100) : 0;

  const headerGradient = special.id === 'cup_winner' ? 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,215,0,0.03) 100%)'
    : special.id === 'continent' ? 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(74,222,128,0.03) 100%)'
    : special.id === 'h2h' ? 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(147,51,234,0.08) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)';

  return (
    <div
      onClick={onOpen}
      style={{
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 160,
        overflow: 'hidden',
      }}
    >
      {/* Header strip */}
      <div style={{
        padding: '12px 14px 10px',
        background: headerGradient,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
            <span style={{ fontSize: 18, marginRight: 4 }}>{special.emoji}</span>
            {special.title}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '3px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
            background: special.multiPick ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.06)',
            color: special.multiPick ? 'var(--gold)' : 'var(--ink-3)',
            border: special.multiPick ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.1)',
          }}>
            {special.multiPick ? 'Multi' : 'Single'}
          </span>
        </div>
        {highlight && (
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>
            {highlight}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: 6 }}>
        {/* Stats rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>Pool</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>Bettors</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{bettorCount || 0}{totalFriends ? `/${totalFriends}` : ''}</span>
          </div>
          {myBet && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>Your Stake</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{fmtMoney(myBet.amount)}</span>
            </div>
          )}
          {!myBet && countdown !== 'closed' && (
            <div style={{ marginTop: 2, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,180,50,0.08)', border: '1px dashed rgba(255,180,50,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffb432', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ffb432' }}>You're not in yet!</span>
            </div>
          )}
          {canComputeWin && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>Potential Win</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>{fmtMoney(potentialWin)} <span style={{ fontSize: 11, opacity: 0.8 }}>+{roi}%</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Footer strip — mirrors header */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: countdown && countdown !== 'closed'
          ? 'rgba(74,222,128,0.04)'
          : countdown === 'closed' && resolvesIn && resolvesIn !== 'closed'
            ? 'rgba(255,215,0,0.04)'
            : 'rgba(248,113,113,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {countdown && countdown !== 'closed' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--win)' }}>
            Closes {countdown}
          </span>
        )}
        {countdown === 'closed' && resolvesIn && resolvesIn !== 'closed' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)' }}>
            Settles {resolvesIn}
          </span>
        )}
        {countdown === 'closed' && (!resolvesIn || resolvesIn === 'closed') && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--loss)' }}>
            Betting closed
          </span>
        )}
        {!countdown && resolvesIn && resolvesIn !== 'closed' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)' }}>
            Settles {resolvesIn}
          </span>
        )}
        {!countdown && (!resolvesIn || resolvesIn === 'closed') && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' }}>
            Open
          </span>
        )}
      </div>
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
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}
        >
          ← Back
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

// Continent expanded view
function ContinentDetail({ special, poolData, picks, myBet, user, allUsers, onBack, onPlace }) {
  const total = poolData?.total || 0;
  const byTeam = poolData?.byTeam || {};

  const sorted = Object.entries(byTeam)
    .map(([pick, amount]) => ({ pick, amount }))
    .sort((a, b) => b.amount - a.amount);

  const myPayout = myBet && byTeam[myBet.pick]
    ? Math.floor((myBet.amount / byTeam[myBet.pick]) * total)
    : 0;

  return (
    <div>
      <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>🌍 Winning Continent</span>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
          Which confederation will the World Cup winner belong to?
        </div>

        {myBet && (
          <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>YOUR BET</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{special.formatPick(myBet.pick)}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', marginLeft: 8 }}>{fmtMoney(myBet.amount)} staked</span>
              </div>
            </div>
            {myPayout > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>If {special.formatPick(myBet.pick)} wins</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--win)', fontFamily: 'var(--font-mono)' }}>
                  {fmtMoney(myPayout)} <span style={{ fontSize: 13, opacity: 0.8 }}>(+{Math.round(((myPayout - myBet.amount) / myBet.amount) * 100)}%)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {(() => {
          const deadlinePassed = special.deadlineTs && Date.now() >= new Date(special.deadlineTs).getTime();
          if (deadlinePassed) {
            return (
              <div style={{ width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
                Betting closed
              </div>
            );
          }
          return (
            <button
              onClick={onPlace}
              style={{ width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12, background: 'var(--gold)', color: '#0a0a0a', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              {myBet ? 'Change pick' : 'Place bet'}
            </button>
          );
        })()}

        {sorted.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>POOL BY CONFEDERATION</div>
            {sorted.map(({ pick, amount }) => {
              const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
              const isMyPick = myBet?.pick === pick;
              return (
                <div key={pick} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', marginBottom: 6, borderRadius: 10,
                  background: isMyPick ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
                  border: isMyPick ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{special.formatPick(pick)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)' }}>{fmtMoney(amount)}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        {picks.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>EVERYONE'S PICKS</div>
            {picks.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-3)' }}>
                  {!p.avatarUrl && (p.displayName?.[0] || '?')}
                </div>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)' }}>{p.displayName}</span>
                <span style={{ fontSize: 12, color: 'var(--ink)' }}>{special.formatPick(p.pick)}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{fmtMoney(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// H2H expanded view
function H2HDetail({ special, poolData, picks, myBet, user, allUsers, onBack, onPlace, onCancel }) {
  const countdown = useDeadlineCountdown(new Date(special.deadlineTs).getTime());
  const total = poolData?.total || 0;
  const byTeam = poolData?.byTeam || {};

  const myPayout = myBet && byTeam[myBet.pick]
    ? Math.floor((myBet.amount / byTeam[myBet.pick]) * total)
    : 0;
  const closed = countdown === 'closed';

  return (
    <div>
      <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>⚔️ {special.title}</span>
        {countdown && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: closed ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.1)', color: closed ? 'var(--loss)' : 'var(--win)' }}>
            {closed ? 'Closed' : `⏱ ${countdown}`}
          </span>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>{special.description}</div>

        {/* Resolution rules */}
        {special.resolutionRules && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>RESOLUTION RULES</div>
            {special.resolutionRules.map((rule, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 3 }}>• {rule}</div>
            ))}
          </div>
        )}

        {myBet && (
          <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>YOUR BET</div>
              {!closed && (
                <button onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '4px 10px', color: 'var(--loss)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{special.formatPick(myBet.pick)}</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{fmtMoney(myBet.amount)} staked</span>
            </div>
            {myPayout > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>If {special.formatPick(myBet.pick)} wins</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--win)', fontFamily: 'var(--font-mono)' }}>
                  {fmtMoney(myPayout)} <span style={{ fontSize: 13, opacity: 0.8 }}>(+{Math.round(((myPayout - myBet.amount) / myBet.amount) * 100)}%)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!closed && (
          <button onClick={onPlace} style={{ width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12, background: 'var(--gold)', color: '#0a0a0a', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {myBet ? 'Change pick' : 'Place bet'}
          </button>
        )}

        {/* Pool visualization - two cards */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {special.options.map(opt => {
            const amt = byTeam[opt.value] || 0;
            const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
            const isMyPick = myBet?.pick === opt.value;
            return (
              <div key={opt.value} style={{
                flex: 1, padding: '14px', borderRadius: 12, textAlign: 'center',
                background: isMyPick ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
                border: isMyPick ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.country === 'ARG' ? '🇦🇷' : '🇵🇹'}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{opt.label.split(' ')[1]}</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(amt)}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pct}% of pool</div>
              </div>
            );
          })}
        </div>

        {/* Everyone's picks */}
        {picks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>EVERYONE'S PICKS</div>
            {picks.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-3)' }}>
                  {!p.avatarUrl && (p.displayName?.[0] || '?')}
                </div>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)' }}>{p.displayName}</span>
                <span style={{ fontSize: 12, color: 'var(--ink)' }}>{special.formatPick(p.pick)}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{fmtMoney(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Haven't bet yet */}
        {allUsers.length > 0 && (() => {
          const bettorIds = new Set(picks.map(p => p.userId || p.user_id));
          const notBet = allUsers.filter(u => !bettorIds.has(u.id));
          if (notBet.length === 0) return null;
          return (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>HAVEN'T BET YET ({notBet.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {notBet.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--ink-3)' }}>
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
    </div>
  );
}



function ThirdPlaceDetail({ pool, picks, myBet, user, allUsers, onBack, onPlace }) {
  const total = pool?.total || 0;
  const bettorCount = pool?.bettorCount || 0;
  const closed = Date.now() >= new Date('2026-06-26T18:59:00Z').getTime();
  const allRefunded = closed && picks.length > 0 && picks.every(p => p.status === 'cancelled');

  const myPotentialWin = myBet && total > 0 && !allRefunded ? total : 0;

  const bettorIds = new Set(picks.map(p => p.userId));
  const notBet = allUsers.filter(u => !bettorIds.has(u.id));

  return (
    <div>
      <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>🥉 3rd Place Race — Pick 8</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: 'rgba(248,113,113,0.12)', color: 'var(--loss)' }}>
          Closed
        </span>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Refund banner */}
        {allRefunded && (
          <div style={{
            marginBottom: 14, padding: '12px 14px', borderRadius: 10,
            background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--win)', fontWeight: 700, marginBottom: 2 }}>
              Refunded — nobody got all 8 correct
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              All stakes have been returned. No one won or lost money on this bet.
            </div>
          </div>
        )}

        {/* Rules banner */}
        {!allRefunded && (
        <div style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.18)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--gold)' }}>All-or-nothing:</strong> All 8 picks must be correct to win.
            If you get any wrong, your stake is refunded (no loss). Winners split the entire pool.
          </div>
        </div>
        )}

        {/* Pool summary */}
        <div style={{
          display: 'flex', gap: 16, marginBottom: 16, padding: '14px 16px',
          borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: allRefunded ? 'var(--ink-3)' : 'var(--gold)' }}>
              {fmtMoney(total)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>
              {allRefunded ? 'Refunded' : 'Total Pool'}
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{bettorCount}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>Players</div>
          </div>
          {myBet && !allRefunded && (
            <>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>
                  {fmtMoney(myPotentialWin)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Win if correct
                </div>
              </div>
            </>
          )}
        </div>

        {/* My bet */}
        {myBet && (
          <div style={{
            marginBottom: 16, padding: '14px 16px', borderRadius: 12,
            background: allRefunded ? 'rgba(255,255,255,0.04)' : 'rgba(74,222,128,0.08)',
            border: `1px solid ${allRefunded ? 'rgba(255,255,255,0.08)' : 'rgba(74,222,128,0.15)'}`,
          }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>
              YOUR PICKS · {fmtMoney(myBet.amount)} {allRefunded ? 'refunded' : 'staked'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {myBet.pick.split(',').map(code => {
                const team = getTeam(code);
                return (
                  <span key={code} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 6,
                    background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                    fontSize: 12, color: 'var(--win)', fontWeight: 600,
                  }}>
                    {team.flag} {team.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Place/change bet */}
        {!closed && (
          <button
            onClick={onPlace}
            style={{ width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12, background: 'var(--gold)', color: '#0a0a0a', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {myBet ? 'Change picks' : 'Place bet'}
          </button>
        )}

        {/* Everyone's picks */}
        {picks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 10 }}>
              EVERYONE'S PICKS ({picks.length})
            </div>
            {picks.map((p, i) => {
              const isMe = p.userId === user?.id;
              const teams = p.pick ? p.pick.split(',').map(c => getTeam(c)) : [];
              return (
                <div key={i} style={{
                  padding: '12px', marginBottom: 8, borderRadius: 12,
                  background: isMe ? 'rgba(54,211,153,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isMe ? 'rgba(54,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'rgba(255,255,255,0.1)',
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'var(--ink)',
                    }}>
                      {!p.avatarUrl && (p.displayName?.[0] || '?')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: isMe ? 'var(--win)' : 'var(--ink)' }}>
                        {p.displayName}{isMe && ' (you)'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                        {fmtMoney(p.amount)}
                      </span>
                    </div>
                    {allRefunded ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                        refunded
                      </span>
                    ) : total > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--win)', fontFamily: 'var(--font-mono)' }}>
                        wins {fmtMoney(total)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {teams.map(t => (
                      <span key={t.code} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '2px 6px', borderRadius: 5,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                        fontSize: 10, color: 'var(--ink-2)',
                      }}>
                        {t.flag} {t.code}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Haven't bet */}
        {notBet.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>
              HAVEN'T BET ({notBet.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {notBet.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : 'rgba(255,255,255,0.1)',
                    backgroundSize: 'cover', backgroundPosition: 'center',
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
        )}
      </div>
    </div>
  );
}

function SettledSpecials({ specials, myBetsData, poolsData }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: '0 16px', marginTop: 20 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--ink-2)', fontSize: 13, fontWeight: 600,
        }}
      >
        <span>Settled Specials ({specials.length})</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {specials.map(s => {
            const myBet = myBetsData[s.id];
            const isRefunded = myBet?.status === 'cancelled';
            return (
              <div key={s.id} style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{s.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{s.title}</span>
                  {myBet && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: myBet.status === 'won' ? 'rgba(74,222,128,0.12)' : myBet.status === 'lost' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)',
                      color: myBet.status === 'won' ? 'var(--win)' : myBet.status === 'lost' ? 'var(--loss)' : 'var(--ink-3)',
                    }}>
                      {myBet.status === 'won' ? `Won ${fmtMoney(myBet.payout || 0)}` : myBet.status === 'lost' ? `Lost ${fmtMoney(myBet.amount)}` : myBet.status === 'cancelled' ? `Refunded ${fmtMoney(myBet.amount)}` : myBet.status}
                    </span>
                  )}
                  {!myBet && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>No bet</span>}
                </div>
                {myBet && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-3)', paddingLeft: 24 }}>
                    Picked: {s.formatPick(myBet.pick)} · {fmtMoney(myBet.amount)}
                  </div>
                )}
                {isRefunded && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-3)', paddingLeft: 24, fontStyle: 'italic' }}>
                    No winner — all bets refunded
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SpecialsScreen({ user, onOpenSpecialBet, bets = [], allUsers = [], matches = [], onToast }) {
  const { refreshData, specialPools: initSpecialPools } = useBetting();
  const [poolsData, setPoolsData] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [picksData, setPicksData] = useState({});
  const [deadlines, setDeadlines] = useState({});
  const [myBetsData, setMyBetsData] = useState({});
  const [settledIds, setSettledIds] = useState(new Set());
  const [finalFourOpen, setFinalFourOpen] = useState(false);
  const [totalGoalsOpen, setTotalGoalsOpen] = useState(false);

  // Use data from init route if available (zero extra API calls)
  useEffect(() => {
    if (!initSpecialPools) return;
    const newPools = {};
    const newPicks = {};
    const newMyBets = {};
    const newSettled = [];
    for (const [k, v] of Object.entries(initSpecialPools)) {
      newPools[k] = { total: v.pool?.total || 0, bettorCount: v.pool?.bettorCount || 0, byTeam: v.pool?.byOption || {} };
      newPicks[k] = v.picks || [];
      newMyBets[k] = v.myBets?.[0] || null;
      if (v.pool?.settled) newSettled.push(k);
    }
    setPoolsData(prev => ({ ...prev, ...newPools }));
    setPicksData(prev => ({ ...prev, ...newPicks }));
    setMyBetsData(prev => ({ ...prev, ...newMyBets }));
    if (newSettled.length) setSettledIds(new Set(newSettled));
  }, [initSpecialPools]);

  // Fallback: fetch cup-winner deadline + third-place-qualifiers (not in init batch)
  useEffect(() => {
    fetch(`/api/cup-winner-bet?user_id=${user?.id || ''}`)
      .then(r => r.json())
      .then(data => {
        if (!initSpecialPools) {
          setPoolsData(prev => ({ ...prev, cup_winner: data.pool }));
          setPicksData(prev => ({ ...prev, cup_winner: data.picks || [] }));
          setMyBetsData(prev => ({ ...prev, cup_winner: data.myBet || null }));
        }
        if (data.deadlineTs) setDeadlines(prev => ({ ...prev, cup_winner: data.deadlineTs }));
      })
      .catch(() => {});

    fetch(`/api/third-place-qualifier-bet${user?.id ? `?user_id=${user.id}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setPoolsData(prev => ({ ...prev, third_place_qualifiers: data.pool || { total: 0, bettorCount: 0 } }));
        setPicksData(prev => ({ ...prev, third_place_qualifiers: data.picks || [] }));
        setMyBetsData(prev => ({ ...prev, third_place_qualifiers: data.myBet || null }));
      })
      .catch(() => {});
  }, [user, bets]);

  const expandedSpecial = expanded ? SPECIALS.find(s => s.id === expanded) : null;

  // If something is expanded, render only that detail view
  if (expandedSpecial) {
    if (expandedSpecial.id === 'continent') {
      return (
        <div>
          <ContinentDetail
            special={expandedSpecial}
            poolData={poolsData.continent}
            picks={picksData.continent || []}
            myBet={myBetsData.continent || null}
            user={user}
            allUsers={allUsers}
            onBack={() => setExpanded(null)}
            onPlace={() => onOpenSpecialBet('continent')}
          />
        </div>
      );
    }
    if (expandedSpecial.id === 'h2h') {
      return (
        <div>
          <H2HDetail
            special={expandedSpecial}
            poolData={poolsData.h2h}
            picks={picksData.h2h || []}
            myBet={myBetsData.h2h || null}
            user={user}
            allUsers={allUsers}
            onBack={() => setExpanded(null)}
            onPlace={() => onOpenSpecialBet('h2h')}
            onCancel={() => onOpenSpecialBet('h2h')}
          />
        </div>
      );
    }
    if (expandedSpecial.id === 'third_place_qualifiers') {
      return (
        <div>
          <ThirdPlaceDetail
            pool={poolsData.third_place_qualifiers}
            picks={picksData.third_place_qualifiers || []}
            myBet={myBetsData.third_place_qualifiers || null}
            user={user}
            allUsers={allUsers}
            onBack={() => setExpanded(null)}
            onPlace={() => onOpenSpecialBet('third_place_qualifiers')}
          />
        </div>
      );
    }
    // Cup winner (default)
    const pool = poolsData[expandedSpecial.id];
    const picks = picksData[expandedSpecial.id] || [];
    const myBet = myBetsData[expandedSpecial.id] || null;
    return (
      <div>
        <ExpandedSpecial
          special={expandedSpecial}
          pool={pool}
          picks={picks}
          myBet={myBet}
          user={user}
          allUsers={allUsers}
          deadlineTs={deadlines[expandedSpecial.id]}
          onBack={() => setExpanded(null)}
          onPlace={() => onOpenSpecialBet(expandedSpecial.id)}
          onCancel={() => onOpenSpecialBet(expandedSpecial.id)}
        />
      </div>
    );
  }

  const penaltyBets = useMemo(() => {
    const now = Date.now();
    return SPECIALS.filter(s => {
      if (!s.penalty || s.hidden || settledIds.has(s.id)) return false;
      const dl = s.deadlineTs ? new Date(s.deadlineTs).getTime() : (deadlines[s.id] ? new Date(deadlines[s.id]).getTime() : null);
      if (dl && dl < now) return false;
      return !myBetsData[s.id];
    });
  }, [myBetsData, settledIds, deadlines]);

  return (
    <div>
      {penaltyBets.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.25)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--loss)', marginBottom: 8 }}>
              ⚠️ COMPULSORY — penalty if not placed
            </div>
            {penaltyBets.map(s => {
              const deadline = s.deadlineTs ? new Date(s.deadlineTs).getTime() : (deadlines[s.id] ? new Date(deadlines[s.id]).getTime() : null);
              const diff = deadline ? deadline - Date.now() : null;
              const timeLeft = diff ? (diff > 86400000 ? `${Math.floor(diff / 86400000)}d ${Math.floor((diff % 86400000) / 3600000)}h` : `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`) : null;
              return (
                <div key={s.id} onClick={() => {
                  if (s.id === 'final_four') window.location.href = '/specials/final-four';
                  else if (s.id === 'ko_cup_winner') window.location.href = '/specials/ko-cup-winner';
                  else if (s.id === 'cup_winner') setExpanded('cup_winner');
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                  borderTop: '1px solid rgba(248,113,113,0.1)', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 16 }}>{s.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</span>
                  {timeLeft && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--loss)', whiteSpace: 'nowrap' }}>Closes {timeLeft}</span>}
                  <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section-head">
        <div className="section-head__title display">Special Bets</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 16px' }}>
      {SPECIALS.filter(s => !s.hidden && !settledIds.has(s.id) && !(s.resolvesTs && new Date(s.resolvesTs).getTime() < Date.now())).sort((a, b) => {
        const aBet = myBetsData[a.id] ? 1 : 0;
        const bBet = myBetsData[b.id] ? 1 : 0;
        return aBet - bBet;
      }).map(special => {
        // Final Four — opens its own modal
        if (special.id === 'final_four') {
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: poolsData.final_four?.total || 0, byTeam: {} }}
              onOpen={() => { window.location.href = '/specials/final-four'; }}
              deadlineTs={qfDeadlineTs(matches)}
              myBet={myBetsData.final_four || null}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight="Most correct semifinalists wins"
              bettorCount={poolsData.final_four?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }

        // Total Goals — opens its own modal
        if (special.id === 'total_goals') {
          const tg = poolsData.total_goals;
          const overAmt = tg?.byTeam?.over || 0;
          const underAmt = tg?.byTeam?.under || 0;
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: tg?.total || 0, byTeam: tg?.byTeam || {} }}
              onOpen={() => { window.location.href = '/specials/total-goals'; }}
              deadlineTs={qfDeadlineTs(matches)}
              myBet={myBetsData.total_goals || null}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight={tg?.total > 0 ? `Over ${fmtMoney(overAmt)} · Under ${fmtMoney(underAmt)}` : `Over/under ${TOTAL_GOALS_LINE} goals`}
              bettorCount={tg?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }

        // Continent card
        if (special.id === 'continent') {
          const contPool = poolsData.continent;
          const contMyBet = myBetsData.continent || null;
          const topCont = contPool?.byTeam ? Object.entries(contPool.byTeam).sort((a, b) => b[1] - a[1])[0] : null;
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: contPool?.total || 0, byTeam: contPool?.byTeam || {} }}
              onOpen={() => setExpanded(special.id)}
              deadlineTs={special.deadlineTs ? new Date(special.deadlineTs).getTime() : deadlines[special.id]}
              myBet={contMyBet}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight={topCont ? `Leading: ${special.formatPick(topCont[0])}` : null}
              bettorCount={contPool?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }

        // H2H card
        if (special.id === 'h2h') {
          const h2hPool = poolsData.h2h;
          const h2hMyBet = myBetsData.h2h || null;
          const messiAmt = h2hPool?.byTeam?.messi || 0;
          const ronaldoAmt = h2hPool?.byTeam?.ronaldo || 0;
          const h2hTotal = h2hPool?.total || 0;
          const highlight = h2hTotal > 0
            ? `Messi ${Math.round((messiAmt / h2hTotal) * 100)}% · Ronaldo ${Math.round((ronaldoAmt / h2hTotal) * 100)}%`
            : 'Messi vs Ronaldo goals';
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: h2hTotal, byTeam: h2hPool?.byTeam || {} }}
              onOpen={() => window.location.href = '/specials/h2h'}
              deadlineTs={new Date(special.deadlineTs).getTime()}
              myBet={h2hMyBet}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight={highlight}
              bettorCount={h2hPool?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }


        // 3rd place qualifiers — expand inline
        if (special.id === 'third_place_qualifiers') {
          const tpqPool = poolsData.third_place_qualifiers;
          const tpqMyBet = myBetsData.third_place_qualifiers || null;
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: tpqPool?.total || 0, byTeam: {} }}
              onOpen={() => setExpanded(special.id)}
              deadlineTs={new Date(special.deadlineTs).getTime()}
              myBet={tpqMyBet}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight="All 8 must be correct"
              bettorCount={tpqPool?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }

        // R32 Flop / Bagholder — navigate to dedicated page
        if (special.id === 'r32_loser' || special.id === 'r32_winner') {
          const r32Pool = poolsData[special.id];
          const r32MyBet = myBetsData[special.id] || null;
          const href = special.id === 'r32_loser' ? '/specials/r32-flop' : '/specials/r32-bagholder';
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: r32Pool?.total || 0, byTeam: {} }}
              onOpen={() => window.location.href = href}
              deadlineTs={new Date(special.deadlineTs).getTime()}
              myBet={r32MyBet}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight={special.id === 'r32_loser' ? 'R32 + R16 biggest loser' : 'R32 + R16 biggest winner'}
              bettorCount={r32Pool?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }

        // KO Cup Winner — navigates to dedicated page
        if (special.id === 'ko_cup_winner') {
          const koPool = poolsData.ko_cup_winner;
          const koMyBet = myBetsData.ko_cup_winner || null;
          const topKoTeam = koPool?.byTeam ? Object.entries(koPool.byTeam).sort((a, b) => b[1] - a[1])[0] : null;
          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: koPool?.total || 0, byTeam: koPool?.byTeam || {} }}
              onOpen={() => { window.location.href = '/specials/ko-cup-winner'; }}
              deadlineTs={new Date(special.deadlineTs).getTime()}
              myBet={koMyBet}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
              highlight={topKoTeam ? `Favourite: ${special.formatPick(topKoTeam[0])}` : 'Teams still alive only'}
              bettorCount={koPool?.bettorCount || 0}
              totalFriends={allUsers.length}
            />
          );
        }

        // Cup winner card (default)
        const pool = poolsData[special.id];
        const myBet = myBetsData[special.id] || null;
        const topTeam = pool?.byTeam ? Object.entries(pool.byTeam).sort((a, b) => b[1] - a[1])[0] : null;

        return (
          <SpecialCard
            key={special.id}
            special={special}
            poolData={{ total: pool?.total || 0, byTeam: pool?.byTeam || {} }}
            onOpen={() => setExpanded(special.id)}
            deadlineTs={deadlines[special.id]}
            myBet={myBet}
            resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
            highlight={topTeam ? `Favourite: ${special.formatPick(topTeam[0])}` : null}
            bettorCount={pool?.bettorCount || 0}
            totalFriends={allUsers.length}
          />
        );
      })}
      </div>

      {/* Settled specials — collapsed section */}
      {(() => {
        const now = Date.now();
        const settled = SPECIALS.filter(s => !s.hidden && (settledIds.has(s.id) || (s.resolvesTs && new Date(s.resolvesTs).getTime() < now)));
        if (settled.length === 0) return null;
        return <SettledSpecials specials={settled} myBetsData={myBetsData} poolsData={poolsData} />;
      })()}

      <FinalFourBetModal
        open={finalFourOpen}
        onClose={() => setFinalFourOpen(false)}
        user={user}
        matches={matches}
        onPlaced={() => refreshData()}
      />
      <TotalGoalsBetModal
        open={totalGoalsOpen}
        onClose={() => setTotalGoalsOpen(false)}
        user={user}
        matches={matches}
        onPlaced={() => refreshData()}
      />
    </div>
  );
}
