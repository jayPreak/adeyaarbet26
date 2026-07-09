'use client';

// Throwaway probe page — verifies whether the streamed.pk chat WebSocket
// is reachable + supports sending from a non-streamed.pk origin.
// Delete this file once the real ChatPanel is validated in prod.

import { useEffect, useRef, useState } from 'react';

const DEFAULT_CHANNEL = 'france-vs-morocco-2515305';

function randHex(n = 64) {
  const buf = new Uint8Array(n / 2);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ChatProbe() {
  const [channel, setChannel] = useState(DEFAULT_CHANNEL);
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [log, setLog] = useState([]);
  const [viewers, setViewers] = useState(null);
  const [username, setUsername] = useState('');
  const [usernameConfirmed, setUsernameConfirmed] = useState(false);
  const [draft, setDraft] = useState('');
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0);
  const wsRef = useRef(null);
  const clientTokenRef = useRef(null);
  const msgBoxRef = useRef(null);

  const appendLog = (line) => setLog(prev => [...prev.slice(-100), line]);

  useEffect(() => {
    if (msgBoxRef.current) msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
  }, [messages]);

  const connect = () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
    const url = `wss://chat.cdn-lab.shop/chat?channel=${encodeURIComponent(channel)}`;
    setStatus('connecting');
    setMessages([]);
    setLog([]);
    setUsernameConfirmed(false);
    appendLog(`→ opening ${url}`);
    clientTokenRef.current = randHex(64);

    let ws;
    try { ws = new WebSocket(url); }
    catch (e) { setStatus('error'); appendLog(`✗ ctor threw: ${e?.message || e}`); return; }
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      appendLog('✓ open');
      // Mimic client heartbeat seen in HAR — probably harmless if optional.
      try { ws.send(JSON.stringify({ event: 'ping', client: clientTokenRef.current })); } catch { /* ignore */ }
    };
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); }
      catch { appendLog(`⇦ (raw) ${String(ev.data).slice(0, 200)}`); return; }

      if (data.event === 'count') { setViewers(data.count); return; }
      if (data.event === 'burst') {
        appendLog(`⇦ burst (${data.messages?.length || 0} msgs)`);
        setMessages(prev => [...prev, ...(data.messages || [])]);
        return;
      }
      if (data.event === 'message') {
        setMessages(prev => [...prev.slice(-300), data]);
        return;
      }
      if (data.event === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== data.id));
        return;
      }
      if (data.event === 'username') {
        if (data.taken === false) {
          setUsernameConfirmed(true);
          appendLog(`✓ username "${data.username}" accepted`);
        } else if (data.taken === true) {
          setUsernameConfirmed(false);
          appendLog(`✗ username "${data.username}" taken`);
        } else {
          appendLog(`⇦ username: ${JSON.stringify(data)}`);
        }
        return;
      }
      if (data.event === 'ratelimit') {
        setRateLimitedUntil(data.ends || 0);
        appendLog(`⚠ ratelimit until ${new Date(data.ends).toLocaleTimeString()}`);
        return;
      }
      appendLog(`⇦ ${JSON.stringify(data).slice(0, 200)}`);
    };
    ws.onerror = () => { appendLog(`✗ error event`); setStatus('error'); };
    ws.onclose = (e) => {
      appendLog(`✗ close code=${e.code} reason=${e.reason || '(none)'} clean=${e.wasClean}`);
      setStatus('closed');
    };
  };

  const registerUsername = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    if (!username.trim()) return;
    wsRef.current.send(JSON.stringify({ event: 'username', username: username.trim() }));
    appendLog(`→ username ${username.trim()}`);
  };

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    if (!draft.trim()) return;
    if (Date.now() < rateLimitedUntil) {
      appendLog(`⚠ still ratelimited`);
      return;
    }
    wsRef.current.send(JSON.stringify({ event: 'message', message: draft.trim() }));
    appendLog(`→ message: ${draft.trim()}`);
    setDraft('');
  };

  useEffect(() => () => {
    if (wsRef.current) try { wsRef.current.close(); } catch { /* ignore */ }
  }, []);

  const rateLeft = Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000));

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#eee', background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18 }}>streamed.pk chat probe</h1>
      <p style={{ opacity: 0.7, fontSize: 12 }}>
        Verifies <code>wss://chat.cdn-lab.shop</code> is reachable + supports send/register from this origin.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <input value={channel} onChange={(e) => setChannel(e.target.value)}
          style={{ flex: 1, padding: 6, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }} />
        <button onClick={connect} style={{ padding: '6px 14px', background: '#ff3b3b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Connect
        </button>
      </div>

      <div style={{ fontSize: 12, marginBottom: 8 }}>
        Status: <b>{status}</b>{viewers !== null ? ` · viewers: ${viewers.toLocaleString()}` : ''}
        {usernameConfirmed ? ` · you: ${username}` : ''}
        {rateLeft > 0 ? ` · ratelimit ${rateLeft}s` : ''}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username"
          style={{ width: 180, padding: 6, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }} />
        <button onClick={registerUsername} disabled={status !== 'open'}
          style={{ padding: '6px 12px', background: '#4da8ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: status === 'open' ? 1 : 0.5 }}>
          Register
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="message"
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          style={{ flex: 1, padding: 6, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }} />
        <button onClick={sendMessage} disabled={status !== 'open' || !usernameConfirmed}
          style={{ padding: '6px 12px', background: '#00c853', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: (status === 'open' && usernameConfirmed) ? 1 : 0.5 }}>
          Send
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Messages ({messages.length})</div>
          <div ref={msgBoxRef} style={{ background: '#111', border: '1px solid #333', borderRadius: 4, padding: 10, height: '55vh', overflowY: 'auto', fontSize: 12, lineHeight: 1.4 }}>
            {messages.length === 0 && <div style={{ opacity: 0.5 }}>(none yet)</div>}
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 3 }}>
                <span style={{ color: m.color || '#eee', fontWeight: 700 }}>{m.username}</span>
                <span style={{ opacity: 0.85 }}>: {m.message}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Log</div>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: 4, padding: 10, height: '55vh', overflowY: 'auto', fontSize: 11, lineHeight: 1.4, opacity: 0.85 }}>
            {log.length === 0 && <div style={{ opacity: 0.5 }}>(no frames yet)</div>}
            {log.map((line, i) => (<div key={i}>{line}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
