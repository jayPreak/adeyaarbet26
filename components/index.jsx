'use client';

import { getTeam, getFriend, fmtCompact, fmtDate, fmtDay, getMatch, fmtTimeIST, fmtKickoffIST, fmtCountdown, getMatchKickoffTs, MATCH_BET_CUTOFF_MS, LINEUP_ANNOUNCE_MS } from '@/lib/data';
import { fmtMoney, fmtNet, CURRENCY_SYMBOL, MAX_BET, getMinBet } from '@/lib/currency';
import { getSpecial } from '@/lib/specials';
import { poolOdds, sideOdds, fmtDecimalOdds, fmtImpliedProb } from '@/lib/odds';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LineupSheet from './LineupSheet';

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
  newspaper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/>
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
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
    <div className="special-notif" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px 8px 16px',
      marginBottom: 8,
      background: 'linear-gradient(90deg, rgba(0,255,133,0.08) 0%, rgba(77,168,255,0.08) 100%)',
      borderBottom: '1px solid rgba(0,255,133,0.15)',
    }}>
      <span style={{ fontSize: 14 }}>🎉</span>
      <span
        onClick={() => { typeof onNavigate === 'string' ? (window.location.href = onNavigate) : onNavigate(); dismiss(); }}
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
export function AppHeader({ balance, realisedBalance, pendingStake, pendingCount, bestCaseWin, onTap, user, betsLoaded }) {
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
      <button className="stats-bar" onClick={typeof onTap === 'string' ? () => { window.location.href = onTap; } : onTap}>
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
  const pathname = usePathname();
  const tabs = [
    { id: 'home',     path: '/home',              label: 'Home',       icon: Icon.home },
    { id: 'fixtures', path: '/fixtures/upcoming', label: 'Matches',  icon: Icon.ball },
    { id: 'specials', path: '/specials',          label: 'Specials', icon: Icon.star },
    { id: 'leaders',  path: '/leaders/rankings',  label: 'Leaders',  icon: Icon.trophy },
    { id: 'news',     path: '/news',              label: 'News',       icon: Icon.newspaper },
    { id: 'account',  path: '/account/overview',  label: 'Account',    icon: Icon.receipt },
  ];

  // Support both old prop-based and new route-based usage
  if (onChange) {
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

  const activeTab = tabs.find(t => pathname.startsWith(t.path.split('/').slice(0, 2).join('/')));
  return (
    <div className="tabbar">
      {tabs.map(t => (
        <Link
          key={t.id}
          href={t.path}
          className={'tabbar__btn ' + (activeTab?.id === t.id ? 'active' : '')}
        >
          {t.icon}
          <span>{t.label}</span>
        </Link>
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
// ── Watch live links (shown on in-play matches) ──────────────
const NEXTDNS_APP = 'https://apps.apple.com/in/app/nextdns/id1463342498';
const NEXTDNS_PROFILE = 'https://apple.nextdns.io';
const ADGUARD_DNS = 'https://apps.apple.com/in/app/adguard-dns/id6754605049';
const GOOGLE_DOH = 'https://github.com/paulmillr/encrypted-dns/raw/master/signed/google-default-https.mobileconfig';
const CF_HOME = 'https://one.one.one.one/';
const PROTON_VPN = 'https://protonvpn.com/';
const MULLVAD = 'https://mullvad.net/';

export function WatchLive({ home, away }) {
  const [showHelp, setShowHelp] = useState(false);
  const favicon = (domain) => `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  const stop = (e) => e.stopPropagation();

  const pill = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 11px', borderRadius: 8, textDecoration: 'none',
    fontSize: 12, fontWeight: 600, color: 'var(--ink)',
    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
  };
  const dlink = { color: 'var(--cool)', textDecoration: 'underline', fontWeight: 600 };
  const A = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" onClick={stop} style={dlink}>{children}</a>;

  return (
    <div style={{ marginTop: 10 }} onClick={stop}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--loss)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Watch live
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <a href="https://streamed.pk/category/football" target="_blank" rel="noopener noreferrer" style={pill} onClick={stop}>
            <img src="/streamed.png" alt="" width={16} height={16} style={{ borderRadius: 3 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            streamed.pk
          </a>
          <a href="https://www.zee5.com" target="_blank" rel="noopener noreferrer" style={pill} onClick={stop}>
            <img src={favicon('zee5.com')} alt="" width={16} height={16} style={{ borderRadius: 3 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ZEE5
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { stop(e); setShowHelp(v => !v); }}
        style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ textDecoration: 'underline' }}>streamed.pk blocked?</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showHelp ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {showHelp && (
        <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
            ISPs (Jio especially) block streamed.pk at the DNS level. Switch to encrypted DNS and it loads again. The 1.1.1.1 app is gone from India's App Store, so use NextDNS.
          </div>
          {[
            ['iPhone', <>Install <A href={NEXTDNS_APP}>NextDNS</A>, open it, tap Enable. Works on Airtel, Vi and most Jio.</>],
            ['No app?', <>Open <A href={NEXTDNS_PROFILE}>apple.nextdns.io</A> in Safari, tap Download Profile, then Settings &gt; Profile Downloaded &gt; Install.</>],
            ['Also works', <><A href={ADGUARD_DNS}>AdGuard DNS</A> app, or a Google DoH <A href={GOOGLE_DOH}>profile</A> (no account).</>],
            ['Android', <>The <A href={NEXTDNS_APP}>NextDNS app</A>, or Settings &gt; Network &amp; internet &gt; Private DNS. Plain one.one.one.one may be blocked on Jio.</>],
            ['Desktop', <>Install the <A href={CF_HOME}>1.1.1.1 app</A> for Windows or Mac, then turn it on.</>],
            ['Still blocked', <>Fails even after this? That is an SNI/IP block (Jio). Only a VPN fixes it: <A href={PROTON_VPN}>Proton VPN</A> or <A href={MULLVAD}>Mullvad</A>.</>],
          ].map(([label, body]) => (
            <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11 }}>
              <span style={{ minWidth: 78, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'var(--ink-2)' }}>{body}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            Check it worked at <a href="https://test.nextdns.io" target="_blank" rel="noopener noreferrer" onClick={stop} className="mono" style={dlink}>test.nextdns.io</a>. Mirror list: <a href="https://strmd.link" target="_blank" rel="noopener noreferrer" onClick={stop} className="mono" style={dlink}>strmd.link</a>.
          </div>
        </div>
      )}
    </div>
  );
}

export function MatchCard({ match, onBet, myBets = [], onCancelBet, poolData, allUsers = [], userId }) {
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const bettingOpen = useBettingOpen(match);
  const [lineupOpen, setLineupOpen] = useState(false);

  const kickoffTs = getMatchKickoffTs(match);
  const lineupAvailable = kickoffTs != null && Date.now() >= kickoffTs - LINEUP_ANNOUNCE_MS;

  const STAGE_NAMES = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarterfinal', SF: 'Semifinal', Final: 'Final', '3rd': '3rd Place' };
  const stageLabel = match.group ? `Group ${match.group}` : (STAGE_NAMES[match.stage] || 'Knockout');
  const city = match.venue?.split(',').pop()?.trim();
  const wonBet = myBets.find(b => b.status === 'won');
  const lostBet = myBets.find(b => b.status === 'lost');
  const pendingBet = myBets.find(b => b.status === 'pending');
  // Use the resolved/active bet for pick label — not necessarily the first bet (could be a side-switch cancel)
  const activeBet = wonBet || lostBet || pendingBet || myBets[myBets.length - 1];
  const myPick = activeBet?.pick;
  const pickLabel = myPick === 'home' ? home.code : myPick === 'away' ? away.code : myPick === 'draw' ? 'Draw' : '';
  const hasBet = myBets.length > 0;
  const myResult = isFinished && hasBet ? (wonBet ? 'won' : lostBet ? 'lost' : null) : null;

  return (
    <div className="match-card" style={myResult ? {
      borderColor: myResult === 'won' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
      background: myResult === 'won' ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)',
    } : undefined}>
      <div className="match-card__head">
        <span>{stageLabel}{match.knockout && match.id ? ` · Match ${match.id.split('-')[1]}` : ''}{city ? ` · ${city}` : ''}</span>
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

      {isLive && <WatchLive home={match.home} away={match.away} />}

      {!isFinished && bettingOpen && (
        <div className={'match-card__odds' + (match.knockout ? ' match-card__odds--2col' : '')}>
          {[
            { key: 'home', label: home.code },
            ...(!match.knockout ? [{ key: 'draw', label: 'X' }] : []),
            { key: 'away', label: away.code },
          ].map(o => {
            const odds = poolData?.total > 0 ? sideOdds(poolData, o.key) : null;
            return (
              <button
                key={o.key}
                className={'odds-btn' + (hasBet && myPick === o.key ? ' odds-btn--active' : '')}
                onClick={(e) => { e.stopPropagation(); onBet?.(match, o.key); }}
              >
                <span className="odds-btn__label">{o.label}</span>
                {odds && <span className="odds-btn__value">{fmtDecimalOdds(odds)}</span>}
              </button>
            );
          })}
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
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} userId={userId} />
      )}

      {hasBet && (
        <div className={`match-card__footer has-bet`}>
          {isFinished ? (() => {
            const lastCancelledBet = [...myBets].reverse().find(b => b.status === 'cancelled');
            if (wonBet) return <span style={{ color: 'var(--win)' }}>Won {fmtMoney(wonBet.payout || 0)} on {pickLabel} (+{fmtMoney((wonBet.payout || 0) - wonBet.amount)})</span>;
            if (lostBet) { const totalLost = myBets.filter(b => b.status === 'lost').reduce((s, b) => s + b.amount, 0); return <span style={{ color: 'var(--loss)' }}>Lost {fmtMoney(totalLost)} on {pickLabel}</span>; }
            if (lastCancelledBet) return <span style={{ color: 'var(--ink-3)' }}>Refunded {fmtMoney(lastCancelledBet.amount)} — no winner picked</span>;
            return <span>Bet: {fmtMoney(pendingBet?.amount || 0)} on {pickLabel}</span>;
          })() : (
            <>
              <span>Your bet: {fmtMoney(pendingBet?.amount || 0)} on {pickLabel}</span>
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

      {lineupAvailable && (
        <button
          onClick={(e) => { e.stopPropagation(); setLineupOpen(true); }}
          style={{
            width: '100%', marginTop: 4, padding: '8px 0',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: 'var(--ink-2)', fontSize: 12, fontWeight: 600,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
          </svg>
          View Lineup
        </button>
      )}

      <LineupSheet match={match} open={lineupOpen} onClose={() => setLineupOpen(false)} />
    </div>
  );
}

// ── Pool table (bets per side with possible winnings) ────────
export function MatchPoolTable({ poolData, home, away, allUsers = [], userId }) {
  const homeBets = poolData.bets.filter(b => b.pick === 'home');
  const awayBets = poolData.bets.filter(b => b.pick === 'away');
  const drawBets = poolData.bets.filter(b => b.pick === 'draw');
  const isResolved = poolData.resolved;
  const isRefunded = poolData.refunded;

  const bettorIds = new Set(poolData.bets.map(b => b.user_id));
  const notBet = allUsers.filter(u => !bettorIds.has(u.id));

  const renderSideTable = (bets, label, isWinningSide) => (
    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', padding: isWinningSide ? '6px 4px' : undefined, borderRadius: isWinningSide ? 8 : undefined, border: isWinningSide ? '1px solid rgba(74,222,128,0.25)' : undefined, background: isWinningSide ? 'rgba(74,222,128,0.04)' : undefined }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.5px', color: isWinningSide ? '#4ade80' : '#fff', marginBottom: 6,
        textAlign: 'center',
      }}>{label}{isWinningSide ? ' ✓' : ''}</div>
      {bets.length === 0 ? (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>
          —
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '40%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '3px 4px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>User</th>
              <th style={{ padding: '3px 4px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Bet</th>
              <th style={{ padding: '3px 4px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{isRefunded ? 'Status' : isResolved ? 'Result' : 'Win'}</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((b, i) => {
              const won = b.status === 'won';
              const lost = b.status === 'lost';
              const refunded = b.status === 'cancelled';
              return (
                <tr key={i} style={won ? { background: 'rgba(74,222,128,0.06)' } : lost ? { background: 'rgba(248,113,113,0.04)' } : refunded ? { background: 'rgba(255,255,255,0.02)' } : undefined}>
                  <td style={{ padding: '4px 4px', color: 'rgba(255,255,255,0.9)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(b.display_name || b.username || '?').split(' ')[0]}
                    {userId && b.user_id === userId && <span style={{ marginLeft: 3, fontSize: 8, padding: '1px 3px', borderRadius: 3, background: 'rgba(147,197,253,0.15)', color: 'rgba(147,197,253,0.9)', fontWeight: 700 }}>YOU</span>}
                  </td>
                  <td style={{ padding: '4px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{CURRENCY_SYMBOL}{b.amount}</td>
                  <td style={{ padding: '4px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: won ? '#4ade80' : lost ? '#f87171' : refunded ? 'var(--ink-3)' : '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {refunded ? '↩ ₹0' : won ? `+${CURRENCY_SYMBOL}${(b.payout || 0) - b.amount}` : lost ? `-${CURRENCY_SYMBOL}${b.amount}` : (
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
      padding: '10px 8px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.8px', color: 'rgba(255,255,255,0.5)', marginBottom: 10,
        textAlign: 'center',
      }}>
        {isRefunded
          ? <span style={{ color: 'var(--ink-3)' }}>Refunded · no one picked the winner</span>
          : <>Pool: {CURRENCY_SYMBOL}{poolData.total} · {poolData.bettorCount} bettor{poolData.bettorCount !== 1 ? 's' : ''}</>
        }
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {renderSideTable(homeBets, home.name, isResolved && homeBets.some(b => b.status === 'won'))}
        <div style={{ width: 1, flexShrink: 0, background: 'rgba(255,255,255,0.1)' }} />
        {renderSideTable(awayBets, away.name, isResolved && awayBets.some(b => b.status === 'won'))}
      </div>
      {drawBets.length > 0 && (
        <div style={{ marginTop: 10, maxWidth: '60%', marginLeft: 'auto', marginRight: 'auto' }}>
          {renderSideTable(drawBets, 'Draw', isResolved && drawBets.some(b => b.status === 'won'))}
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

export function HeroMatch({ match, onBet, poolData, allUsers = [], myBets = [], onCancelBet, userId }) {
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

      {isLive && <WatchLive home={match.home} away={match.away} />}

      {bettingOpen ? (
        <div className="hero__cta-row">
          <button className="btn primary lg" onClick={() => onBet(match, 'home')}>
            Bet {home.code}{poolData?.total > 0 && sideOdds(poolData, 'home') ? ` · ${fmtDecimalOdds(sideOdds(poolData, 'home'))}` : ''}
          </button>
          <button className="btn lg" onClick={() => onBet(match, 'away')}>
            Bet {away.code}{poolData?.total > 0 && sideOdds(poolData, 'away') ? ` · ${fmtDecimalOdds(sideOdds(poolData, 'away'))}` : ''}
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
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} userId={userId} />
      )}
    </div>
  );
}

// ── Place bet sheet ──────────────────────────────────────────
export function PlaceBetSheet({ match, pick, onClose, onConfirm, poolInfo, existingBets = [] }) {
  const minBet = getMinBet(match?.id);
  const presets = [100, 250, 500, 1000].filter(p => p >= minBet);
  const [amount, setAmount] = useState(Math.max(250, minBet));
  const [side, setSide] = useState(pick || 'home');
  const [submitting, setSubmitting] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [justRandomized, setJustRandomized] = useState(false);
  const bettingOpen = useBettingOpen(match);

  function handleRandomize() {
    setRandomizing(true);
    setJustRandomized(false);
    // Spin for 600ms then reveal
    const funAmounts = [50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000];
    const isKnockout = !match.group;
    const sides = isKnockout ? ['home', 'away'] : ['home', 'draw', 'away'];
    let ticks = 0;
    const totalTicks = 8;
    const interval = setInterval(() => {
      setSide(sides[Math.floor(Math.random() * sides.length)]);
      setAmount(funAmounts[Math.floor(Math.random() * funAmounts.length)]);
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(interval);
        // Final pick
        const finalSide = sides[Math.floor(Math.random() * sides.length)];
        const finalAmount = funAmounts[Math.floor(Math.random() * funAmounts.length)];
        setSide(finalSide);
        setAmount(finalAmount);
        setRandomizing(false);
        setJustRandomized(true);
        setTimeout(() => setJustRandomized(false), 2500);
      }
    }, 70);
  }

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

        <div className="row between center" style={{ marginBottom: 10 }}>
          <div className="eyebrow">Place your bet</div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
          >
            {Icon.close}
          </button>
        </div>

        {/* 🎲 Randomize button */}
        <button
          onClick={handleRandomize}
          disabled={randomizing || !bettingOpen}
          style={{
            width: '100%',
            marginBottom: 14,
            padding: '11px 0',
            borderRadius: 12,
            border: '2px dashed',
            borderColor: randomizing ? 'var(--gold)' : justRandomized ? '#a855f7' : '#e879f9',
            background: randomizing
              ? 'rgba(212,175,55,0.10)'
              : justRandomized
                ? 'rgba(168,85,247,0.13)'
                : 'rgba(232,121,249,0.08)',
            color: randomizing ? 'var(--gold)' : justRandomized ? '#c084fc' : '#e879f9',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.04em',
            cursor: randomizing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            boxShadow: justRandomized ? '0 0 16px rgba(168,85,247,0.35)' : randomizing ? '0 0 12px rgba(212,175,55,0.25)' : 'none',
          }}
        >
          <span style={{
            fontSize: 20,
            display: 'inline-block',
            animation: randomizing ? 'spin 0.4s linear infinite' : 'none',
          }}>🎲</span>
          <span>{randomizing ? 'Randomizing…' : justRandomized ? '✨ Fate has spoken!' : 'I\'m Feeling Lucky'}</span>
        </button>
        {justRandomized && (
          <div style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#c084fc',
            marginTop: -10,
            marginBottom: 10,
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}>
            The dice chose for you — confirm below ↓
          </div>
        )}

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

        {/* Side picker — live pool odds shown per side */}
        <div className="row between center" style={{ marginBottom: 8 }}>
          <div className="eyebrow">Your pick</div>
          {pool.total > 0 && (
            <span style={{ fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--win)', display: 'inline-block' }} />
              Live odds · updates until kickoff
            </span>
          )}
        </div>
        <div className="match-card__odds" style={{ marginBottom: pool.total > 0 ? 8 : 18 }}>
          {[
            { k: 'home', l: home.name },
            ...(!match.group ? [] : [{ k: 'draw', l: 'Draw' }]),
            { k: 'away', l: away.name },
          ].map(o => {
            const odds = pool.total > 0 ? sideOdds(pool, o.k) : null;
            return (
              <button
                key={o.k}
                className={'odds-btn ' + (side === o.k ? 'fav' : '')}
                style={side === o.k ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : {}}
                onClick={() => setSide(o.k)}
              >
                <span className="odds-btn__label">
                  {o.l.length > 8 ? (o.k === 'home' ? home.code : o.k === 'away' ? away.code : 'X') : o.l}
                </span>
                {pool.total > 0 && (
                  <span style={{ display: 'block', marginTop: 4, fontSize: 13, fontWeight: 800, color: side === o.k ? 'var(--gold)' : 'var(--ink-2)' }}>
                    {fmtDecimalOdds(odds)}
                  </span>
                )}
                {pool.total > 0 && (
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-3)' }}>
                    {fmtImpliedProb(odds)} chance
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {pool.total > 0 && (
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', marginBottom: 18, lineHeight: 1.4 }}>
            Odds = payout multiplier from the current pool. Everyone settles at the final
            split at kickoff, so this can still move.
          </div>
        )}

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
          min={minBet} max={MAX_BET} step={50}
          value={amount}
          onChange={e => setAmount(Math.max(minBet, Number(e.target.value)))}
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
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>
              If {sideName} wins, you get
              {(() => { const o = sideOdds(pool, side, amount); return o ? ` · ~${fmtDecimalOdds(o)} at current pool` : ''; })()}
            </div>
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
          disabled={submitting || !bettingOpen || (existingPick === side) || amount < minBet}
          onClick={async () => {
            setSubmitting(true);
            try { await onConfirm({ matchId: match.id, pick: side, amount }); }
            catch { /* parent handles */ }
            finally { setSubmitting(false); }
          }}
        >
          {submitting ? 'Placing...' : !bettingOpen ? 'Betting closed' : (existingPick === side) ? 'Already placed — cancel to change' : amount < minBet ? `Min bet ${CURRENCY_SYMBOL}${minBet}` : `Place ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} bet`}
        </button>
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────
export function Toast({ message, onDone }) {
  const isError = message?.startsWith('Error');
  useEffect(() => {
    const t = setTimeout(onDone, isError ? 30000 : 2400);
    return () => clearTimeout(t);
  }, [onDone, isError]);
  return (
    <div className="toast" style={isError ? { borderColor: 'var(--loss)' } : undefined}>
      <span>{isError ? '✗' : '✓'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {isError && (
        <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}

// ── Bet card (My Bets screen) ────────────────────────────────
export function BetCard({ bet, onCancelBet, kickoffTs, cupWinnerDeadlineTs, poolData, allUsers = [], userId }) {
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
    const specialStyle = bet.status === 'won'
      ? { borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }
      : bet.status === 'lost'
      ? { borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)' }
      : undefined;
    return (
      <div className="bet-card" style={specialStyle}>
        <div className="bet-card__head">
          <span style={{ color: 'var(--gold)' }}>⭐ {
            bet.kind === 'cup_winner' ? 'Cup Winner' :
            bet.kind === 'continent' ? 'Continent' :
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
          <button onClick={() => onCancelBet(matchId)} className="bet-card__cancel">
            Cancel · Refund {fmtMoney(bet.amount)}
          </button>
        )}
      </div>
    );
  }

  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const pickedTeam = bet.pick === 'home' ? home : bet.pick === 'away' ? away : null;
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const canCancel = bet.status === 'pending' && bettingOpen && onCancelBet;

  const myOdds = poolData?.total > 0 ? sideOdds(poolData, bet.pick) : null;
  const potentialWin = myOdds ? Math.floor(bet.amount * myOdds.decimal) : 0;

  // Time to kickoff
  const kickoffMs = kickoffTs ? new Date(kickoffTs).getTime() : null;
  const msLeft = kickoffMs ? kickoffMs - Date.now() : null;
  let timeLabel = null;
  if (bet.status === 'pending' && msLeft && msLeft > 0) {
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    timeLabel = h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Card border color for resolved
  const cardStyle = bet.status === 'won'
    ? { borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }
    : bet.status === 'lost'
    ? { borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)' }
    : undefined;

  return (
    <div className="bet-card" style={cardStyle}>
      <div className="bet-card__head">
        <span>{match.group ? `Group ${match.group}` : 'Knockout'}{match.date ? ` · ${fmtDay(match.date)}` : ''}</span>
        {bet.status === 'pending' && timeLabel ? (
          <span className="bet-card__time">{timeLabel}</span>
        ) : (
          <span className={'bet-card__status ' + bet.status}>{bet.status}</span>
        )}
      </div>

      <div className="row between center">
        <div className="row center" style={{ gap: 8 }}>
          <Flag code={match.home} size="sm" />
          <span style={{ fontWeight: 500, fontSize: 13 }}>{home.code}</span>
          <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            {match.score ? `${match.score[0]}–${match.score[1]}` : 'v'}
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
        {bet.status === 'pending' && myOdds && (
          <div>
            <span>Odds</span>
            <span style={{ color: 'var(--ink-2)' }}>{fmtDecimalOdds(myOdds)}</span>
          </div>
        )}
      </div>


      {bet.status === 'pending' && kickoffMs && Date.now() >= kickoffMs && Date.now() < kickoffMs + 9000000 && (
        <WatchLive home={match.home} away={match.away} />
      )}

      {poolData && poolData.bets?.length > 0 && (
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} userId={userId} />
      )}

      {canCancel && (
        <button
          onClick={() => onCancelBet(bet.match_id || bet.matchId)}
          className="bet-card__cancel"
        >
          Cancel · Refund {fmtMoney(bet.amount)}
        </button>
      )}
    </div>
  );
}

