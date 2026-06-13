'use client';

import { getTeam, getFriend, fmtCompact, fmtDate, fmtDay, getMatch, fmtTimeIST, fmtKickoffIST, fmtCountdown, getMatchKickoffTs, MATCH_BET_CUTOFF_MS } from '@/lib/data';
import { fmtMoney, fmtNet, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { getSpecial } from '@/lib/specials';
import { useState, useEffect } from 'react';

// ── Betting window ───────────────────────────────────────────
// Betting closes MATCH_BET_CUTOFF_MS (30s) before kickoff — mirrors the
// place_bet DB RPC. Returns false when the schedule isn't loaded yet (fail-safe
// closed) and re-evaluates exactly at the cutoff moment so the UI flips live.
export function useBettingOpen(matchOrTs) {
  const ts = (matchOrTs && typeof matchOrTs === 'object')
    ? getMatchKickoffTs(matchOrTs)
    : (matchOrTs == null ? null : getMatchKickoffTs({ kickoffTs: matchOrTs }));
  const cutoff = ts == null ? null : ts - MATCH_BET_CUTOFF_MS;
  const [open, setOpen] = useState(() => cutoff != null && Date.now() < cutoff);
  useEffect(() => {
    if (cutoff == null) { setOpen(false); return; }
    const update = () => setOpen(Date.now() < cutoff);
    update();
    const msUntilClose = cutoff - Date.now();
    if (msUntilClose <= 0) return; // already closed — no timer needed
    const id = setTimeout(update, msUntilClose + 250);
    return () => clearTimeout(id);
  }, [cutoff]);
  return open;
}

// ── Icons ────────────────────────────────────────────────────
export const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2z"/>
    </svg>
  ),
  ball: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>
    </svg>
  ),
  bracket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h5l3 3M3 18h5l3-3M21 12h-4l-3-3M14 15l3-3"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v6a5 5 0 01-10 0V4z"/>
      <path d="M7 7H4v3a3 3 0 003 3M17 7h3v3a3 3 0 01-3 3"/>
      <path d="M9 21h6M12 18v3"/>
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/>
      <path d="M9 8h6M9 12h6M9 16h4"/>
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
};

// ── Flag ─────────────────────────────────────────────────────
export function Flag({ code, size = 'md' }) {
  const team = getTeam(code);
  const [imgFailed, setImgFailed] = useState(false);
  const cls = size === 'xl' ? 'flag xl' : size === 'lg' ? 'flag lg' : size === 'sm' ? 'flag sm' : 'flag';
  return (
    <div className={cls}>
      {imgFailed ? (
        <span>{team.flag}</span>
      ) : (
        <img
          src={`https://api.fifa.com/api/v3/picture/flags-sq-5/${code}`}
          alt={team.name}
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      )}
    </div>
  );
}

// ── Live dot ─────────────────────────────────────────────────
export function LiveDot({ minute }) {
  return (
    <span className="live-dot">
      <span>Live{minute ? ` · ${minute}'` : ''}</span>
    </span>
  );
}

// ── Special Bet Notification ────────────────────────────────
const NOTIFICATIONS = [
  { id: 'notif_continent', label: 'Winning Continent', specialTab: 'specials' },
  { id: 'notif_h2h', label: '⚔️ Messi vs Ronaldo H2H — bet now!', specialTab: 'specials' },
  { id: 'notif_golden_boot', label: '👟 Golden Boot Winner — multi-pick!', specialTab: 'specials' },
];

export function SpecialNotification({ onNavigate }) {
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    const dismissed = JSON.parse(localStorage.getItem('adeyaar_dismissed_notifs') || '[]');
    const pending = NOTIFICATIONS.find(n => !dismissed.includes(n.id));
    setVisible(pending || null);
  }, []);

  const dismiss = () => {
    if (!visible) return;
    const dismissed = JSON.parse(localStorage.getItem('adeyaar_dismissed_notifs') || '[]');
    dismissed.push(visible.id);
    localStorage.setItem('adeyaar_dismissed_notifs', JSON.stringify(dismissed));
    const next = NOTIFICATIONS.find(n => !dismissed.includes(n.id));
    setVisible(next || null);
  };

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px 8px 16px',
      background: 'linear-gradient(90deg, rgba(0,255,133,0.08) 0%, rgba(77,168,255,0.08) 100%)',
      borderBottom: '1px solid rgba(0,255,133,0.15)',
    }}>
      <span style={{ fontSize: 14 }}>🎉</span>
      <span
        onClick={() => { onNavigate(); dismiss(); }}
        style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--gold)', cursor: 'pointer' }}
      >
        NEW SPECIAL BET: {visible.label}! <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Go bet →</span>
      </span>
      <button
        onClick={dismiss}
        style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 4, color: 'var(--ink-3)', fontSize: 14 }}
      >
        ✕
      </button>
    </div>
  );
}

