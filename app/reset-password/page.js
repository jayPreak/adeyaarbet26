'use client';

import { useState, useEffect } from 'react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    import('@/lib/supabase-browser').then(mod => setSupabase(mod.default));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!supabase) {
      setError('Loading...');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="reset-page">
        <div className="reset-card">
          <h2>Password updated</h2>
          <p>You can now log in with your new password.</p>
          <a href="/login" className="reset-btn">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-page">
      <div className="reset-card">
        <h2>Set new password</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="reset-input"
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="reset-input"
          />
          {error && <div className="reset-error">{error}</div>}
          <button type="submit" disabled={loading} className="reset-btn">
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
