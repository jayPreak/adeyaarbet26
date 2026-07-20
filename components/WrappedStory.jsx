'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getMatch, getTeam, fmtKnockoutStage } from '@/lib/data';
import { fmtMoney, fmtNet } from '@/lib/currency';
import { getSpecial, getSpecialLabel } from '@/lib/specials';

const SLIDE_MS = 6000;

// Background music. Drop a file you own the rights to at public/wrapped-theme.mp3
// (e.g. the World Cup theme). If the file is missing, playback silently no-ops —
// the story still works, just without sound.
const AUDIO_SRC = '/wrapped-theme.mp3';

// ── Design system (from the Claude Design "AdeYaar Wrapped" kit) ──────────────
const MONO = `'SF Mono',ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace`;
const SANS = `-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif`;
const slideBg = (h) => `radial-gradient(125% 82% at 50% 2%, oklch(0.70 0.185 ${h}) 0%, oklch(0.395 0.13 ${h}) 44%, #08080c 82%)`;
const kickerCss = (h) => ({ font: `800 12.5px/1 ${SANS}`, letterSpacing: '0.22em', textTransform: 'uppercase', color: `oklch(0.87 0.095 ${h})` });
const VIGNETTE = 'radial-gradient(150% 55% at 50% 112%, rgba(0,0,0,0.55), transparent 62%)';

// Semantic hue per slide type — keeps colours meaningful even when a
// data-dependent slide is dropped (mirrors the kit's slide order).
const HUE = {
  intro: 300, bets: 262, staked: 190, biggestBet: 70, hitRate: 132,
  biggestWin: 165, roughestLoss: 26, favTeam: 275, duel: 350, specials: 315,
  rank: 92, net: 148, netNeg: 26, personality: 220, outro: 85,
};

// ─────────────────────────────────────────────────────────────────────────
// Stat computation — everything is derived client-side from the same data
// the rest of the app already holds (bets / challenges / settlement map).
// Excludes `_topup` admin rows and cancelled bets from user-facing tallies.
// ─────────────────────────────────────────────────────────────────────────
const SPECIAL_KINDS = new Set(['cup_winner', 'ko_cup_winner', 'continent', 'h2h', 'golden_boot',
  'goalscorer', 'scoreline', 'over_under', 'pens', 'final_four', 'total_goals',
  'r32_loser', 'r32_winner', 'third_place_qualifiers']);
const KIND_PILL = {
  cup_winner: 'CUP WINNER', ko_cup_winner: 'CUP WINNER', continent: 'CONTINENT',
  h2h: 'MESSI v RONALDO', golden_boot: 'GOLDEN BOOT', goalscorer: 'GOALSCORER',
  scoreline: 'EXACT SCORE', over_under: 'OVER/UNDER', pens: 'PENALTIES',
  final_four: 'FINAL FOUR', total_goals: 'TOTAL GOALS', r32_loser: 'KO FLOP',
  r32_winner: 'KO BAGHOLDER', third_place_qualifiers: '3RD PLACE',
};