// ── App Header ───────────────────────────────────────────────
export function AppHeader({ balance, realisedBalance, pendingStake, pendingCount, onTap, user, betsLoaded }) {
  return (
    <>
      <div className="app-header">
        <div className="app-header__brand">
          <div className="brand-mark">A</div>
          <div className="brand-name">AdeYaar <em>26</em></div>
        </div>
        <div className="app-header__right">
          {user && <span className="app-header__user">{user.display_name || user.username}</span>}
          {user?.avatar_url && (
            <div className="app-header__avatar" style={{ backgroundImage: `url(${user.avatar_url})` }} />
          )}
        </div>
      </div>
      <button className="stats-bar" onClick={onTap}>
        <div className="stats-bar__cell">
          <span className="stats-bar__label">Net Win/Loss</span>
          {betsLoaded === false
            ? <span className="stats-bar__value skeleton-text" style={{ width: 48 }}>&nbsp;</span>
            : <span className={`stats-bar__value ${realisedBalance >= 0 ? 'positive' : 'negative'}`}>{fmtNet(realisedBalance ?? 0)}</span>
          }
        </div>
        <div className="stats-bar__divider" />
        <div className="stats-bar__cell">
          <span className="stats-bar__label">Pending Bets</span>
          {betsLoaded === false
            ? <span className="stats-bar__value skeleton-text" style={{ width: 48 }}>&nbsp;</span>
            : <span className="stats-bar__value">{fmtMoney(pendingStake || 0)} <span style={{ fontSize: 10, opacity: 0.6 }}>({pendingCount || 0})</span></span>
          }
        </div>
      </button>
    </>
  );
}

