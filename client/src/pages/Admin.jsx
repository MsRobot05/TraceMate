import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Users, PackageSearch, Flag, EyeOff, Eye, Trash2, BarChart3, RefreshCw } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import { timeAgo } from '../utils.js';

const TABS = [['flagged', 'Flagged reports'], ['hidden', 'Hidden reports'], ['all', 'All reports'], ['users', 'Users']];

/** Moderator dashboard: platform statistics, flagged-report queue and user roles. Admin accounts only. */
export default function Admin() {
  const { user, openModal, notify, loadItems } = useApp();
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('flagged');
  const [data, setData] = useState({ tab: null, rows: [] });
  // Rows only count for the tab they were fetched for, so switching tabs never shows stale rows in the wrong table.
  const rows = data.tab === tab ? data.rows : [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setBusy(true);
    setError('');
    try {
      const [s, list] = await Promise.all([
        request('/admin/stats'),
        tab === 'users' ? request('/admin/users') : request(`/admin/items?filter=${tab}`)
      ]);
      setStats(s);
      setData({ tab, rows: tab === 'users' ? list.users : list.items });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [user, tab]);

  useEffect(() => { refresh(); }, [refresh]);

  async function moderate(item, action) {
    try {
      await request(`/admin/items/${item._id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      notify(action === 'hide' ? 'Report hidden.' : action === 'unhide' ? 'Report restored.' : 'Flags cleared and report restored.');
      await Promise.all([refresh(), loadItems()]);
    } catch (e) { notify(e.message); }
  }

  async function remove(item) {
    if (!window.confirm(`Permanently remove "${item.title}" and its claims?`)) return;
    try {
      await request(`/admin/items/${item._id}`, { method: 'DELETE' });
      notify('Report removed.');
      await Promise.all([refresh(), loadItems()]);
    } catch (e) { notify(e.message); }
  }

  async function setRole(u, role) {
    try {
      await request(`/admin/users/${u._id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      notify(`${u.name} is now ${role === 'admin' ? 'a moderator' : 'a student'}.`);
      refresh();
    } catch (e) { notify(e.message); }
  }

  if (!user) {
    return (
      <section className="empty-state" style={{ marginTop: 40 }}>
        <ShieldCheck size={32} /><h3>Sign in as a moderator</h3><p>The moderation dashboard is limited to administrator accounts.</p>
        <button className="button button-primary" onClick={() => openModal('auth')}>Sign in / Register</button>
      </section>
    );
  }
  if (user.role !== 'admin') {
    return (
      <section className="empty-state" style={{ marginTop: 40 }}>
        <ShieldCheck size={32} /><h3>Moderators only</h3>
        <p>Your account does not have administrator access. Ask the project owner to add your email to <code>ADMIN_EMAILS</code>.</p>
      </section>
    );
  }

  const cards = stats && [
    [Users, 'Members', stats.users],
    [PackageSearch, 'Reports', stats.items],
    [BarChart3, 'Recovery rate', `${stats.recoveryRate}%`],
    [Flag, 'Flagged', stats.flagged],
    [EyeOff, 'Hidden', stats.hidden],
    [ShieldCheck, 'Claims to review', stats.pendingClaims]
  ];

  return (
    <section className="reports-section" style={{ paddingTop: 28 }}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">MODERATION</div>
          <h2>Admin dashboard</h2>
          <p>Review flagged reports, keep the feed safe and manage moderator access.</p>
        </div>
        <button className="button button-outline desktop-create" onClick={refresh} disabled={busy}><RefreshCw size={15} /> {busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {cards && (
        <div className="admin-stats">
          {cards.map(([Icon, label, value]) => (
            <div className="agent-summary-card" key={label}><span><Icon size={14} /> {label}</span><strong>{value}</strong></div>
          ))}
        </div>
      )}
      {stats && (
        <div className="cat-bars" aria-label="Reports by category">
          {Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
            <div className="cat-row" key={cat}>
              <span>{cat}</span>
              <div className="cat-track"><div className="cat-fill" style={{ width: `${(n / Math.max(...Object.values(stats.categories))) * 100}%` }} /></div>
              <b>{n}</b>
            </div>
          ))}
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}

      {tab === 'users' ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Program</th><th>Reports</th><th>Role</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{[u.program, u.year].filter(Boolean).join(' · ') || '—'}</td><td>{u.reports}</td>
                  <td><span className={`status-badge ${u.role === 'admin' ? 'claimed' : 'mine'}`}>{u.role}</span></td>
                  <td>{u._id !== user._id && <button className="button button-outline" onClick={() => setRole(u, u.role === 'admin' ? 'student' : 'admin')}>{u.role === 'admin' ? 'Remove moderator' : 'Make moderator'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length ? (
        <div className="claim-list">
          {rows.map((item) => (
            <article className="claim-card" key={item._id}>
              <div className="claim-head">
                <h3>{item.title}</h3>
                <span>{item.hidden && <span className="status-badge claim-rejected">Hidden</span>} {item.flags?.length > 0 && <span className="status-badge claim-pending">{item.flags.length} flag{item.flags.length > 1 ? 's' : ''}</span>}</span>
              </div>
              <p className="claim-meta">{item.type} · {item.category} · {item.location} · {timeAgo(item.createdAt)}</p>
              <p className="claim-text">{item.description}</p>
              <p className="claim-meta">By {item.owner?.name || 'unknown'} ({item.owner?.email || '—'})</p>
              {item.flags?.length > 0 && (
                <div className="proof-box"><strong>Why it was flagged</strong>{item.flags.map((f, i) => <span key={i}>• {f.reason}</span>)}</div>
              )}
              <div className="claim-actions">
                {item.hidden
                  ? <button className="button button-primary" onClick={() => moderate(item, 'unhide')}><Eye size={15} /> Restore</button>
                  : <button className="button button-outline" onClick={() => moderate(item, 'hide')}><EyeOff size={15} /> Hide</button>}
                {item.flags?.length > 0 && <button className="button button-soft" onClick={() => moderate(item, 'clear-flags')}>Dismiss flags</button>}
                <button className="button button-outline" onClick={() => remove(item)}><Trash2 size={15} /> Remove</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><ShieldCheck size={30} /><h3>Nothing to review</h3><p>No reports in this queue right now.</p></div>
      )}
    </section>
  );
}
