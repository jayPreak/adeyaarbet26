'use client';

// Live match chat — reads + sends via wss://chat.cdn-lab.shop.
// Isolated so any runtime error is caught locally (see ChatErrorBoundary at bottom).
//
// Layout:
//   ┌────────────────────────────┐
//   │ [status] [viewers]         │
//   ├────────────────────────────┤
//   │ compose / register input   │   (ABOVE the message list)
//   ├────────────────────────────┤
//   │ NEWEST message             │   (reverse-chronological — no scroll needed)
//   │ …                          │
//   │ older messages             │
//   └────────────────────────────┘
//
// Gated: does not open the WebSocket until user clicks "Connect to chat".
// Persists username in localStorage; auto re-claims on reconnect.
// Auto-reconnect with exp backoff (6 attempts) + foreground-visibility reconnect.
// Local ErrorBoundary fails closed — chat crash never breaks Home.

import { Component, useCallback, useEffect, useRef, useState } from 'react';

const LS_USERNAME = 'adeyaar_chat_username';
const MAX_RENDERED = 200;
const MAX_RECONNECT_ATTEMPTS = 6;
const BACKOFF_CAP_MS = 15000;

function randHex(n = 64) {
  const buf = new Uint8Array(n / 2);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function InnerChatPanel({ channel, embedded = false, fillHeight = false }) {
  const [connected, setConnected] = useState(false); // user pressed "Connect to chat"
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState([]); // newest FIRST
  const [viewers, setViewers] = useState(null);
  const [username, setUsername] = useState('');
  const [usernameConfirmed, setUsernameConfirmed] = useState(false);
  const [draft, setDraft] = useState('');
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0);
  const [, setNowTick] = useState(0);
  const [error, setError] = useState(null);
  const [reconnectIn, setReconnectIn] = useState(0);

  const wsRef = useRef(null);
  const clientTokenRef = useRef(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const connectedRef = useRef(false);
  const usernameToClaimRef = useRef('');
  const scrollRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const stickyBottomRef = useRef(true);
  const observerRef = useRef(null);
  const stableOpenTimerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_USERNAME);
      // Guard against legacy bad writes ("undefined"/"null"/whitespace)
      if (saved && saved !== 'undefined' && saved !== 'null' && saved.trim()) {
        setUsername(saved.trim());
      } else if (saved) {
        // Clean up bad legacy value
        try { localStorage.removeItem(LS_USERNAME); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const active = rateLimitedUntil > Date.now() || status === 'reconnecting';
    if (!active) return;
    const t = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [rateLimitedUntil, status]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const teardown = () => {
    clearReconnectTimer();
    if (stableOpenTimerRef.current) {
      clearTimeout(stableOpenTimerRef.current);
      stableOpenTimerRef.current = null;
    }
    detachWs(wsRef.current);
    if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
    wsRef.current = null;
  };

  // Remove event handlers so a dying socket doesn't fire onclose→scheduleReconnect
  // AFTER we've already opened its replacement (the "chat drops+reconnects on
  // every visibility flip / retry" bug).
  const detachWs = (ws) => {
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
  };

  const scheduleReconnect = useCallback(() => {
    if (!connectedRef.current) return;
    if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('gaveup');
      setError('Chat connection lost. Tap Retry to try again.');
      return;
    }
    const attempt = attemptRef.current;
    const delay = Math.min(BACKOFF_CAP_MS, 1000 * Math.pow(2, attempt));
    attemptRef.current = attempt + 1;
    setStatus('reconnecting');
    setReconnectIn(Math.ceil(delay / 1000));
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(() => {
    if (!channel) return;
    clearReconnectTimer();
    if (wsRef.current) {
      detachWs(wsRef.current);
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }

    const url = `wss://chat.cdn-lab.shop/chat?channel=${encodeURIComponent(channel)}`;
    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');
    setError(null);
    clientTokenRef.current = randHex(64);

    let ws;
    try { ws = new WebSocket(url); }
    catch (e) {
      setStatus('error');
      setError(String(e?.message || e));
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      setReconnectIn(0);
      // Do NOT reset attemptRef here — server may accept the handshake then
      // close moments later (post-open reject). Instead, only trust the
      // connection after it's been stable for 5s, which prevents a tight
      // reconnect loop that would never trip the 6-attempt cap.
      if (stableOpenTimerRef.current) clearTimeout(stableOpenTimerRef.current);
      stableOpenTimerRef.current = setTimeout(() => {
        stableOpenTimerRef.current = null;
        attemptRef.current = 0;
      }, 5000);
      try { ws.send(JSON.stringify({ event: 'ping', client: clientTokenRef.current })); } catch { /* ignore */ }
      // Only auto-re-claim when we've previously accepted a username this session
      // (usernameToClaimRef is only set from server-confirmed username=false response).
      const claim = usernameToClaimRef.current;
      if (claim && typeof claim === 'string' && claim.trim() && claim !== 'undefined' && claim !== 'null') {
        try { ws.send(JSON.stringify({ event: 'username', username: claim.trim() })); } catch { /* ignore */ }
      }
    };
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }

      if (data.event === 'count') { setViewers(data.count); return; }
      if (data.event === 'burst') {
        const arr = data.messages || [];
        setMessages(prev => [...prev, ...arr].slice(-MAX_RENDERED));
        return;
      }
      if (data.event === 'message') {
        setMessages(prev => [...prev.slice(-(MAX_RENDERED - 1)), data]);
        return;
      }
      if (data.event === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== data.id));
        return;
      }
      if (data.event === 'username') {
        const claimed = typeof data.username === 'string' ? data.username.trim() : '';
        if (data.taken === false && claimed) {
          setUsernameConfirmed(true);
          usernameToClaimRef.current = claimed;
          try { localStorage.setItem(LS_USERNAME, claimed); } catch { /* ignore */ }
        } else if (data.taken === true) {
          setUsernameConfirmed(false);
          // Suppress the useless "undefined is taken" case entirely
          if (claimed && claimed !== 'undefined' && claimed !== 'null') {
            setError(`Username "${claimed}" is taken. Pick another.`);
          } else {
            setError(null);
          }
        }
        return;
      }
      if (data.event === 'ratelimit') {
        setRateLimitedUntil(data.ends || 0);
        return;
      }
    };
    ws.onerror = () => { /* onclose fires after */ };
    ws.onclose = (e) => {
      if (stableOpenTimerRef.current) {
        clearTimeout(stableOpenTimerRef.current);
        stableOpenTimerRef.current = null;
      }
      setUsernameConfirmed(false);
      if (!connectedRef.current) { setStatus('closed'); return; }
      if (e.code === 1008 || e.code === 4403 || e.code === 4001) {
        setStatus('error');
        setError(`Chat closed: code ${e.code}. Origin may be blocked.`);
        return;
      }
      scheduleReconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, username, scheduleReconnect]);

  useEffect(() => {
    connectedRef.current = connected;
    if (connected) {
      attemptRef.current = 0;
      connect();
      return teardown;
    } else {
      teardown();
      setStatus('idle');
      setMessages([]);
      setViewers(null);
      setUsernameConfirmed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, channel]);

  useEffect(() => {
    if (!connected) return;
    const onVis = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== 1) {
        attemptRef.current = 0;
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, connect]);

  // IntersectionObserver watches a bottom sentinel: if it's visible, user is
  // "at the bottom" and we should stick; if it scrolls out of view, they're
  // reading history — leave them alone. This survives content growth,
  // reflow, mobile keyboard resize etc. that a distance-from-bottom check
  // silently gets wrong.
  useEffect(() => {
    if (!scrollRef.current || !bottomSentinelRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        stickyBottomRef.current = entries[0]?.isIntersecting ?? true;
      },
      { root: scrollRef.current, threshold: 0.01, rootMargin: '0px 0px 40px 0px' }
    );
    io.observe(bottomSentinelRef.current);
    observerRef.current = io;
    return () => io.disconnect();
  }, [connected]); // re-bind when list gets mounted/unmounted

  useEffect(() => {
    if (!scrollRef.current || !bottomSentinelRef.current) return;
    if (!stickyBottomRef.current) return;
    // Wait one frame so the new message is laid out before we scroll
    const raf = requestAnimationFrame(() => {
      if (bottomSentinelRef.current) {
        bottomSentinelRef.current.scrollIntoView({ block: 'end' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [messages]);

  const registerUsername = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    const trimmed = username.trim();
    if (!trimmed) return;
    setError(null);
    usernameToClaimRef.current = trimmed;
    wsRef.current.send(JSON.stringify({ event: 'username', username: trimmed }));
  };

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (Date.now() < rateLimitedUntil) return;
    wsRef.current.send(JSON.stringify({ event: 'message', message: trimmed }));
    setDraft('');
    stickyBottomRef.current = true;
  };

  const retryNow = () => {
    attemptRef.current = 0;
    setError(null);
    connect();
  };

  const disconnect = () => {
    setConnected(false);
  };

  if (!channel) return null;

  const rateLeft = Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
  const canSend = status === 'open' && usernameConfirmed && rateLeft === 0;

  // ── Pre-connect state: single call-to-action button ──
  if (!connected) {
    return (
      <div
        style={{
          marginTop: embedded ? 10 : 0,
          padding: embedded ? 0 : '0 10px 10px',
        }}
      >
        <button
          onClick={() => setConnected(true)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            background: 'rgba(77,168,255,0.10)',
            color: '#4da8ff',
            border: '1px solid rgba(77,168,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>💬</span>
          <span>Connect to chat</span>
        </button>
      </div>
    );
  }

  const statusChip = (() => {
    const base = {
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 7px',
      borderRadius: 999,
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      border: '1px solid transparent',
    };
    if (status === 'open') return { ...base, color: '#00e676', background: 'rgba(0,255,133,0.08)', borderColor: 'rgba(0,255,133,0.3)' };
    if (status === 'connecting') return { ...base, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' };
    if (status === 'reconnecting') return { ...base, color: '#ffb74d', background: 'rgba(255,183,77,0.08)', borderColor: 'rgba(255,183,77,0.35)' };
    return { ...base, color: '#ff6b6b', background: 'rgba(255,107,107,0.08)', borderColor: 'rgba(255,107,107,0.35)' };
  })();
  const statusLabel = (() => {
    if (status === 'open') return 'Live';
    if (status === 'connecting') return 'Connecting…';
    if (status === 'reconnecting') return `Reconnect ${reconnectIn}s`;
    if (status === 'gaveup') return 'Offline';
    return 'Error';
  })();

  return (
    <div
      style={{
        marginTop: embedded ? 10 : 0,
        padding: embedded ? 0 : '0 10px 10px',
        display: 'flex',
        flexDirection: 'column',
        ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>💬</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', flex: 1 }}>Live chat</span>
        <span style={statusChip}>{statusLabel}</span>
        {viewers !== null && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
            padding: '3px 7px', borderRadius: 999,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            whiteSpace: 'nowrap',
          }}>
            👁 {viewers.toLocaleString('en-IN')}
          </span>
        )}
        <button
          onClick={disconnect}
          title="Disconnect"
          style={{
            fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          ...(fillHeight ? { flex: 1, minHeight: 0 } : { height: 260 }),
          overflowY: 'auto',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '8px 10px',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {messages.length === 0 && status !== 'open' && (
          <div style={{ color: 'var(--ink-3)', fontSize: 11, padding: 4 }}>
            {status === 'connecting' && 'Connecting to chat…'}
            {status === 'reconnecting' && `Lost connection. Reconnecting in ${reconnectIn}s…`}
            {status === 'gaveup' && 'Chat is offline. Tap Retry.'}
            {status === 'error' && (error || 'Chat unavailable.')}
            {status === 'idle' && 'Starting up…'}
            {status === 'closed' && 'Chat disconnected.'}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 3, wordBreak: 'break-word' }}>
            <span style={{ color: m.color || 'var(--ink)', fontWeight: 700 }}>{m.username}</span>
            <span style={{ color: 'var(--ink-2)' }}>: {m.message}</span>
          </div>
        ))}
        <div ref={bottomSentinelRef} style={{ height: 1 }} aria-hidden="true" />
      </div>

      {/* Compose / register / gaveup — BELOW the messages */}
      {status === 'open' && !usernameConfirmed && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') registerUsername(); }}
            placeholder="Pick a username"
            maxLength={20}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', color: 'var(--ink)',
              border: '1px solid rgba(255,255,255,0.1)', fontSize: 12,
            }}
          />
          <button
            onClick={registerUsername}
            disabled={!username.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8,
              cursor: username.trim() ? 'pointer' : 'not-allowed',
              fontSize: 11, fontWeight: 700,
              background: 'rgba(77,168,255,0.15)',
              color: username.trim() ? '#4da8ff' : 'var(--ink-3)',
              border: '1px solid rgba(77,168,255,0.35)',
              opacity: username.trim() ? 1 : 0.5,
            }}
          >
            Join chat
          </button>
        </div>
      )}

      {status === 'open' && usernameConfirmed && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
            padding: '4px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            whiteSpace: 'nowrap',
          }}>
            {username}
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
            placeholder={rateLeft > 0 ? `Slow mode · ${rateLeft}s` : 'Type a message…'}
            maxLength={200}
            disabled={!canSend}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', color: 'var(--ink)',
              border: '1px solid rgba(255,255,255,0.1)', fontSize: 12,
              opacity: canSend ? 1 : 0.6,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend || !draft.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8,
              cursor: (canSend && draft.trim()) ? 'pointer' : 'not-allowed',
              fontSize: 11, fontWeight: 700,
              background: canSend && draft.trim() ? 'rgba(0,255,133,0.15)' : 'rgba(255,255,255,0.05)',
              color: canSend && draft.trim() ? '#00e676' : 'var(--ink-3)',
              border: canSend && draft.trim() ? '1px solid rgba(0,255,133,0.35)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Send
          </button>
        </div>
      )}

      {status === 'gaveup' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <span style={{ flex: 1, fontSize: 11, color: '#ff8080' }}>
            Chat disconnected — network hiccup or origin blocked.
          </span>
          <button
            onClick={retryNow}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid rgba(255,107,107,0.4)',
              background: 'rgba(255,107,107,0.12)',
              color: '#ff8080', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {error && status !== 'gaveup' && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#ff8080' }}>{error}</div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-3)' }}>
        Public third-party chat · not moderated by AdeYaar
      </div>
    </div>
  );
}

class ChatErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

export default function LiveChatPanel(props) {
  return (
    <ChatErrorBoundary>
      <InnerChatPanel {...props} />
    </ChatErrorBoundary>
  );
}