function computeWrapped({ bets = [], allChallenges = [], settlementByUser = {}, allUsers = [], userId, getM }) {
  const real = bets.filter(b => b.match_id !== '_topup' && b.status !== 'cancelled');
  const settled = real.filter(b => b.status === 'won' || b.status === 'lost');

  const totalBets = real.length;
  const totalWagered = real.reduce((s, b) => s + (b.amount || 0), 0);

  let biggestBet = null;
  for (const b of real) if (!biggestBet || b.amount > biggestBet.amount) biggestBet = b;

  const wonCount = settled.filter(b => b.status === 'won').length;
  const winRate = settled.length ? Math.round((wonCount / settled.length) * 100) : 0;

  let biggestWin = null, biggestLoss = null;
  for (const b of real) {
    if (b.status === 'won') {
      const profit = (b.payout || 0) - b.amount;
      if (!biggestWin || profit > biggestWin.profit) biggestWin = { bet: b, profit };
    }
    if (b.status === 'lost') {
      if (!biggestLoss || b.amount > biggestLoss.amount) biggestLoss = b;
    }
  }

  const net = settlementByUser?.[userId] ?? 0;

  const teamCount = {};
  const bump = (code) => { if (code) teamCount[code] = (teamCount[code] || 0) + 1; };
  for (const b of real) {
    if (b.kind === 'match' || b.kind === 'penalty' || !b.kind) {
      const m = getM(b.match_id);
      if (m) { if (b.pick === 'home') bump(m.home); else if (b.pick === 'away') bump(m.away); }
    } else if (b.kind === 'cup_winner' || b.kind === 'ko_cup_winner') {
      bump(b.pick);
    }
  }
  let favTeam = null, favTeamN = 0;
  for (const [code, n] of Object.entries(teamCount)) if (n > favTeamN) { favTeam = code; favTeamN = n; }

  const specialsCount = real.filter(b => SPECIAL_KINDS.has(b.kind)).length;
  const specialPills = [...new Set(real.filter(b => SPECIAL_KINDS.has(b.kind)).map(b => KIND_PILL[b.kind]).filter(Boolean))].slice(0, 4);
  const distinctMatches = new Set(real.filter(b => b.kind === 'match' || b.kind === 'penalty' || !b.kind).map(b => b.match_id)).size;

  const myDuels = allChallenges.filter(c =>
    (c.challenger_id === userId || c.opponent_id === userId) && c.status === 'settled');
  const duelWins = myDuels.filter(c => c.winner_id === userId).length;
  const duelLosses = myDuels.filter(c => c.winner_id && c.winner_id !== userId).length;
  const duelTotal = duelWins + duelLosses;

  const ranking = Object.entries(settlementByUser || {})
    .map(([id, v]) => ({ id, net: v }))
    .sort((a, b) => b.net - a.net);
  const myRankIdx = ranking.findIndex(r => r.id === userId);
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : null;
  const totalPlayers = ranking.length || allUsers.length;

  let personality;
  if (net >= 2000) personality = { emoji: '🦈', title: 'The Shark', traits: ['VALUE HUNTER', 'PATIENT', 'RUTHLESS'], blurb: 'Cold, calculated, quietly lethal. You smell value and you strike.' };
  else if (winRate >= 60 && settled.length >= 5) personality = { emoji: '🔮', title: 'The Oracle', traits: ['SHARP READ', 'CLUTCH', 'UNCANNY'], blurb: 'You saw the results before they happened. Freakishly good reads.' };
  else if (totalBets >= 40) personality = { emoji: '🎰', title: 'The Degenerate', traits: ['HIGH VOLUME', 'NO FEAR', 'ALWAYS IN'], blurb: 'Never met a fixture you wouldn\'t bet on. Respect the volume.' };
  else if (net <= -1500) personality = { emoji: '🎁', title: 'The Philanthropist', traits: ['GENEROUS', 'OPTIMISTIC', 'BRAVE'], blurb: 'Someone had to fund the pool. That someone was you. Thank you.' };
  else if (biggestBet && biggestBet.amount >= 5000) personality = { emoji: '🤠', title: 'The High Roller', traits: ['BIG STAKES', 'BOLD', 'ALL-IN'], blurb: 'Small bets are for small dreams. You went big.' };
  else personality = { emoji: '⚽', title: 'The Regular', traits: ['STEADY', 'SOCIAL', 'TRUE FAN'], blurb: 'Steady, sensible, in it for the banter. A true friend of the game.' };

  return {
    totalBets, totalWagered, biggestBet, winRate, wonCount, settledCount: settled.length,
    biggestWin, biggestLoss, net, favTeam, favTeamN, specialsCount, specialPills, distinctMatches,
    duelWins, duelLosses, duelTotal, rank, totalPlayers, personality,
  };
}

// Short "what you picked" descriptor for win/loss slides.
function betPickText(bet, getM = getMatch) {
  if (!bet) return '';
  if (bet.kind === 'cup_winner' || bet.kind === 'ko_cup_winner') {
    const t = getTeam(bet.pick);
    return `${t?.name || bet.pick} to lift the trophy`;
  }
  const m = getM(bet.match_id);
  if (m && m.home && m.away) {
    if (bet.pick === 'home') return `${getTeam(m.home)?.name || m.home} to win`;
    if (bet.pick === 'away') return `${getTeam(m.away)?.name || m.away} to win`;
    if (bet.pick === 'draw') return 'The draw';
  }
  const sp = getSpecial(bet.kind);
  const lbl = getSpecialLabel(bet.match_id);
  const pick = sp?.formatPick ? sp.formatPick(bet.pick) : bet.pick;
  return lbl ? `${lbl}: ${pick}` : pick;
}

// Match descriptor for the bet-slip slide.
function slipInfo(bet, getM = getMatch) {
  if (!bet) return null;
  const m = getM(bet.match_id);
  if (m && m.home && m.away) {
    const h = getTeam(m.home), a = getTeam(m.away);
    const stage = fmtKnockoutStage(bet.match_id);
    return {
      flags: [h?.flag || '🏳️', a?.flag || '🏳️'],
      title: `${m.home} vs ${m.away}${stage ? ` · ${stage}` : ''}`,
    };
  }
  return { flags: null, title: getSpecialLabel(bet.match_id) || (bet.match_id || '').replace(/_/g, ' ') };
}

