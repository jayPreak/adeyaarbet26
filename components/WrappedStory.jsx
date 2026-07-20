'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getMatch, getTeam } from '@/lib/data';
import { fmtMoney, fmtNet, CURRENCY_SYMBOL } from '@/lib/currency';

const SLIDE_MS = 6000;

// Background music. Drop a file you own the rights to at public/wrapped-theme.mp3
// (e.g. the World Cup theme). If the file is missing, playback silently no-ops —
// the story still works, just without sound.
const AUDIO_SRC = '/wrapped-theme.mp3';

// ─────────────────────────────────────────────────────────────────────────
// Stat computation — everything is derived client-side from the same data
// the rest of the app already holds (bets / challenges / settlement map).
// Excludes `_topup` admin rows and cancelled bets from user-facing tallies.
// ─────────────────────────────────────────────────────────────────────────
function computeWrapped({ bets = [], allChallenges = [], settlementByUser = {}, allUsers = [], userId }) {
  const real = bets.filter(b => b.match_id !== '_topup' && b.status !== 'cancelled');
  const settled = real.filter(b => b.status === 'won' || b.status === 'lost');

  const totalBets = real.length;
  const totalWagered = real.reduce((s, b) => s + (b.amount || 0), 0);

  // Biggest single stake
  let biggestBet = null;
  for (const b of real) if (!biggestBet || b.amount > biggestBet.amount) biggestBet = b;

  // Win rate
  const wonCount = settled.filter(b => b.status === 'won').length;
  const winRate = settled.length ? Math.round((wonCount / settled.length) * 100) : 0;

  // Biggest win (profit) + roughest loss (stake)
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

  // Net result — the settlement-normalized number (matches real payout)
  const net = settlementByUser?.[userId] ?? 0;

  // Favorite team — resolve every money bet to a team code where possible
  const teamCount = {};
  const bump = (code) => { if (code) teamCount[code] = (teamCount[code] || 0) + 1; };
  for (const b of real) {
    if (b.kind === 'match' || b.kind === 'penalty' || !b.kind) {
      const m = getMatch(b.match_id);
      if (m) {
        if (b.pick === 'home') bump(m.home);
        else if (b.pick === 'away') bump(m.away);
      }
    } else if (b.kind === 'cup_winner' || b.kind === 'ko_cup_winner') {
      bump(b.pick);
    }
  }
  let favTeam = null, favTeamN = 0;
  for (const [code, n] of Object.entries(teamCount)) if (n > favTeamN) { favTeam = code; favTeamN = n; }

  // Specials dabbled in
  const SPECIAL_KINDS = new Set(['cup_winner', 'ko_cup_winner', 'continent', 'h2h', 'golden_boot',
    'goalscorer', 'scoreline', 'over_under', 'pens', 'final_four', 'total_goals',
    'r32_loser', 'r32_winner', 'third_place_qualifiers']);
  const specialsCount = real.filter(b => SPECIAL_KINDS.has(b.kind)).length;
  const distinctMatches = new Set(real.filter(b => b.kind === 'match' || b.kind === 'penalty' || !b.kind).map(b => b.match_id)).size;

  // Duels
  const myDuels = allChallenges.filter(c =>
    (c.challenger_id === userId || c.opponent_id === userId) && c.status === 'settled');
  const duelWins = myDuels.filter(c => c.winner_id === userId).length;
  const duelLosses = myDuels.filter(c => c.winner_id && c.winner_id !== userId).length;
  const duelTotal = duelWins + duelLosses;

  // Rank among friends (by net settlement)
  const ranking = Object.entries(settlementByUser || {})
    .map(([id, v]) => ({ id, net: v }))
    .sort((a, b) => b.net - a.net);
  const myRankIdx = ranking.findIndex(r => r.id === userId);
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : null;
  const totalPlayers = ranking.length || allUsers.length;
  const nameOf = (id) => {
    const u = allUsers.find(u => u.id === id);
    return u?.display_name || u?.username || 'Someone';
  };

  // Personality
  let personality;
  if (net >= 2000) personality = { emoji: '🦈', title: 'The Shark', blurb: 'You came, you saw, you cashed out. The pool feared you.' };
  else if (winRate >= 60 && settled.length >= 5) personality = { emoji: '🔮', title: 'The Oracle', blurb: 'You saw the results before they happened. Freakishly good reads.' };
  else if (totalBets >= 40) personality = { emoji: '🎰', title: 'The Degenerate', blurb: 'Never met a match you wouldn\'t bet on. Respect the volume.' };
  else if (net <= -1500) personality = { emoji: '🎁', title: 'The Philanthropist', blurb: 'Someone had to fund the pool. That someone was you. Thank you.' };
  else if (biggestBet && biggestBet.amount >= 5000) personality = { emoji: '🤠', title: 'The High Roller', blurb: 'Small bets are for small dreams. You went big.' };
  else personality = { emoji: '⚽', title: 'The Regular', blurb: 'Steady, sensible, in it for the banter. A true friend of the game.' };

  return {
    totalBets, totalWagered, biggestBet, winRate, wonCount, settledCount: settled.length,
    biggestWin, biggestLoss, net, favTeam, favTeamN, specialsCount, distinctMatches,
    duelWins, duelLosses, duelTotal, rank, totalPlayers, ranking, nameOf, personality,
  };
}

