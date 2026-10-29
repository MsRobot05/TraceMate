import { useState } from 'react';
import { ShieldCheck, X, ArrowUpRight } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function AuthModal() {
  const { login, closeModal, notify } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { email: form.email.trim(), password: form.password, ...(mode === 'register' ? { name: form.name.trim() } : {}) };
      const data = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) });
      await login(data);
      closeModal();
      notify(`Signed in as ${data.user.name}.`);
    } catch (err) {
      setError(err.message || 'Unable to authenticate. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop auth-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) closeModal(); }}>
      <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow"><ShieldCheck size={13} /> TRACEMATE COMMUNITY</div>
            <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>{mode === 'login' ? 'Sign in to manage your reports and recovery tasks.' : 'Join your campus community and help reunite people with their belongings.'}</p>
          </div>
          <button className="icon-button" type="button" onClick={closeModal} aria-label="Close" disabled={busy}><X /></button>
        </div>
        <div className="auth-switch" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        <form className="report-form auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>Full name
              <input autoComplete="name" required minLength="2" maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
            </label>
          )}
          <label>Email address
            <input autoComplete="email" type="email" required maxLength="160" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </label>
          <label>Password
            <input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" required minLength={mode === 'register' ? 10 : 1} maxLength="128" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === 'register' ? 'At least 10 characters' : 'Enter your password'} />
            {mode === 'register' && <small>Use at least 10 characters.</small>}
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button disabled={busy} className="button button-primary button-wide auth-submit" type="submit">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in to TraceMate' : 'Create account'} <ArrowUpRight size={16} />
          </button>
          <p className="auth-privacy"><ShieldCheck size={14} /> Your account is used to manage your reports and recovery tasks.</p>
        </form>
      </section>
    </div>
  );
}