// ── Tab bar ──────────────────────────────────────────────────
export function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'home',     label: 'Home',       icon: Icon.home },
    { id: 'fixtures', label: 'Match Bets', icon: Icon.ball },
    { id: 'specials', label: 'Special Bets', icon: Icon.star },
    { id: 'leaders',  label: 'Leaderboards', icon: Icon.trophy },
    { id: 'bets',     label: 'Account',    icon: Icon.receipt },
  ];
  return (
    <div className="tabbar">
      {tabs.map(t => (
        <button
          key={t.id}
          className={'tabbar__btn ' + (active === t.id ? 'active' : '')}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Section head ─────────────────────────────────────────────
export function SectionHead({ title, more, onMore }) {
  return (
    <div className="section-head">
      <div className="section-head__title display">{title}</div>
      {more && (
        <button className="section-head__more" onClick={onMore}>
          {more} →
        </button>
      )}
    </div>
  );
}

// ── Match card ───────────────────────────────────────────────
export function MatchCard({ match, onBet, myBets = [], onCancelBet, poolData, allUsers = [] }) {
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const bettingOpen = useBettingOpen(match);

  const stageLabel = match.group ? `Group ${match.group}` : 'Knockout';
  const city = match.venue?.split(',').pop()?.trim();
  const myTotal = myBets.reduce((s, b) => s + b.amount, 0);

  const hasBet = myTotal > 0;
  const myPick = myBets[0]?.pick;
  const pickLabel = myPick === 'home' ? home.code : myPick === 'away' ? away.code : myPick === 'draw' ? 'Draw' : '';
  const myResult = isFinished && hasBet ? (myBets.some(b => b.status === 'won') ? 'won' : myBets.some(b => b.status === 'lost') ? 'lost' : null) : null;

  return (
    <div className="match-card" style={myResult ? {
      borderColor: myResult === 'won' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
      background: myResult === 'won' ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)',
    } : undefined}>
      <div className="match-card__head">
        <span>{stageLabel}{city ? ` · ${city}` : ''}</span>
        {isLive ? <LiveDot minute={match.minute} /> :
         isFinished ? <span style={{ color: 'var(--ink-3)' }}>FT</span> :
         <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtCountdown(match.kickoffTs)}</span>}
      </div>

      <div className="match-card__teams">
        <div className="match-card__team">
          <Flag code={match.home} size="lg" />
          <div className="match-card__team-name">{home.name}</div>
        </div>

        <div className="match-card__vs">
          {(isLive || isFinished) && match.score ? (
            <div className="match-card__score">{match.score[0]}–{match.score[1]}</div>
          ) : (
            <div className="match-card__vs-time">{fmtKickoffIST(match.kickoffTs)}</div>
          )}
        </div>

        <div className="match-card__team">
          <Flag code={match.away} size="lg" />
          <div className="match-card__team-name">{away.name}</div>
        </div>
      </div>

      {!isFinished && bettingOpen && (
        <div className="match-card__odds">
          {[
            { key: 'home', label: home.code },
            { key: 'draw', label: 'X' },
            { key: 'away', label: away.code },
          ].map(o => (
            <button
              key={o.key}
              className={'odds-btn' + (hasBet && myPick === o.key ? ' odds-btn--active' : '')}
              onClick={(e) => { e.stopPropagation(); onBet?.(match, o.key); }}
            >
              <span className="odds-btn__label">{o.label}</span>
            </button>
          ))}
        </div>
      )}

      {!isFinished && !bettingOpen && (
        <div style={{
          margin: '4px 0', padding: '8px 0', textAlign: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Betting closed
        </div>
      )}

      {poolData && poolData.bets && poolData.bets.length > 0 && (
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} />
      )}

      {hasBet && (
        <div className={`match-card__footer has-bet`}>
          {isFinished ? (() => {
            const wonBet = myBets.find(b => b.status === 'won');
            const lostBet = myBets.find(b => b.status === 'lost');
            if (wonBet) return <span style={{ color: 'var(--win)' }}>Won {fmtMoney(wonBet.payout || 0)} on {pickLabel} (+{fmtMoney((wonBet.payout || 0) - wonBet.amount)})</span>;
            if (lostBet) return <span style={{ color: 'var(--loss)' }}>Lost {fmtMoney(myTotal)} on {pickLabel}</span>;
            return <span>Bet: {fmtMoney(myTotal)} on {pickLabel}</span>;
          })() : (
            <>
              <span>Your bet: {fmtMoney(myTotal)} on {pickLabel}</span>
              {bettingOpen && onCancelBet && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancelBet(match.id); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--loss)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      )}
      {!hasBet && !isFinished && (
        <div className="match-card__footer no-bet">
          <span>No bet placed</span>
        </div>
      )}
    </div>
  );
}

// ── Pool table (bets per side with possible winnings) ────────
function MatchPoolTable({ poolData, home, away, allUsers = [] }) {
  const homeBets = poolData.bets.filter(b => b.pick === 'home');
  const awayBets = poolData.bets.filter(b => b.pick === 'away');
  const drawBets = poolData.bets.filter(b => b.pick === 'draw');
  const isResolved = poolData.resolved;

  const bettorIds = new Set(poolData.bets.map(b => b.user_id));
  const notBet = allUsers.filter(u => !bettorIds.has(u.id));

  const renderSideTable = (bets, label) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.5px', color: '#fff', marginBottom: 6,
        textAlign: 'center',
      }}>{label}</div>
      {bets.length === 0 ? (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>
          —
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>User</th>
              <th style={{ padding: '3px 6px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Bet</th>
              <th style={{ padding: '3px 6px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{isResolved ? 'Result' : 'Win'}</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((b, i) => {
              const won = b.status === 'won';
              const lost = b.status === 'lost';
              return (
                <tr key={i} style={won ? { background: 'rgba(74,222,128,0.06)' } : lost ? { background: 'rgba(248,113,113,0.04)' } : undefined}>
                  <td style={{ padding: '4px 6px', color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>{(b.display_name || b.username || '?').split(' ')[0]}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{CURRENCY_SYMBOL}{b.amount}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: won ? '#4ade80' : lost ? '#f87171' : '#4ade80' }}>
                    {won ? `+${CURRENCY_SYMBOL}${(b.payout || 0) - b.amount}` : lost ? `-${CURRENCY_SYMBOL}${b.amount}` : (
                      <>{CURRENCY_SYMBOL}{b.possible_win}{b.possible_win > b.amount && <span style={{ fontSize: 9, opacity: 0.7 }}> +{Math.round(((b.possible_win - b.amount) / b.amount) * 100)}%</span>}</>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div style={{
      margin: '10px 0 6px',
      padding: '12px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.8px', color: 'rgba(255,255,255,0.5)', marginBottom: 10,
        textAlign: 'center',
      }}>
        Pool: {CURRENCY_SYMBOL}{poolData.total} · {poolData.bettorCount} bettor{poolData.bettorCount !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {renderSideTable(homeBets, home.name)}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        {renderSideTable(awayBets, away.name)}
      </div>
      {drawBets.length > 0 && (
        <div style={{ marginTop: 10, maxWidth: '60%', marginLeft: 'auto', marginRight: 'auto' }}>
          {renderSideTable(drawBets, 'Draw')}
        </div>
      )}
      {/* Proportional bar */}
      {poolData.total > 0 && (() => {
        const hPct = (poolData.bySide?.home || 0) / poolData.total * 100;
        const aPct = (poolData.bySide?.away || 0) / poolData.total * 100;
        const dPct = (poolData.bySide?.draw || 0) / poolData.total * 100;
        return (
          <div style={{
            marginTop: 10, height: 6, borderRadius: 3, overflow: 'hidden',
            display: 'flex', background: 'rgba(255,255,255,0.1)',
          }}>
            {hPct > 0 && <div style={{ width: `${hPct}%`, background: '#4ade80' }} />}
            {dPct > 0 && <div style={{ width: `${dPct}%`, background: '#6b7280' }} />}
            {aPct > 0 && <div style={{ width: `${aPct}%`, background: '#f87171' }} />}
          </div>
        );
      })()}
      {notBet.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, color: 'rgba(255,255,255,0.3)',
          textAlign: 'center',
        }}>
          Haven&apos;t bet: {notBet.map(u => (u.display_name || u.username || '?').split(' ')[0]).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Hero match ───────────────────────────────────────────────
function useCountdown(targetTs) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    if (!targetTs) return;
    const tick = () => {
      const diff = targetTs - Date.now();
      if (diff <= 0) { setLeft('Started'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTs]);
  return left;
}

export function HeroMatch({ match, onBet, poolData, allUsers = [], myBets = [], onCancelBet }) {
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const bettingOpen = useBettingOpen(match);
  const myTotal = myBets.reduce((s, b) => s + b.amount, 0);
  const hasBet = myTotal > 0;
  const myPick = myBets[0]?.pick;
  const pickLabel = myPick === 'home' ? home.code : myPick === 'away' ? away.code : myPick === 'draw' ? 'Draw' : '';

  const kickoffTs = match.kickoffTs ? new Date(match.kickoffTs).getTime() : null;
  const countdown = useCountdown(kickoffTs);

  return (
    <div className="hero">
      <div className="row between center">
        <div className="hero__stage">
          {isLive ? '★ LIVE' : isFinished ? 'FINISHED' : 'Round of 32 · Featured'}
        </div>
        {isLive && <LiveDot minute={match.minute} />}
        {!isLive && !isFinished && countdown && (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 600 }}>
            ⏱ {countdown}
          </span>
        )}
      </div>

      <div className="hero__matchup">
        <div className="hero__team">
          <Flag code={match.home} size="xl" />
          <div className="hero__team-name">{home.name}</div>
        </div>
        <div className="col center" style={{ gap: 6 }}>
          {isLive && match.score ? (
            <div className="match-card__score" style={{ fontSize: 32 }}>
              {match.score[0]}–{match.score[1]}
            </div>
          ) : (
            <>
              <div className="hero__vs">VS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {fmtKickoffIST(match.kickoffTs)}
              </div>
            </>
          )}
        </div>
        <div className="hero__team">
          <Flag code={match.away} size="xl" />
          <div className="hero__team-name">{away.name}</div>
        </div>
      </div>

      {bettingOpen ? (
        <div className="hero__cta-row">
          <button className="btn primary lg" onClick={() => onBet(match, 'home')}>
            Bet {home.code}
          </button>
          <button className="btn lg" onClick={() => onBet(match, 'away')}>
            Bet {away.code}
          </button>
        </div>
      ) : !isFinished && (
        <div style={{
          marginTop: 8, padding: '10px 0', textAlign: 'center',
          fontSize: 12, fontWeight: 600, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Betting closed
        </div>
      )}

      {hasBet && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--win)' }}>Your bet: {fmtMoney(myTotal)} on {pickLabel}</span>
          {bettingOpen && onCancelBet && (
            <button
              onClick={() => onCancelBet(match.id)}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >Cancel</button>
          )}
        </div>
      )}

      {poolData && poolData.bets && poolData.bets.length > 0 && (
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} />
      )}
    </div>
  );
}

// ── Place bet sheet ──────────────────────────────────────────
export function PlaceBetSheet({ match, pick, onClose, onConfirm, poolInfo, existingBets = [] }) {
  const presets = [100, 250, 500, 1000];
  const [amount, setAmount] = useState(250);
  const [side, setSide] = useState(pick || 'home');
  const [submitting, setSubmitting] = useState(false);
  const bettingOpen = useBettingOpen(match);

  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const sideName = side === 'home' ? home.name : side === 'away' ? away.name : 'Draw';

  const existingPick = existingBets.length > 0 ? existingBets[0].pick : null;
  const existingTotal = existingBets.reduce((s, b) => s + b.amount, 0);
  const isSwitching = existingPick && existingPick !== side;


  // Compute potential payout from pool info
  const pool = poolInfo || {};
  const bySide = pool.bySide || { home: 0, away: 0, draw: 0 };
  const totalPool = (pool.total || 0) + amount;
  const sideTotal = (bySide[side] || 0) + amount;
  const potentialPayout = sideTotal > 0 ? Math.round((amount / sideTotal) * totalPool) : 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        <div className="row between center" style={{ marginBottom: 14 }}>
          <div className="eyebrow">Place your bet</div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
          >
            {Icon.close}
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>

        {/* Pool info */}
        {pool.bettorCount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, textAlign: 'center' }}>
            {pool.bettorCount} friend{pool.bettorCount !== 1 ? 's' : ''} bet on this match · Pool: {fmtMoney(pool.total)}
          </div>
        )}

        {/* Match preview */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
            <span>{match.group ? `Group ${match.group}` : 'Knockout'} · {fmtKickoffIST(match.kickoffTs)}</span>
            <span className="mono">{match.id}</span>
          </div>
          <div className="row between center" style={{ gap: 10 }}>
            <div className="row center" style={{ gap: 8 }}>
              <Flag code={match.home} />
              <span style={{ fontWeight: 600 }}>{home.name}</span>
            </div>
            <span className="mono" style={{ color: 'var(--ink-3)' }}>vs</span>
            <div className="row center" style={{ gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{away.name}</span>
              <Flag code={match.away} />
            </div>
          </div>
        </div>

        {/* Side picker */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>Your pick</div>
        <div className="match-card__odds" style={{ marginBottom: 18 }}>
          {[
            { k: 'home', l: home.name },
            { k: 'draw', l: 'Draw' },
            { k: 'away', l: away.name },
          ].map(o => (
            <button
              key={o.k}
              className={'odds-btn ' + (side === o.k ? 'fav' : '')}
              style={side === o.k ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : {}}
              onClick={() => setSide(o.k)}
            >
              <span className="odds-btn__label">
                {o.l.length > 8 ? (o.k === 'home' ? home.code : o.k === 'away' ? away.code : 'X') : o.l}
              </span>
            </button>
          ))}
        </div>

        {/* Switch warning */}
        {isSwitching && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.2)',
            fontSize: 12, color: 'var(--loss)', lineHeight: 1.4,
          }}>
            You have {fmtMoney(existingTotal)} on <b>{existingPick === 'home' ? home.name : existingPick === 'away' ? away.name : 'Draw'}</b>.
            Switching to <b>{sideName}</b> will cancel your previous bet and refund it.
          </div>
        )}

        {/* Same-side existing bet info */}
        {existingPick && existingPick === side && !isSwitching && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.2)',
            fontSize: 12, color: 'var(--win)', lineHeight: 1.4,
          }}>
            You already have <b>{fmtMoney(existingTotal)}</b> on <b>{sideName}</b>. Cancel your existing bet first to place a new one.
          </div>
        )}

        {/* Amount */}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Amount</div>

        <div style={{
          textAlign: 'center', padding: '14px 0',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36,
          color: 'var(--ink)',
        }}>
          {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
        </div>

        <input
          type="range" className="slider"
          min={50} max={MAX_BET} step={50}
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          style={{ marginBottom: 14 }}
        />

        <div className="amount-presets" style={{ marginBottom: 18 }}>
          {presets.map(p => (
            <button key={p} className={amount === p ? 'active' : ''} onClick={() => setAmount(p)}>
              {CURRENCY_SYMBOL}{p}
            </button>
          ))}
        </div>

        {/* Potential payout — prominent */}
        {potentialPayout > 0 && (
          <div style={{
            textAlign: 'center', marginBottom: 14,
            padding: '10px 0',
            borderRadius: 'var(--radius)',
            background: 'rgba(39, 174, 96, 0.08)',
            border: '1px solid rgba(39, 174, 96, 0.2)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>If {sideName} wins, you get</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
              color: 'var(--win)',
            }}>
              {fmtMoney(potentialPayout)} <span style={{ fontSize: 14, opacity: 0.8 }}>(+{Math.round(((potentialPayout - amount) / amount) * 100)}%)</span>
            </div>
            {potentialPayout > amount && (
              <div style={{ fontSize: 11, color: 'var(--win)', opacity: 0.8 }}>
                +{fmtMoney(potentialPayout - amount)} profit
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--radius)',
          background: 'var(--surface-2)', marginBottom: 16,
          border: '1px solid var(--line)',
        }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Pick</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{sideName}</span>
          </div>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Stake</span>
            <span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(amount)}</span>
          </div>
          <div className="row between">
            <span className="muted" style={{ fontSize: 12 }}>Pool size (with your bet)</span>
            <span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(totalPool)}</span>
          </div>
        </div>

        </div>{/* end scrollable content */}

        <button
          className="btn primary block lg"
          style={{ flexShrink: 0, marginTop: 12 }}
          disabled={submitting || !bettingOpen || (existingPick === side)}
          onClick={async () => {
            setSubmitting(true);
            try { await onConfirm({ matchId: match.id, pick: side, amount }); }
            catch { /* parent handles */ }
            finally { setSubmitting(false); }
          }}
        >
          {submitting ? 'Placing...' : !bettingOpen ? 'Betting closed' : (existingPick === side) ? 'Already placed — cancel to change' : `Place ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} bet`}
        </button>
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────
export function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  const isError = message?.startsWith('Error');
  return (
    <div className="toast" style={isError ? { borderColor: 'var(--loss)' } : undefined}>
      <span>{isError ? '✗' : '✓'}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Bet card (My Bets screen) ────────────────────────────────
export function BetCard({ bet, onCancelBet, kickoffTs, cupWinnerDeadlineTs }) {
  const matchId = bet.match_id || bet.matchId;
  const isSpecial = bet.kind && bet.kind !== 'match';
  const match = !isSpecial ? getMatch(matchId) : null;
  // Called unconditionally (Rules of Hooks) before any early return.
  const bettingOpen = useBettingOpen(kickoffTs);

  if (!isSpecial && !match) {
    const pickLabel = bet.pick === 'home' ? 'Home' : bet.pick === 'away' ? 'Away' : bet.pick === 'draw' ? 'Draw' : bet.pick;
    const canCancel = bet.status === 'pending' && onCancelBet;
    return (
      <div className="bet-card">
        <div className="bet-card__head">
          <span>Match bet</span>
          <span className={'bet-card__status ' + bet.status}>{bet.status}</span>
        </div>
        <div className="bet-card__pick">
          <span className="eyebrow">Pick</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{pickLabel}</span>
        </div>
        <div className="bet-card__amounts">
          <div><span>Stake</span><span>{fmtMoney(bet.amount)}</span></div>
          <div>
            <span>{bet.status === 'won' ? 'Payout' : bet.status === 'lost' ? 'Lost' : 'Status'}</span>
            <span className={bet.status === 'won' ? 'win' : bet.status === 'lost' ? 'loss' : 'gold'}>
              {bet.status === 'won' ? fmtMoney(bet.payout) : bet.status === 'lost' ? '−' + fmtMoney(bet.amount) : 'Pending'}
            </span>
          </div>
        </div>
        {canCancel && (
          <button
            onClick={() => onCancelBet(matchId)}
            style={{
              width: '100%', marginTop: 10, padding: '9px 0',
              background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.25)',
              borderRadius: 8, color: 'var(--loss)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel bet
          </button>
        )}
      </div>
    );
  }

  if (isSpecial) {
    const specialDef = getSpecial(bet.kind);
    const pickLabel = specialDef?.formatPick?.(bet.pick) || bet.pick;
    const isTeamPick = specialDef?.optionType === 'team';
    const specialDeadlinePassed = cupWinnerDeadlineTs && Date.now() >= cupWinnerDeadlineTs;
    const canCancel = bet.status === 'pending' && onCancelBet && !specialDeadlinePassed;
    return (
      <div className="bet-card">
        <div className="bet-card__head">
          <span style={{ color: 'var(--gold)' }}>⭐ Special · {
            bet.kind === 'cup_winner' ? 'Cup Winner' :
            bet.kind === 'continent' ? 'Winning Continent' :
            bet.kind === 'h2h' ? 'Messi vs Ronaldo' :
            bet.kind === 'golden_boot' ? 'Golden Boot' :
            bet.kind === 'goalscorer' ? 'Goalscorer' :
            bet.kind
          }</span>
          <span className={'bet-card__status ' + bet.status}>{bet.status}</span>
        </div>

        <div className="row center" style={{ gap: 8, margin: '8px 0' }}>
          {isTeamPick && <Flag code={bet.pick} size="sm" />}
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
            {pickLabel}
          </span>
        </div>

        <div className="bet-card__amounts">
          <div>
            <span>Stake</span>
            <span>{fmtMoney(bet.amount)}</span>
          </div>
          <div>
            <span>{bet.status === 'won' ? 'Payout' : bet.status === 'lost' ? 'Lost' : 'Status'}</span>
            <span className={bet.status === 'won' ? 'win' : bet.status === 'lost' ? 'loss' : 'gold'}>
              {bet.status === 'won' ? fmtMoney(bet.payout) :
               bet.status === 'lost' ? '−' + fmtMoney(bet.amount) :
               'Pending'}
            </span>
          </div>
        </div>

        {canCancel && (
          <button
            onClick={() => onCancelBet(matchId)}
            style={{
              width: '100%', marginTop: 10, padding: '9px 0',
              background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.25)',
              borderRadius: 8, color: 'var(--loss)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel bet · Refund {fmtMoney(bet.amount)}
          </button>
        )}
      </div>
    );
  }

  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const pickedTeam = bet.pick === 'home' ? home : bet.pick === 'away' ? away : null;
  const isLive = match.status === 'live';
  // Betting closes 30s before kickoff (time-based, not status-based) so cancel
  // disappears even before FIFA marks the match live/finished.
  const canCancel = bet.status === 'pending' && bettingOpen && onCancelBet;

  return (
    <div className="bet-card">
      <div className="bet-card__head">
        <span>{match.group ? `Group ${match.group}` : 'Knockout'}{match.date ? ` · ${fmtDay(match.date)}` : ''}</span>
        <span className={'bet-card__status ' + bet.status}>{bet.status}</span>
      </div>

      <div className="row between center">
        <div className="row center" style={{ gap: 8 }}>
          <Flag code={match.home} size="sm" />
          <span style={{ fontWeight: 500, fontSize: 13 }}>{home.code}</span>
          <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            {match.score ? `${match.score[0]}-${match.score[1]}` : 'v'}
          </span>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{away.code}</span>
          <Flag code={match.away} size="sm" />
        </div>
        {isLive && <LiveDot minute={match.minute} />}
      </div>

      <div className="bet-card__pick">
        <span className="eyebrow">Pick</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {pickedTeam ? pickedTeam.name : 'Draw'}
        </span>
        <span className="mono dim" style={{ fontSize: 12 }}>parimutuel</span>
      </div>

      <div className="bet-card__amounts">
        <div>
          <span>Stake</span>
          <span>{fmtMoney(bet.amount)}</span>
        </div>
        <div>
          <span>{bet.status === 'won' ? 'Payout' : bet.status === 'lost' ? 'Lost' : 'Status'}</span>
          <span className={bet.status === 'won' ? 'win' : bet.status === 'lost' ? 'loss' : 'gold'}>
            {bet.status === 'won' ? fmtMoney(bet.payout) :
             bet.status === 'lost' ? '−' + fmtMoney(bet.amount) :
             'Pending'}
          </span>
        </div>
      </div>

      {canCancel && (
        <button
          onClick={() => onCancelBet(bet.match_id || bet.matchId)}
          style={{
            width: '100%', marginTop: 10, padding: '9px 0',
            background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.25)',
            borderRadius: 8, color: 'var(--loss)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel bet · Refund {fmtMoney(bet.amount)}
        </button>
      )}
    </div>
  );
}

