'use client';

import { Suspense, useState } from 'react';
import supabaseBrowser from '@/lib/supabase-browser';

function LoginContent() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleGoogleLogin = async () => {
    if (!supabaseBrowser) {
      setError('Supabase not configured. Set env vars.');
      return;
    }
    const { error: err } = await supabaseBrowser.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) setError(err.message);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!supabaseBrowser) { setError('Supabase not configured.'); return; }

    setLoading(true);
    setError('');
    const { error: err } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Wrong email or password'
        : err.message);
    } else {
      window.location.href = '/';
    }
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!supabaseBrowser) { setError('Supabase not configured.'); return; }

    setLoading(true);
    setError('');
    const { error: err } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName || email.split('@')[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
    } else {
      setMessage('Check your email for confirmation link!');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) { setError('Enter your email address'); return; }
    if (!supabaseBrowser) { setError('Supabase not configured.'); return; }

    setLoading(true);
    setError('');
    const { error: err } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/`,
    });
    if (err) {
      setError(err.message);
    } else {
      setMessage('Password reset link sent to your email!');
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid #1a4a3a',
    background: '#051912',
    color: '#f5f5f5',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle = {
    width: '100%',
    padding: '13px 20px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    background: '#2ecc71',
    color: '#051912',
    cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#051912',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#0a2e22',
        border: '1px solid #1a4a3a',
        borderRadius: 16,
        padding: '40px 36px',
        maxWidth: 380,
        width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f5f5f5' }}>
            AdeYaar <em style={{ color: '#c9a94e' }}>26</em>
          </div>
          <p style={{ color: '#8ba898', fontSize: 13, margin: '6px 0 0' }}>
            FIFA World Cup 2026 · Friend Betting
          </p>
        </div>

        {/* Google OAuth */}
        <button onClick={handleGoogleLogin} style={{
          ...btnStyle,
          background: '#fff',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 20,
        }}>
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#1a4a3a' }} />
          <span style={{ color: '#5a7a6a', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1a4a3a' }} />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={mode === 'login' ? handleEmailLogin : mode === 'signup' ? handleSignup : handleForgotPassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setError(''); }}
                style={inputStyle}
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setMessage(''); }}
              style={inputStyle}
              autoComplete="email"
            />
            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder={mode === 'signup' ? 'Create password (min 6 chars)' : 'Password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                style={inputStyle}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            )}
          </div>

          {error && (
            <p style={{ color: '#e74c3c', fontSize: 13, margin: '0 0 12px', textAlign: 'center' }}>{error}</p>
          )}
          {message && (
            <p style={{ color: '#2ecc71', fontSize: 13, margin: '0 0 12px', textAlign: 'center' }}>{message}</p>
          )}

          <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Please wait...' :
             mode === 'login' ? 'Sign in' :
             mode === 'signup' ? 'Create account' :
             'Send reset link'}
          </button>
        </form>

        {/* Mode toggles */}
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#8ba898' }}>
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                style={{ background: 'none', border: 'none', color: '#5a9a7a', cursor: 'pointer', fontSize: 13 }}>
                Forgot password?
              </button>
              <span style={{ margin: '0 8px' }}>·</span>
              <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                style={{ background: 'none', border: 'none', color: '#5a9a7a', cursor: 'pointer', fontSize: 13 }}>
                Create account
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              style={{ background: 'none', border: 'none', color: '#5a9a7a', cursor: 'pointer', fontSize: 13 }}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'forgot' && (
            <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              style={{ background: 'none', border: 'none', color: '#5a9a7a', cursor: 'pointer', fontSize: 13 }}>
              Back to sign in
            </button>
          )}
        </div>

        <p style={{ color: '#3a5a4a', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
          {mode === 'signup'
            ? 'Username auto-derived from your name. Changeable later.'
            : 'Same email works for both Google and password login.'}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#051912' }} />}>
      <LoginContent />
    </Suspense>
  );
}
