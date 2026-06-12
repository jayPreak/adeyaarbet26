'use client';

import { useState, useEffect, useMemo } from 'react';
import { SPECIALS, getSpecial } from '@/lib/specials';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { Flag } from '@/components';
import { isMatchBettingOpen } from '@/lib/data';

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

function SpecialCard({ special, poolData, onOpen, deadlineTs, myBet, resolvesTs }) {
  const total = poolData?.total || 0;
  const bettorCount = poolData?.bettorCount || 0;
  const topPicks = poolData?.topPicks || [];
  const countdown = useDeadlineCountdown(deadlineTs);
  const resolvesIn = useDeadlineCountdown(resolvesTs);

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
        {special.multiPick ? (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: 'rgba(0,255,133,0.08)', color: 'var(--gold)', border: '1px solid rgba(0,255,133,0.15)' }}>Multi-bet</span>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>Single pick</span>
        )}
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

      {/* Your stake / potential win */}
      {myBet && (() => {
        const canComputeWin = myBet.pick && total > 0 && poolData?.byTeam?.[myBet.pick];
        const myPool = canComputeWin ? poolData.byTeam[myBet.pick] : 0;
        const potentialWin = canComputeWin ? Math.floor((myBet.amount / myPool) * total) : 0;
        const roi = canComputeWin && myBet.amount > 0 ? Math.round(((potentialWin - myBet.amount) / myBet.amount) * 100) : 0;
        return (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>YOUR STAKE</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                {fmtMoney(myBet.amount)}
              </div>
            </div>
            {canComputeWin && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>POTENTIAL WIN</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>
                  {fmtMoney(potentialWin)} <span style={{ fontSize: 11, opacity: 0.8 }}>(+{roi}%)</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Footer badges */}
      <div style={{
        position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, whiteSpace: 'nowrap',
      }}>
        {countdown && (
          <div style={{
            padding: '4px 12px', borderRadius: 10,
            background: countdown === 'closed' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.12)',
            border: countdown === 'closed' ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(74,222,128,0.25)',
            color: countdown === 'closed' ? 'var(--loss)' : 'var(--win)',
            fontSize: 11, fontWeight: 700,
          }}>
            {countdown === 'closed' ? 'Betting closed' : `⏱ Closes in ${countdown}`}
          </div>
        )}
        {resolvesIn && resolvesIn !== 'closed' && (
          <div style={{
            padding: '4px 12px', borderRadius: 10,
            background: 'rgba(255,215,0,0.1)',
            border: '1px solid rgba(255,215,0,0.2)',
            color: 'var(--gold)',
            fontSize: 11, fontWeight: 700,
          }}>
            🏁 Resolves in {resolvesIn}
          </div>
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

        <button
          onClick={onPlace}
          style={{ width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12, background: 'var(--gold)', color: '#0a0a0a', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          {myBet ? 'Change pick' : 'Place bet'}
        </button>

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
          const bettorIds = new Set(picks.map(p => p.user_id));
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

// Golden Boot expanded view
function GoldenBootDetail({ special, poolData, picks, myBets, user, allUsers, onBack, onPlace, onCancel }) {
  const countdown = useDeadlineCountdown(new Date(special.deadlineTs).getTime());
  const total = poolData?.total || 0;
  const byTeam = poolData?.byTeam || {};
  const closed = countdown === 'closed';

  const sorted = Object.entries(byTeam)
    .map(([pick, amount]) => ({ pick, amount }))
    .sort((a, b) => b.amount - a.amount);

  const myTotalStake = (myBets || []).reduce((s, b) => s + b.amount, 0);

  return (
    <div>
      <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>👟 {special.title}</span>
        {countdown && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: closed ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.1)', color: closed ? 'var(--loss)' : 'var(--win)' }}>
            {closed ? 'Closed' : `⏱ ${countdown}`}
          </span>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{special.description}</div>
        <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 16 }}>Multi-pick allowed — bet on multiple players</div>

        {/* Pool stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>POOL</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>YOUR STAKES</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{myBets?.length || 0} picks · {fmtMoney(myTotalStake)}</div>
          </div>
        </div>

        {/* My bets */}
        {myBets && myBets.length > 0 && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>YOUR PICKS</div>
            {myBets.map((b, i) => {
              const playerPool = byTeam[b.pick] || 0;
              const potentialWin = playerPool > 0 ? Math.floor((b.amount / playerPool) * total) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < myBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{special.formatPick(b.pick)}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{fmtMoney(b.amount)}</span>
                  {potentialWin > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>→ {fmtMoney(potentialWin)}</span>}
                </div>
              );
            })}
          </div>
        )}

        {!closed && (
          <button onClick={onPlace} style={{ width: '100%', padding: '14px', marginBottom: 16, borderRadius: 12, background: 'var(--gold)', color: '#0a0a0a', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {myBets?.length > 0 ? 'Add another pick' : 'Place bet'}
          </button>
        )}

        {/* Pool by player */}
        {sorted.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>POOL BY PLAYER</div>
            {sorted.map(({ pick, amount }) => {
              const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
              const isMyPick = myBets?.some(b => b.pick === pick);
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

        {/* Everyone's picks */}
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

        {/* Haven't bet yet */}
        {allUsers.length > 0 && (() => {
          const bettorIds = new Set(picks.map(p => p.user_id));
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

// Goalscorer expanded view: list of upcoming group-stage matches
function GoalScorerMatchList({ matches, bets, onBet, onBack, gsSummary }) {
  const myGsBets = useMemo(() => {
    const map = {};
    for (const b of bets) {
      if (b.kind === 'goalscorer' && b.status === 'pending') map[b.match_id] = b;
    }
    return map;
  }, [bets]);

  // Only show matches where betting is still open or has a pending bet
  const upcoming = useMemo(() =>
    (matches || []).filter(m => isMatchBettingOpen(m) || myGsBets[m.id]),
    [matches, myGsBets]
  );

  const total      = gsSummary?.total      || 0;
  const bettorCount = gsSummary?.bettorCount || 0;

  return (
    <div>
      <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 18, cursor: 'pointer', padding: 0 }}>←</button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>⚽ Anytime Goalscorer</span>
      </div>

      {total > 0 && (
        <div style={{ margin: '0 16px 12px', display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>TOTAL POOL</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>BETTORS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{bettorCount}</div>
          </div>
        </div>
      )}

      {upcoming.length === 0 ? (
        <div style={{ margin: '0 16px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
          No upcoming matches open for goalscorer bets
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.map(m => {
            const myBet = myGsBets[m.id];
            return (
              <div key={m.id} style={{
                padding: '12px 14px', borderRadius: 12,
                background: myBet ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)',
                border: myBet ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Flag code={m.home} size="sm" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{m.home}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 2px' }}>vs</span>
                  <Flag code={m.away} size="sm" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{m.away}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{m.id}</span>
                </div>
                {myBet && (
                  <div style={{ fontSize: 11, color: 'var(--win)', marginBottom: 8 }}>
                    Your pick: player #{myBet.pick} · {fmtMoney(myBet.amount)} staked
                  </div>
                )}
                <button
                  onClick={() => onBet(m.id)}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 8,
                    background: myBet ? 'transparent' : 'var(--gold)',
                    color: myBet ? 'var(--ink-2)' : '#0a0a0a',
                    border: myBet ? '1px solid rgba(255,255,255,0.12)' : 'none',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {myBet ? 'Change pick' : 'Place goalscorer bet'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SpecialsScreen({ user, onOpenSpecialBet, bets = [], allUsers = [], matches = [] }) {
  const [poolsData, setPoolsData] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [picksData, setPicksData] = useState({});
  const [deadlines, setDeadlines] = useState({});
  const [myBetsData, setMyBetsData] = useState({});
  const [gsSummary, setGsSummary] = useState(null);

  useEffect(() => {
    // Cup-winner data
    fetch(`/api/cup-winner-bet?user_id=${user?.id || ''}`)
      .then(r => r.json())
      .then(data => {
        setPoolsData(prev => ({ ...prev, cup_winner: data.pool }));
        setPicksData(prev => ({ ...prev, cup_winner: data.picks || [] }));
        setMyBetsData(prev => ({ ...prev, cup_winner: data.myBet || null }));
        if (data.deadlineTs) setDeadlines(prev => ({ ...prev, cup_winner: data.deadlineTs }));
      })
      .catch(() => {});

    // Continent data
    fetch(`/api/special-bet?match_id=CONTINENT&kind=continent${user?.id ? `&user_id=${user.id}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setPoolsData(prev => ({ ...prev, continent: { total: data.pool?.total || 0, bettorCount: data.pool?.bettorCount || 0, byTeam: data.pool?.byOption || {} } }));
        setPicksData(prev => ({ ...prev, continent: data.picks || [] }));
        setMyBetsData(prev => ({ ...prev, continent: data.myBets?.[0] || null }));
      })
      .catch(() => {});


    // H2H data
    fetch(`/api/special-bet?match_id=MESSI_V_RONALDO&kind=h2h${user?.id ? `&user_id=${user.id}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setPoolsData(prev => ({ ...prev, h2h: { total: data.pool?.total || 0, bettorCount: data.pool?.bettorCount || 0, byTeam: data.pool?.byOption || {} } }));
        setPicksData(prev => ({ ...prev, h2h: data.picks || [] }));
        setMyBetsData(prev => ({ ...prev, h2h: data.myBets?.[0] || null }));
      })
      .catch(() => {});

    // Golden Boot data
    fetch(`/api/special-bet?match_id=GOLDEN_BOOT&kind=golden_boot${user?.id ? `&user_id=${user.id}` : ''}`)
      .then(r => r.json())
      .then(data => {
        const byOpt = data.pool?.byOption || {};
        const topPicks = Object.entries(byOpt).map(([pick, amount]) => ({ pick, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5);
        setPoolsData(prev => ({ ...prev, golden_boot: { total: data.pool?.total || 0, bettorCount: data.pool?.bettorCount || 0, topPicks, byTeam: byOpt } }));
        setPicksData(prev => ({ ...prev, golden_boot: data.picks || [] }));
        setMyBetsData(prev => ({ ...prev, golden_boot: data.myBets || [] }));
      })
      .catch(() => {});

    // Goalscorer summary
    const gsUrl = user?.id
      ? `/api/goalscorer-bet?summary=true&user_id=${user.id}`
      : '/api/goalscorer-bet?summary=true';
    fetch(gsUrl)
      .then(r => r.json())
      .then(data => { if (!data.error) setGsSummary(data); })
      .catch(() => {});
  }, [user, bets]);

  return (
    <div>
      <div className="section-head">
        <div className="section-head__title display">Special Bets</div>
      </div>

      {SPECIALS.map(special => {
        const isExpanded = expanded === special.id;

        // When another special is expanded, hide this one
        if (expanded && !isExpanded) return null;

        // Goalscorer: custom expanded view (match list) + aggregate card stats
        if (special.id === 'goalscorer') {
          const myGsCount = bets.filter(b => b.kind === 'goalscorer' && b.status === 'pending').length;
          const gsCardPool = {
            total: gsSummary?.total || 0,
            bettorCount: gsSummary?.bettorCount || 0,
            topPicks: [],
          };
          if (isExpanded) {
            return (
              <GoalScorerMatchList
                key={special.id}
                matches={matches}
                bets={bets}
                gsSummary={gsSummary}
                onBet={(matchId) => onOpenSpecialBet('goalscorer', { matchId })}
                onBack={() => setExpanded(null)}
              />
            );
          }
          const myGsTotalStake = bets.filter(b => b.kind === 'goalscorer' && b.status === 'pending').reduce((s, b) => s + b.amount, 0);
          const gsMyBet = myGsCount > 0 ? { amount: myGsTotalStake, pick: null } : null;
          return (
            <SpecialCard
              key={special.id}
              special={{ ...special, formatPick: () => '', title: `Anytime Goalscorer${myGsCount > 0 ? ` · ${myGsCount} active` : ''}` }}
              poolData={gsCardPool}
              onOpen={() => setExpanded(special.id)}
              deadlineTs={null}
              myBet={gsMyBet}
              resolvesTs={null}
            />
          );
        }

        // Continent: expandable detail view
        if (special.id === 'continent') {
          const contPool = poolsData.continent;
          const contPicks = picksData.continent || [];
          const contMyBet = myBetsData.continent || null;
          const contCardPool = {
            total: contPool?.total || 0,
            bettorCount: contPool?.bettorCount || 0,
            topPicks: contPool?.byTeam
              ? Object.entries(contPool.byTeam).map(([pick, amount]) => ({ pick, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5)
              : [],
            byTeam: contPool?.byTeam || {},
          };

          if (isExpanded) {
            return (
              <ContinentDetail
                key={special.id}
                special={special}
                poolData={contPool}
                picks={contPicks}
                myBet={contMyBet}
                user={user}
                allUsers={allUsers}
                onBack={() => setExpanded(null)}
                onPlace={() => onOpenSpecialBet('continent')}
              />
            );
          }

          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={contCardPool}
              onOpen={() => setExpanded(special.id)}
              deadlineTs={special.deadlineTs ? new Date(special.deadlineTs).getTime() : null}
              myBet={contMyBet}
              resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
            />
          );
        }

        // H2H: expandable detail view
        if (special.id === 'h2h') {
          const h2hPool = poolsData.h2h;
          const h2hMyBet = myBetsData.h2h || null;
          const h2hPicks = picksData.h2h || [];
          const topPicks = h2hPool?.byTeam
            ? Object.entries(h2hPool.byTeam).map(([pick, amount]) => ({ pick, amount })).sort((a, b) => b.amount - a.amount)
            : [];

          if (isExpanded) {
            return (
              <H2HDetail
                key={special.id}
                special={special}
                poolData={h2hPool}
                picks={h2hPicks}
                myBet={h2hMyBet}
                user={user}
                allUsers={allUsers}
                onBack={() => setExpanded(null)}
                onPlace={() => onOpenSpecialBet('h2h')}
                onCancel={() => onOpenSpecialBet('h2h')}
              />
            );
          }

          return (
            <SpecialCard
              key={special.id}
              special={special}
              poolData={{ total: h2hPool?.total || 0, bettorCount: h2hPool?.bettorCount || 0, topPicks }}
              onOpen={() => setExpanded(special.id)}
              deadlineTs={new Date(special.deadlineTs).getTime()}
              myBet={h2hMyBet}
              resolvesTs={null}
            />
          );
        }

        // Golden Boot: expandable detail view
        if (special.id === 'golden_boot') {
          const gbPool = poolsData.golden_boot;
          const gbMyBets = myBetsData.golden_boot || [];
          const gbPicks = picksData.golden_boot || [];
          const gbMyBet = gbMyBets.length > 0 ? { amount: gbMyBets.reduce((s, b) => s + b.amount, 0), pick: null } : null;

          if (isExpanded) {
            return (
              <GoldenBootDetail
                key={special.id}
                special={special}
                poolData={gbPool}
                picks={gbPicks}
                myBets={gbMyBets}
                user={user}
                allUsers={allUsers}
                onBack={() => setExpanded(null)}
                onPlace={() => onOpenSpecialBet('golden_boot')}
                onCancel={() => onOpenSpecialBet('golden_boot')}
              />
            );
          }

          return (
            <SpecialCard
              key={special.id}
              special={{ ...special, title: `Golden Boot${gbMyBets.length > 0 ? ` · ${gbMyBets.length} picks` : ''}` }}
              poolData={{ total: gbPool?.total || 0, bettorCount: gbPool?.bettorCount || 0, topPicks: gbPool?.topPicks || [] }}
              onOpen={() => setExpanded(special.id)}
              deadlineTs={new Date(special.deadlineTs).getTime()}
              myBet={gbMyBet}
              resolvesTs={null}
            />
          );
        }

        // Cup winner: expandable detail view
        const pool = poolsData[special.id];
        const picks = picksData[special.id] || [];
        const myBet = myBetsData[special.id] || null;

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
          byTeam: pool?.byTeam || {},
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
            deadlineTs={special.deadlineTs ? new Date(special.deadlineTs).getTime() : deadlines[special.id]}
            myBet={myBet}
            resolvesTs={special.resolvesTs ? new Date(special.resolvesTs).getTime() : null}
          />
        );
      })}
    </div>
  );
}