// ── Reusable slide primitives ────────────────────────────────────────────
function Kicker({ hue, children }) {
  return <div style={{ position: 'absolute', top: 2, left: 2 }}><span style={kickerCss(hue)}>{children}</span></div>;
}
function Caption({ children, center, dim, style }) {
  return (
    <div style={{
      position: 'absolute', bottom: 2, left: 2, right: 14,
      font: `500 18px/1.42 ${SANS}`, color: dim ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.92)',
      maxWidth: center ? 320 : 310, textAlign: center ? 'center' : 'left', textWrap: 'pretty', ...style,
    }}>{children}</div>
  );
}
function Confetti({ hues }) {
  return (
    <>
      {hues.map((h, i) => {
        const left = [12, 34, 58, 78, 24, 88][i % 6];
        const round = i % 2 === 0;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${left}%`, bottom: 0,
            width: round ? 8 : 7, height: round ? 8 : 13, borderRadius: round ? '50%' : 2,
            background: `oklch(0.87 0.19 ${h})`,
            animation: `wDrift ${4.2 + (i % 4) * 0.4}s linear ${(i * 0.4).toFixed(1)}s infinite`,
          }} />
        );
      })}
    </>
  );
}

export default function WrappedStory({ open, onClose, bets, matches = [], allChallenges = [], settlementByUser = {}, allUsers = [], user }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const holdTimer = useRef(null);
  const heldRef = useRef(false);
  const audioRef = useRef(null);

  const tryPlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !soundOn) return;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* awaiting gesture */ });
  }, [soundOn]);

  // Resolve any match id — including knockout/final ids that aren't in the
  // static getMatch() table but do exist in the live `matches` array.
  const getM = useMemo(() => {
    const byId = {};
    for (const m of matches) if (m?.id) byId[m.id] = m;
    return (id) => getMatch(id) || byId[id] || null;
  }, [matches]);

  const w = useMemo(
    () => computeWrapped({ bets, allChallenges, settlementByUser, allUsers, userId: user?.id, getM }),
    [bets, allChallenges, settlementByUser, allUsers, user?.id, getM]
  );

  const firstName = (user?.user_metadata?.name || user?.display_name || user?.email || 'You').split(' ')[0].split('@')[0];

  const slides = useMemo(() => {
    const s = [];

    // 01 · INTRO
    s.push({ hue: HUE.intro, stage: (
      <>
        <Confetti hues={[300, 330, 275, 300, 320, 300]} />
        <div style={{ position: 'absolute', left: 0, top: 6, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          <span style={kickerCss(HUE.intro)}>Your 2026 Wrapped</span>
        </div>
        <div style={{ position: 'absolute', top: 2, right: 6, fontSize: 92, lineHeight: 1, animation: 'wBob 3.4s ease-in-out infinite', filter: 'drop-shadow(0 12px 30px rgba(0,0,0,.4))' }}>🎁</div>
        <div style={{ position: 'absolute', left: 34, bottom: 104, animation: 'wRise .9s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ font: `800 62px/0.96 ${SANS}`, letterSpacing: '-0.03em', color: '#fff' }}>Hey,<br />{firstName}.</div>
        </div>
        <div style={{ position: 'absolute', left: 34, bottom: 8, right: 16, font: `500 18px/1.42 ${SANS}`, color: 'rgba(255,255,255,0.92)', maxWidth: 300, textWrap: 'pretty' }}>
          {w.distinctMatches} matches. {w.totalBets} bets. One glorious month of chaos — let&apos;s relive it. 👇
        </div>
      </>
    ) });

    // 02 · BETS PLACED — size the giant number to its digit count so 3+ digit
    // totals never clip against the frame edges.
    {
      const dg = String(w.totalBets).length;
      const numSize = dg >= 4 ? 150 : dg === 3 ? 210 : dg === 2 ? 300 : 340;
      s.push({ hue: HUE.bets, stage: (
        <>
          <Kicker hue={HUE.bets}>Bets Placed</Kicker>
          <div style={{ position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center', overflow: 'hidden' }}>
            <span style={{ display: 'inline-block', font: `900 ${numSize}px/0.82 ${MONO}`, letterSpacing: '-0.05em', transform: 'rotate(-8deg)', background: 'linear-gradient(100deg,#fff 25%, oklch(0.82 0.16 262) 50%, #fff 75%)', backgroundSize: '220% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', animation: 'wShimmer 4s linear infinite' }}>{w.totalBets}</span>
          </div>
          <div style={{ position: 'absolute', bottom: 74, left: 2, font: `800 32px/1 ${SANS}`, letterSpacing: '-0.01em', color: '#fff' }}>across {w.distinctMatches} matches</div>
          <Caption>Certified fixture-list menace. Not a single kickoff got past you.</Caption>
        </>
      ) });
    }

    // 03 · TOTAL STAKED
    s.push({ hue: HUE.staked, stage: (
      <>
        <div style={{ position: 'absolute', right: 2, top: -14, bottom: -14, font: `900 46px/1.35 ${MONO}`, color: 'rgba(255,255,255,0.07)', writingMode: 'vertical-rl', letterSpacing: 2 }}>₹₹₹₹₹₹₹₹₹₹₹₹</div>
        <div style={{ position: 'absolute', left: 14, right: 14, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, transform: 'rotate(-7deg)' }}>
          <div><span style={kickerCss(HUE.staked)}>Total Staked</span></div>
          <div style={{ font: `800 66px/0.9 ${MONO}`, letterSpacing: '-0.035em', color: '#fff' }}>{fmtMoney(w.totalWagered)}</div>
          <div style={{ font: `600 16px/1.4 ${SANS}`, color: 'rgba(255,255,255,0.75)' }}>spread over {w.totalBets} bets</div>
          <div style={{ font: `500 18px/1.42 ${SANS}`, color: '#fff', maxWidth: 290, textWrap: 'pretty' }}>That&apos;s a serious amount of chai money on the line. Bold.</div>
        </div>
      </>
    ) });

    // 04 · BIGGEST SINGLE BET
    if (w.biggestBet) {
      const info = slipInfo(w.biggestBet, getM);
      const settledBadge = w.biggestBet.status === 'won' || w.biggestBet.status === 'lost';
      s.push({ hue: HUE.biggestBet, stage: (
        <>
          <div style={{ position: 'absolute', top: 2, left: 2, zIndex: 3 }}><span style={kickerCss(HUE.biggestBet)}>Biggest Single Bet</span></div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-52%) rotate(-3deg)', width: 296, background: '#f5ecd6', borderRadius: 18, padding: '20px 22px 22px', boxShadow: '0 26px 50px -18px rgba(0,0,0,.6)', color: '#1c1405', animation: 'wSlip .8s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: `800 11px/1 ${MONO}`, letterSpacing: '.18em', color: '#8a6d1e' }}>BET SLIP</span>
              <span style={{ font: `800 10px/1 ${MONO}`, letterSpacing: '.06em', color: settledBadge ? '#166534' : '#8a6d1e' }}>● {settledBadge ? 'SETTLED' : 'PENDING'}</span>
            </div>
            <div style={{ textAlign: 'center', margin: '16px 0 6px' }}>
              {info.flags ? (
                <>
                  <span style={{ fontSize: 46 }}>{info.flags[0]}</span>
                  <span style={{ font: `800 20px/1 ${MONO}`, color: '#8a6d1e', margin: '0 10px', verticalAlign: 'middle' }}>vs</span>
                  <span style={{ fontSize: 46 }}>{info.flags[1]}</span>
                </>
              ) : <span style={{ fontSize: 40 }}>🎟️</span>}
            </div>
            <div style={{ textAlign: 'center', font: `800 14px/1.2 ${SANS}`, color: '#1c1405' }}>{info.title}</div>
            <div style={{ borderTop: '2px dashed #cbb987', margin: '16px 0' }} />
            <div style={{ font: `800 11px/1 ${MONO}`, letterSpacing: '.14em', color: '#8a6d1e' }}>STAKE</div>
            <div style={{ font: `800 60px/1 ${MONO}`, letterSpacing: '-.03em', color: '#1c1405', marginTop: 4 }}>{fmtMoney(w.biggestBet.amount)}</div>
            <div style={{ marginTop: 16, height: 32, background: 'repeating-linear-gradient(90deg,#1c1405 0 3px,transparent 3px 7px)' }} />
            <div style={{ position: 'absolute', left: -11, top: '50%', width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.5 0.13 70)' }} />
            <div style={{ position: 'absolute', right: -11, top: '50%', width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.5 0.13 70)' }} />
          </div>
          <div style={{ position: 'absolute', bottom: 2, left: 2, right: 14, font: `500 17px/1.4 ${SANS}`, color: 'rgba(255,255,255,0.92)', maxWidth: 300, textWrap: 'pretty' }}>No hedging. You backed your gut and went large.</div>
        </>
      ) });
    }

    // 05 · HIT RATE
    {
      const circ = 553;
      const off = Math.round(circ * (1 - w.winRate / 100));
      s.push({ hue: HUE.hitRate, stage: (
        <>
          <Kicker hue={HUE.hitRate}>Hit Rate</Kicker>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', width: 248, height: 248 }}>
            <svg width="248" height="248" viewBox="0 0 240 240" style={{ display: 'block' }}>
              <circle cx="120" cy="120" r="88" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="20" />
              <circle cx="120" cy="120" r="88" fill="none" stroke="oklch(0.85 0.2 132)" strokeWidth="20" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 120 120)" style={{ '--ring-off': off, animation: 'wRing 1.5s cubic-bezier(.2,.8,.2,1) both' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ font: `800 62px/1 ${MONO}`, letterSpacing: '-.03em', color: '#fff' }}>{w.winRate}%</div>
              <div style={{ font: `700 12px/1 ${MONO}`, letterSpacing: '.12em', color: 'oklch(0.85 0.16 132)', marginTop: 6 }}>{w.wonCount} / {w.settledCount} WON</div>
            </div>
          </div>
          <Caption center>{w.winRate >= 50 ? 'Better than a coin flip — and better than most of this group.' : 'Rough month at the office — the coin flip had a better year.'}</Caption>
        </>
      ) });
    }

    // 06 · BIGGEST WIN
    if (w.biggestWin) s.push({ hue: HUE.biggestWin, stage: (
      <>
        <Confetti hues={[158, 120, 150, 158, 132, 150]} />
        <Kicker hue={HUE.biggestWin}>Biggest Win</Kicker>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: '0 10px' }}>
          <div style={{ fontSize: 88, animation: 'wBob 3s ease-in-out infinite' }}>🤑</div>
          <div style={{ font: `800 68px/1 ${MONO}`, letterSpacing: '-.03em', background: 'linear-gradient(100deg,#eafff0 20%, oklch(0.88 0.2 158) 50%, #eafff0 80%)', backgroundSize: '220% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', animation: 'wShimmer 3.5s linear infinite, wPop .7s cubic-bezier(.2,.8,.2,1) both' }}>+{fmtMoney(w.biggestWin.profit)}</div>
          <div style={{ font: `600 16px/1.4 ${SANS}`, color: 'rgba(255,255,255,0.8)', maxWidth: 280 }}>{betPickText(w.biggestWin.bet, getM)}</div>
        </div>
        <Caption center>One glorious night. You called it — and cashed it.</Caption>
      </>
    ) });

    // 07 · ROUGHEST LOSS
    if (w.biggestLoss) s.push({ hue: HUE.roughestLoss, stage: (
      <>
        <div style={{ position: 'absolute', left: '20%', top: 0, fontSize: 15, animation: 'wFall 4.5s linear infinite' }}>💀</div>
        <div style={{ position: 'absolute', left: '60%', top: 0, fontSize: 12, animation: 'wFall 5.6s linear 1s infinite' }}>💀</div>
        <div style={{ position: 'absolute', left: '82%', top: 0, fontSize: 13, animation: 'wFall 5s linear .5s infinite' }}>💀</div>
        <Kicker hue={HUE.roughestLoss}>Roughest Loss</Kicker>
        <div style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', fontSize: 72, animation: 'wWobble 4s ease-in-out infinite' }}>💀</div>
        <div style={{ position: 'absolute', top: 196, left: 10, right: 10, textAlign: 'center' }}>
          <div style={{ font: `800 62px/1 ${MONO}`, letterSpacing: '-.03em', color: 'oklch(0.72 0.2 25)', transform: 'rotate(3deg)', animation: 'wShake 5s ease-in-out infinite' }}>−{fmtMoney(w.biggestLoss.amount)}</div>
          <div style={{ marginTop: 14, font: `600 15px/1.4 ${SANS}`, color: 'rgba(255,255,255,0.65)' }}>{betPickText(w.biggestLoss, getM)}</div>
        </div>
        <Caption center dim>We don&apos;t talk about that Tuesday. Ever.</Caption>
      </>
    ) });

    // 08 · RIDE-OR-DIE
    if (w.favTeam) {
      const t = getTeam(w.favTeam);
      const nm = (t?.name || w.favTeam).toUpperCase();
      s.push({ hue: HUE.favTeam, stage: (
        <>
          <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', fontSize: 150, lineHeight: 1, animation: 'wFloatC 4s ease-in-out infinite', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,.45))' }}>{t?.flag || '🏳️'}</div>
          <div style={{ position: 'absolute', top: 240, left: -20, right: -20, overflow: 'hidden', background: 'rgba(0,0,0,0.28)', padding: '10px 0', transform: 'rotate(-4deg)' }}>
            <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'wMarquee 12s linear infinite', font: `900 40px/1 ${SANS}`, letterSpacing: '.02em', color: '#fff' }}>
              <span>{`${nm} · `.repeat(3)}</span><span>{`${nm} · `.repeat(3)}</span>
            </div>
          </div>
          <div style={{ position: 'absolute', top: 34, right: 8, transform: 'rotate(11deg)', border: '3px solid oklch(0.85 0.18 275)', borderRadius: 12, padding: '6px 12px', font: `800 26px/1 ${MONO}`, color: 'oklch(0.88 0.16 275)' }}>×{w.favTeamN}</div>
          <Kicker hue={HUE.favTeam}>Ride-or-Die</Kicker>
          <div style={{ position: 'absolute', bottom: 56, left: 2, font: `700 16px/1.3 ${SANS}`, color: 'rgba(255,255,255,0.82)' }}>You backed them {w.favTeamN} time{w.favTeamN > 1 ? 's' : ''}.</div>
          <Caption>Loyalty like this belongs in a museum. Vamos.</Caption>
        </>
      ) });
    }

    // 09 · DUEL RECORD
    if (w.duelTotal > 0) s.push({ hue: HUE.duel, stage: (
      <>
        <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 0,100% 0,40% 100%,0 100%)', background: 'linear-gradient(150deg, oklch(0.5 0.16 150 / .5), transparent 70%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 22 }}>
          <div style={{ font: `800 12px/1 ${SANS}`, letterSpacing: '.2em', color: 'oklch(0.86 0.16 150)' }}>WON</div>
          <div style={{ font: `900 150px/.82 ${MONO}`, color: '#fff' }}>{w.duelWins}</div>
        </div>
        <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(100% 0,100% 100%,44% 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 22 }}>
          <div style={{ font: `800 12px/1 ${SANS}`, letterSpacing: '.2em', color: 'oklch(0.8 0.16 25)' }}>LOST</div>
          <div style={{ font: `900 120px/.82 ${MONO}`, color: 'rgba(255,255,255,0.82)' }}>{w.duelLosses}</div>
        </div>
        <div style={{ position: 'absolute', top: -30, bottom: -30, left: '50%', width: 3, background: 'rgba(255,255,255,.22)', transform: 'rotate(22deg)' }} />
        <div style={{ position: 'absolute', top: '44%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 52, filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.55))' }}>⚔️</div>
        <Kicker hue={HUE.duel}>1v1 Duel Record</Kicker>
        <Caption center>{w.duelWins >= w.duelLosses ? 'You talk a big game — turns out you can back it up.' : 'They edged the head-to-head. Rematch next tournament.'}</Caption>
      </>
    ) });

    // 10 · SPECIAL BETS
    if (w.specialsCount > 0) {
      const pillPos = [
        { top: 96, left: 14, rot: -6, delay: 0 },
        { top: 120, right: 12, rot: 5, delay: 0.6 },
        { bottom: 118, left: 20, rot: 4, delay: 0.9 },
        { bottom: 96, right: 18, rot: -5, delay: 0.2 },
      ];
      s.push({ hue: HUE.specials, stage: (
        <>
          {[[6, 8, 22], [12, null, 16], [null, 12, 14], [null, 14, 20]].map((p, i) => (
            <div key={i} style={{ position: 'absolute', ...(p[0] != null ? { top: `${p[0]}%` } : { bottom: [null, null, 22, 30][i] + '%' }), ...(i % 2 === 0 ? { left: `${[8, 0, 12, 0][i]}%` } : { right: `${[0, 10, 0, 14][i]}%` }), fontSize: p[2], animation: `wFloat ${3.6 + i * 0.3}s ease-in-out ${i * 0.35}s infinite` }}>✨</div>
          ))}
          <Kicker hue={HUE.specials}>Special Bets</Kicker>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-52%)', font: `900 150px/1 ${MONO}`, letterSpacing: '-.04em', color: '#fff', animation: 'wPulse 3s ease-in-out infinite' }}>{w.specialsCount}</div>
          {w.specialPills.map((label, i) => {
            const p = pillPos[i];
            return (
              <div key={label} style={{ position: 'absolute', ...(p.top != null ? { top: p.top } : { bottom: p.bottom }), ...(p.left != null ? { left: p.left } : { right: p.right }), transform: `rotate(${p.rot}deg)`, padding: '7px 12px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.2)', font: `800 11px/1 ${MONO}`, letterSpacing: '.06em', color: '#fff', animation: `wFloat ${4 + i * 0.2}s ease-in-out ${p.delay}s infinite` }}>{label}</div>
            );
          })}
          <Caption center>Big swings only. Exact scorelines? You actually tried those.</Caption>
        </>
      ) });
    }

    // 11 · FINISHING RANK
    {
      const isYou = (n) => w.rank === n;
      const bar = (label, h, highlight) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: highlight ? 6 : 8 }}>
          {label === 1 && <div style={{ fontSize: 22 }}>👑</div>}
          <div style={{
            width: 66, height: h, borderRadius: '10px 10px 0 0',
            background: highlight ? 'oklch(0.6 0.16 92)' : 'rgba(255,255,255,0.14)',
            boxShadow: highlight ? '0 0 28px oklch(0.6 0.16 92 / .55)' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8,
          }}>
            <span style={{ font: `800 20px/1 ${MONO}`, color: highlight ? '#1c1602' : 'rgba(255,255,255,0.7)' }}>{label}</span>
            {highlight && <span style={{ font: `800 9px/1 ${SANS}`, letterSpacing: '.08em', color: '#1c1602', marginTop: 4 }}>YOU</span>}
          </div>
        </div>
      );
      s.push({ hue: HUE.rank, stage: (
        <>
          <Kicker hue={HUE.rank}>Finishing Rank</Kicker>
          <div style={{ position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ font: `900 150px/.82 ${MONO}`, color: '#fff', letterSpacing: '-.04em' }}>#{w.rank || '—'}</div>
            <div style={{ font: `800 13px/1 ${SANS}`, letterSpacing: '.16em', color: 'oklch(0.86 0.16 92)', marginTop: 6 }}>OF {w.totalPlayers} PLAYERS</div>
          </div>
          <div style={{ position: 'absolute', bottom: 44, left: 0, right: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10 }}>
            {bar(2, 96, isYou(2))}
            {bar(1, 128, isYou(1))}
            {bar(3, 64, isYou(3) || (w.rank > 3))}
          </div>
          <div style={{ position: 'absolute', bottom: 42, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.18)' }} />
        </>
      ), foot: 'rank' });
    }

    // 12 · THE BOTTOM LINE (net)
    {
      const positive = w.net >= 0;
      const hue = positive ? HUE.net : HUE.netNeg;
      const lineColor = positive ? 'oklch(0.82 0.19 148)' : 'oklch(0.72 0.2 25)';
      const pts = positive ? '0,185 55,150 110,168 165,95 225,120 320,18' : '0,40 55,80 110,70 165,120 225,110 320,182';
      s.push({ hue, stage: (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, top: 150 }}>
            <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
              <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="640" strokeDashoffset="640" style={{ animation: 'wDraw 1.8s ease-out .3s both' }} />
            </svg>
          </div>
          <Kicker hue={hue}>The Bottom Line</Kicker>
          <div style={{ position: 'absolute', top: 58, left: 2 }}>
            <div style={{ font: `800 13px/1 ${SANS}`, letterSpacing: '.14em', color: positive ? 'oklch(0.85 0.16 148)' : 'oklch(0.8 0.16 25)' }}>{positive ? 'NET PROFIT ↗' : 'NET LOSS ↘'}</div>
            <div style={{ font: `800 70px/1 ${MONO}`, letterSpacing: '-.035em', color: '#fff', marginTop: 8, textShadow: `0 0 30px ${positive ? 'oklch(0.7 0.2 148 / .4)' : 'oklch(0.6 0.2 25 / .4)'}` }}>{fmtNet(w.net)}</div>
          </div>
          <Caption>{positive ? 'You beat the pool. Someone else is buying dinner this time.' : 'The pool ate well this year — funded partly by you. It happens.'}</Caption>
        </>
      ) });
    }

    // 13 · BETTING PERSONA
    s.push({ hue: HUE.personality, stage: (
      <>
        <div style={{ position: 'absolute', top: 30, left: '50%', fontSize: 130, lineHeight: 1, animation: 'wSwim 5s ease-in-out infinite', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,.45))' }}>{w.personality.emoji}</div>
        <Kicker hue={HUE.personality}>Your Betting Persona</Kicker>
        <div style={{ position: 'absolute', top: 214, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ font: `800 48px/1 ${SANS}`, letterSpacing: '-.02em', color: '#fff' }}>{w.personality.title}</div>
        </div>
        <div style={{ position: 'absolute', top: 290, left: 0, right: 0, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '0 20px' }}>
          {w.personality.traits.map(tr => (
            <span key={tr} style={{ padding: '7px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', font: `800 11px/1 ${MONO}`, letterSpacing: '.06em', color: '#fff' }}>{tr}</span>
          ))}
        </div>
        <Caption center>{w.personality.blurb}</Caption>
      </>
    ) });

    // 14 · OUTRO
    s.push({ hue: HUE.outro, stage: (
      <>
        <Confetti hues={[85, 300, 160, 40, 200, 340]} />
        <div style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', fontSize: 84, animation: 'wBobC 3s ease-in-out infinite', filter: 'drop-shadow(0 12px 30px rgba(0,0,0,.4))' }}>🏆</div>
        <div style={{ position: 'absolute', top: 184, left: 0, right: 0, textAlign: 'center' }}>
          <div><span style={kickerCss(HUE.outro)}>That&apos;s a Wrap</span></div>
          <div style={{ font: `800 42px/1.04 ${SANS}`, letterSpacing: '-.02em', color: '#fff', marginTop: 14 }}>That&apos;s a wrap,<br />{firstName}.</div>
        </div>
        <Caption center>See you next tournament. Bring the trash talk. 💬</Caption>
      </>
    ), foot: 'outro' });

    return s;
  }, [w, firstName]);

  const count = slides.length;
  const next = useCallback(() => setIndex(i => (i >= count - 1 ? i : i + 1)), [count]);
  const prev = useCallback(() => setIndex(i => (i <= 0 ? 0 : i - 1)), []);

  useEffect(() => { if (open) { setIndex(0); setPaused(false); } }, [open]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (open && soundOn) tryPlay();
    else { a.pause(); if (!open) { try { a.currentTime = 0; } catch { /* ignore */ } } }
  }, [open, soundOn, tryPlay]);

  useEffect(() => {
    if (!open || paused) return;
    if (index >= count - 1) return;
    const t = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(t);
  }, [open, paused, index, count, next]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev, onClose]);

  if (!open) return null;

  const onDown = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
      if (audioRef.current) audioRef.current.pause();
    }, 250);
  };
  const onUp = (zone) => {
    clearTimeout(holdTimer.current);
    if (heldRef.current) { setPaused(false); heldRef.current = false; tryPlay(); return; }
    if (soundOn && audioRef.current?.paused) tryPlay();
    zone === 'prev' ? prev() : next();
  };

  const current = slides[index];
  const nn = String(index + 1).padStart(2, '0');
  const total = String(count).padStart(2, '0');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', color: '#fff', display: 'flex', justifyContent: 'center', overscrollBehavior: 'contain' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100%', overflow: 'hidden', background: '#08080c' }}>
        <audio ref={audioRef} src={AUDIO_SRC} loop preload="auto" />

        {/* Per-slide gradient + vignette */}
        <div style={{ position: 'absolute', inset: 0, background: slideBg(current.hue), transition: 'background 0.5s ease' }} />
        <div style={{ position: 'absolute', inset: 0, background: VIGNETTE, pointerEvents: 'none' }} />

        {/* Foreground column */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 22px 24px' }}>
          {/* Progress segments */}
          <div style={{ display: 'flex', gap: 4, padding: '0 2px' }}>
            {slides.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.26)', overflow: 'hidden' }}>
                <div key={`${i}-${index}-${paused}`} style={{
                  height: '100%', background: '#fff', borderRadius: 3,
                  width: i < index ? '100%' : i === index ? '100%' : '0%',
                  animation: i === index && index < count - 1 ? `wFill ${SLIDE_MS}ms linear forwards` : 'none',
                  animationPlayState: paused ? 'paused' : 'running',
                }} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚽</div>
              <span style={{ font: `800 12px/1 ${SANS}`, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.9)' }}>ADEYAAR WRAPPED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setSoundOn(s => !s)} aria-label={soundOn ? 'Mute music' : 'Unmute music'} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>{soundOn ? '🔊' : '🔇'}</button>
              <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 19, cursor: 'pointer', lineHeight: 1, paddingBottom: 2 }}>×</button>
            </div>
          </div>

          {/* Stage */}
          <div key={index} style={{ position: 'relative', flex: 1, overflow: 'hidden', marginTop: 14, animation: 'wIn 0.5s cubic-bezier(0.22,1,0.36,1)' }}>
            {current.stage}
          </div>

          {/* Footer */}
          {current.foot === 'outro' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
              <button onClick={onClose} style={{ height: 54, borderRadius: 27, background: '#fff', border: 'none', font: `800 16px/1 ${SANS}`, color: '#141414', cursor: 'pointer' }}>Done</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: `600 11.5px/1 ${MONO}`, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', marginTop: current.foot === 'rank' ? 12 : 8 }}>
              <span>{nn} / {total}</span>
              <span>TAP TO CONTINUE →</span>
            </div>
          )}
        </div>

        {/* Tap zones (below content chrome, above gradient) */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3 }}>
          <div style={{ width: '32%' }} onPointerDown={onDown} onPointerUp={() => onUp('prev')} onPointerLeave={() => clearTimeout(holdTimer.current)} />
          <div style={{ width: '68%' }} onPointerDown={onDown} onPointerUp={() => onUp('next')} onPointerLeave={() => clearTimeout(holdTimer.current)} />
        </div>
      </div>

      <style>{`
        @keyframes wFill { from { width: 0%; } to { width: 100%; } }
        @keyframes wIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes wBob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-14px) rotate(3deg); } }
        @keyframes wBobC { 0%,100% { transform: translateX(-50%) translateY(0) rotate(-3deg); } 50% { transform: translateX(-50%) translateY(-14px) rotate(3deg); } }
        @keyframes wFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes wFloatC { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-14px); } }
        @keyframes wPulse { 0%,100% { opacity: .9; transform: translate(-50%,-52%) scale(1); } 50% { opacity: 1; transform: translate(-50%,-52%) scale(1.05); } }
        @keyframes wDrift { 0% { transform: translateY(20px) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(-190px) rotate(160deg); opacity: 0; } }
        @keyframes wFall { 0% { transform: translateY(-40px) rotate(0); opacity: 0; } 12% { opacity: .85; } 100% { transform: translateY(200px) rotate(120deg); opacity: 0; } }
        @keyframes wMarquee { to { transform: translateX(-50%); } }
        @keyframes wShimmer { to { background-position: 220% center; } }
        @keyframes wShake { 0%,100% { transform: rotate(3deg) translateX(0); } 25% { transform: rotate(1deg) translateX(-6px); } 75% { transform: rotate(5deg) translateX(6px); } }
        @keyframes wSwim { 0%,100% { transform: translateX(-50%) translateX(-22px) rotate(-6deg); } 50% { transform: translateX(-50%) translateX(22px) rotate(6deg); } }
        @keyframes wPop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes wRise { 0% { transform: translateY(46px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes wSlip { 0% { transform: translate(-50%,calc(-52% + 46px)) rotate(-3deg); opacity: 0; } 100% { transform: translate(-50%,-52%) rotate(-3deg); opacity: 1; } }
        @keyframes wRing { from { stroke-dashoffset: 553; } to { stroke-dashoffset: var(--ring-off, 232); } }
        @keyframes wDraw { from { stroke-dashoffset: 640; } to { stroke-dashoffset: 0; } }
        @keyframes wWobble { 0%,100% { transform: translateX(-50%) rotate(-4deg); } 50% { transform: translateX(-50%) rotate(4deg); } }
      `}</style>
    </div>
  );
}