function labelFor(bet) {
  if (!bet) return '';
  const m = getMatch(bet.match_id);
  if (m && m.home && m.away) {
    const h = getTeam(m.home), a = getTeam(m.away);
    return `${h?.flag || ''} ${h?.name || m.home} vs ${a?.flag || ''} ${a?.name || m.away}`;
  }
  return bet.match_id?.replace(/_/g, ' ') || '';
}

// ─────────────────────────────────────────────────────────────────────────
// Slide primitives
// ─────────────────────────────────────────────────────────────────────────
function Big({ children }) {
  return <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>{children}</div>;
}
function Kicker({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.75, marginBottom: 14 }}>{children}</div>;
}
function Sub({ children, dim }) {
  return <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45, marginTop: 18, opacity: dim ? 0.72 : 0.95, maxWidth: 300 }}>{children}</div>;
}

export default function WrappedStory({ open, onClose, bets, allChallenges = [], settlementByUser = {}, allUsers = [], user }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const holdTimer = useRef(null);
  const heldRef = useRef(false);
  const audioRef = useRef(null);

  // Best-effort play — browsers block autoplay-with-sound until a user gesture,
  // but the story is opened BY a tap (the Home banner), so the first play()
  // usually lands. If it's rejected we retry on the next tap (see onUp).
  const tryPlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !soundOn) return;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* awaiting gesture */ });
  }, [soundOn]);

  const w = useMemo(
    () => computeWrapped({ bets, allChallenges, settlementByUser, allUsers, userId: user?.id }),
    [bets, allChallenges, settlementByUser, allUsers, user?.id]
  );

  const firstName = (user?.user_metadata?.name || user?.display_name || user?.email || 'You').split(' ')[0].split('@')[0];

  // Build slides. Each: { bg, node }. Conditional slides (duels / fav team)
  // only appear when there's real data — core deck still exceeds 10 slides.
  const slides = useMemo(() => {
    const s = [];
    s.push({
      bg: 'linear-gradient(160deg,#1db954 0%,#0a5c2b 100%)',
      node: (
        <div>
          <div style={{ fontSize: 60, marginBottom: 8 }}>🎁</div>
          <Kicker>AdeYaar '26</Kicker>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em' }}>Your<br />World Cup<br />Wrapped</div>
          <Sub>{firstName}, the tournament's done. Let's replay your season. 👇</Sub>
        </div>
      ),
    });
    s.push({
      bg: 'linear-gradient(160deg,#8b5cf6 0%,#3b0764 100%)',
      node: (
        <div>
          <Kicker>You placed</Kicker>
          <Big>{w.totalBets}</Big>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>bets this tournament</div>
          <Sub dim>{w.distinctMatches} different matches got your money. Some braver than others.</Sub>
        </div>
      ),
    });
    s.push({
      bg: 'linear-gradient(160deg,#f59e0b 0%,#7c2d12 100%)',
      node: (
        <div>
          <Kicker>Total staked</Kicker>
          <Big>{fmtMoney(w.totalWagered)}</Big>
          <Sub dim>That's how much you pushed across the felt. Bold moves only.</Sub>
        </div>
      ),
    });
    if (w.biggestBet) s.push({
      bg: 'linear-gradient(160deg,#ef4444 0%,#5b1212 100%)',
      node: (
        <div>
          <Kicker>Your biggest single bet</Kicker>
          <Big>{fmtMoney(w.biggestBet.amount)}</Big>
          <Sub>on <b>{labelFor(w.biggestBet)}</b></Sub>
          <Sub dim>Deep breath. Big stake. No regrets. (Probably.)</Sub>
        </div>
      ),
    });
    s.push({
      bg: 'linear-gradient(160deg,#06b6d4 0%,#0e3a4a 100%)',
      node: (
        <div>
          <Kicker>Your hit rate</Kicker>
          <Big>{w.winRate}%</Big>
          <Sub>{w.wonCount} wins from {w.settledCount} settled bets</Sub>
          <Sub dim>{w.winRate >= 50 ? 'More right than wrong. Certified read merchant.' : 'The house always... wait, there is no house. You just called it wrong a lot.'}</Sub>
        </div>
      ),
    });
    if (w.biggestWin) s.push({
      bg: 'linear-gradient(160deg,#22c55e 0%,#14532d 100%)',
      node: (
        <div>
          <div style={{ fontSize: 48, marginBottom: 6 }}>🤑</div>
          <Kicker>Biggest win</Kicker>
          <Big>+{fmtMoney(w.biggestWin.profit)}</Big>
          <Sub>off <b>{labelFor(w.biggestWin.bet)}</b></Sub>
          <Sub dim>You still talk about this one, don't you?</Sub>
        </div>
      ),
    });
    if (w.biggestLoss) s.push({
      bg: 'linear-gradient(160deg,#64748b 0%,#1e293b 100%)',
      node: (
        <div>
          <div style={{ fontSize: 48, marginBottom: 6 }}>💀</div>
          <Kicker>Roughest loss</Kicker>
          <Big>−{fmtMoney(w.biggestLoss.amount)}</Big>
          <Sub>on <b>{labelFor(w.biggestLoss)}</b></Sub>
          <Sub dim>We don't talk about this one.</Sub>
        </div>
      ),
    });
    if (w.favTeam) {
      const t = getTeam(w.favTeam);
      s.push({
        bg: 'linear-gradient(160deg,#ec4899 0%,#500724 100%)',
        node: (
          <div>
            <Kicker>Your ride-or-die</Kicker>
            <div style={{ fontSize: 88, lineHeight: 1 }}>{t?.flag || '🏳️'}</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginTop: 10 }}>{t?.name || w.favTeam}</div>
            <Sub dim>You backed them {w.favTeamN} time{w.favTeamN > 1 ? 's' : ''}. Loyalty like no other.</Sub>
          </div>
        ),
      });
    }
    if (w.duelTotal > 0) s.push({
      bg: 'linear-gradient(160deg,#0ea5e9 0%,#0c2f4a 100%)',
      node: (
        <div>
          <div style={{ fontSize: 48, marginBottom: 6 }}>⚔️</div>
          <Kicker>1v1 duels</Kicker>
          <Big>{w.duelWins}–{w.duelLosses}</Big>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>W–L against your friends</div>
          <Sub dim>{w.duelWins > w.duelLosses ? 'You won the head-to-head bragging rights. Never let them forget.' : w.duelWins === w.duelLosses ? 'Dead even. A rivalry for the ages.' : 'They got you this time. Rematch next tournament?'}</Sub>
        </div>
      ),
    });
    if (w.specialsCount > 0) s.push({
      bg: 'linear-gradient(160deg,#a855f7 0%,#2e1065 100%)',
      node: (
        <div>
          <div style={{ fontSize: 48, marginBottom: 6 }}>✨</div>
          <Kicker>Beyond the match line</Kicker>
          <Big>{w.specialsCount}</Big>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>special bets placed</div>
          <Sub dim>Cup winners, scorelines, over/unders, prop bets — you played the whole board.</Sub>
        </div>
      ),
    });
    // Rank
    const topName = w.ranking[0] ? w.nameOf(w.ranking[0].id) : null;
    s.push({
      bg: 'linear-gradient(160deg,#eab308 0%,#713f12 100%)',
      node: (
        <div>
          <div style={{ fontSize: 48, marginBottom: 6 }}>{w.rank === 1 ? '👑' : '📊'}</div>
          <Kicker>Where you finished</Kicker>
          <Big>{w.rank ? `#${w.rank}` : '—'}</Big>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>of {w.totalPlayers} players</div>
          <Sub dim>{w.rank === 1 ? 'Top of the table. The undisputed champ. 👑' : topName ? `${topName} took the crown this time — but there's always next tournament.` : 'Every bet counted.'}</Sub>
        </div>
      ),
    });
    // Net headline
    const positive = w.net >= 0;
    s.push({
      bg: positive ? 'linear-gradient(160deg,#16a34a 0%,#052e16 100%)' : 'linear-gradient(160deg,#dc2626 0%,#450a0a 100%)',
      node: (
        <div>
          <Kicker>Your bottom line</Kicker>
          <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{fmtNet(w.net)}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{positive ? 'in profit 🟢' : 'in the red 🔴'}</div>
          <Sub dim>{positive ? 'Real money, real bragging rights. Collect what you\'re owed.' : 'It\'s only money. And it\'s going to your friends. Some of it.'}</Sub>
        </div>
      ),
    });
    // Personality
    s.push({
      bg: 'linear-gradient(160deg,#1db954 0%,#111 100%)',
      node: (
        <div>
          <Kicker>Your betting personality</Kicker>
          <div style={{ fontSize: 82, lineHeight: 1 }}>{w.personality.emoji}</div>
          <div style={{ fontSize: 38, fontWeight: 900, marginTop: 10, letterSpacing: '-0.02em' }}>{w.personality.title}</div>
          <Sub dim>{w.personality.blurb}</Sub>
        </div>
      ),
    });
    // Outro
    s.push({
      bg: 'linear-gradient(160deg,#000 0%,#1db954 130%)',
      node: (
        <div>
          <div style={{ fontSize: 54, marginBottom: 10 }}>🏆</div>
          <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em' }}>That's a wrap,<br />{firstName}.</div>
          <Sub dim>Thanks for playing AdeYaar '26. See you at the next World Cup — bring your wallet.</Sub>
          <button
            onClick={onClose}
            style={{ marginTop: 26, padding: '13px 26px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: '#fff', color: '#000', fontSize: 15, fontWeight: 800 }}
          >
            Done
          </button>
        </div>
      ),
    });
    return s;
  }, [w, firstName, onClose]);

  const count = slides.length;

  const next = useCallback(() => setIndex(i => (i >= count - 1 ? i : i + 1)), [count]);
  const prev = useCallback(() => setIndex(i => (i <= 0 ? 0 : i - 1)), []);

  // Reset to first slide whenever the story is (re)opened
  useEffect(() => { if (open) { setIndex(0); setPaused(false); } }, [open]);

  // Music lifecycle: play while open + sound on, pause/rewind on close or mute.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (open && soundOn) {
      tryPlay();
    } else {
      a.pause();
      if (!open) { try { a.currentTime = 0; } catch { /* ignore */ } }
    }
  }, [open, soundOn, tryPlay]);

  // Auto-advance
  useEffect(() => {
    if (!open || paused) return;
    if (index >= count - 1) return; // hold on final slide
    const t = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(t);
  }, [open, paused, index, count, next]);

  // Keyboard nav
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
    // Autoplay fallback: if the initial play() was blocked, this tap is a fresh
    // gesture — try again so sound kicks in by slide 2 at the latest.
    if (soundOn && audioRef.current?.paused) tryPlay();
    zone === 'prev' ? prev() : next();
  };

  const current = slides[index];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000', color: '#fff',
        display: 'flex', justifyContent: 'center',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', overflow: 'hidden', background: current.bg, transition: 'background 0.5s ease' }}>
        {/* Background music (loops). File is user-supplied — see AUDIO_SRC note. */}
        <audio ref={audioRef} src={AUDIO_SRC} loop preload="auto" />

        {/* Progress bars */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', gap: 4, padding: '10px 12px 0', zIndex: 5 }}>
          {slides.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
              <div
                key={`${i}-${index}-${paused}`}
                style={{
                  height: '100%', background: '#fff', borderRadius: 3,
                  width: i < index ? '100%' : i === index ? '100%' : '0%',
                  animation: i === index && !(index >= count - 1) ? `wrappedFill ${SLIDE_MS}ms linear forwards` : 'none',
                  animationPlayState: paused ? 'paused' : 'running',
                  transformOrigin: 'left',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header row */}
        <div style={{ position: 'absolute', top: 22, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.9 }}>AdeYaar Wrapped</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setSoundOn(s => !s)} aria-label={soundOn ? 'Mute music' : 'Unmute music'}
              style={{ background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>
              {soundOn ? '🔊' : '🔇'}
            </button>
            <button onClick={onClose} aria-label="Close"
              style={{ background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Tap zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3 }}>
          <div style={{ width: '32%' }} onPointerDown={onDown} onPointerUp={() => onUp('prev')} onPointerLeave={() => clearTimeout(holdTimer.current)} />
          <div style={{ width: '68%' }} onPointerDown={onDown} onPointerUp={() => onUp('next')} onPointerLeave={() => clearTimeout(holdTimer.current)} />
        </div>

        {/* Slide content */}
        <div
          key={index}
          style={{
            position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 30px', animation: 'wrappedIn 0.5s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>{current.node}</div>
        </div>
      </div>

      <style>{`
        @keyframes wrappedFill { from { width: 0%; } to { width: 100%; } }
        @keyframes wrappedIn { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
