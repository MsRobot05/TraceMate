import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, PackageSearch, Inbox, Send, Phone, Mail, User, MapPin } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import ItemCard from '../components/ItemCard.jsx';
import { timeAgo } from '../utils.js';

const claimLabels = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', completed: 'Returned' };

function ClaimBadge({ status }) {
  return <span className={`status-badge claim-${status}`}>{claimLabels[status] || status}</span>;
}

export default function MyActivity() {
  const { user, openModal, openCreate, notify, loadItems } = useApp();
  const [tab, setTab] = useState('reports');
  const [mine, setMine] = useState([]);
  const [made, setMade] = useState([]);
  const [received, setReceived] = useState([]);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const [a, b, c] = await Promise.all([request('/items/mine'), request('/claims/mine'), request('/claims/received')]);
      setMine(a.items || []);
      setMade(b.claims || []);
      setReceived(c.claims || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  async function review(claim, status) {
    try {
      await request(`/claims/${claim._id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note: notes[claim._id] || '' }) });
      notify(status === 'approved' ? 'Claim approved. The claimant can now see your contact details.' : status === 'completed' ? 'Marked as returned. Great work!' : 'Claim rejected.');
      await Promise.all([refresh(), loadItems()]);
    } catch (e) {
      notify(e.message);
    }
  }

  async function withdraw(claim) {
    if (!window.confirm('Withdraw this claim?')) return;
    try {
      await request(`/claims/${claim._id}`, { method: 'DELETE' });
      notify('Claim withdrawn.');
      await Promise.all([refresh(), loadItems()]);
    } catch (e) {
      notify(e.message);
    }
  }

  if (!user) {
    return (
      <section className="empty-state" style={{ marginTop: 40 }}>
        <ClipboardList size={32} /><h3>Sign in to see your activity</h3>
        <p>Your reports, the claims you made, and claims waiting for your review all live here.</p>
        <button className="button button-primary" onClick={() => openModal('auth')}>Sign in / Register</button>
      </section>
    );
  }

  const pendingReview = received.filter((c) => c.status === 'pending').length;
  const tabs = [
    ['reports', `My reports (${mine.length})`],
    ['made', `Claims I made (${made.length})`],
    ['received', `Claims to review (${received.length})${pendingReview ? ` · ${pendingReview} new` : ''}`]
  ];

  return (
    <section className="reports-section" style={{ paddingTop: 28 }}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h2>My activity</h2>
          <p>Manage your reports, follow your claims and review claims on items you reported.</p>
        </div>
        <button className="button button-outline desktop-create" onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}

      {tab === 'reports' && (mine.length ? (
        <div className="items-grid">{mine.map((item) => <ItemCard key={item._id} item={item} onChanged={refresh} />)}</div>
      ) : (
        <div className="empty-state"><PackageSearch size={32} /><h3>You have no reports yet</h3><p>Create a lost or found report to get started.</p>
          <button className="button button-primary" onClick={openCreate}>Create a report</button></div>
      ))}

      {tab === 'made' && (made.length ? (
        <div className="claim-list">
          {made.map((claim) => (
            <article className="claim-card" key={claim._id}>
              <div className="claim-head">
                <h3>{claim.item?.title || 'Removed report'}</h3>
                <ClaimBadge status={claim.status} />
              </div>
              <p className="claim-meta"><MapPin size={14} /> {claim.item?.location || '—'} · submitted {timeAgo(claim.createdAt)}</p>
              <p className="claim-text">“{claim.message}”</p>
              {claim.handover && (
                <div className="handover-box">
                  <strong>Handover details from the owner</strong>
                  {claim.handover.contactName && <span><User size={14} /> {claim.handover.contactName}</span>}
                  {claim.handover.contactPhone && <span><Phone size={14} /> {claim.handover.contactPhone}</span>}
                  {claim.handover.contactEmail && <span><Mail size={14} /> {claim.handover.contactEmail}</span>}
                  {claim.handover.safeMeetingPoint && <span><MapPin size={14} /> Suggested meeting point: {claim.handover.safeMeetingPoint}</span>}
                  {!claim.handover.contactPhone && !claim.handover.contactEmail && <span>The owner did not add contact details. Use the suggested meeting point.</span>}
                </div>
              )}
              {claim.status === 'rejected' && claim.history?.length > 0 && claim.history[claim.history.length - 1].note && (
                <p className="claim-note">Owner note: {claim.history[claim.history.length - 1].note}</p>
              )}
              {claim.status === 'pending' && (
                <div className="claim-actions"><button className="button button-outline" onClick={() => withdraw(claim)}>Withdraw claim</button></div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><Send size={32} /><h3>No claims yet</h3><p>Open Item reports and use “This is mine” on an item you recognise.</p></div>
      ))}

      {tab === 'received' && (received.length ? (
        <div className="claim-list">
          {received.map((claim) => (
            <article className="claim-card" key={claim._id}>
              <div className="claim-head">
                <h3>{claim.item?.title || 'Removed report'}</h3>
                <ClaimBadge status={claim.status} />
              </div>
              <p className="claim-meta">
                <User size={14} /> {claim.claimant?.name || 'Unknown'}{claim.claimant?.program ? ` · ${claim.claimant.program}` : ''}{claim.claimant?.year ? ` · ${claim.claimant.year}` : ''} · {timeAgo(claim.createdAt)}
              </p>
              <p className="claim-text">“{claim.message}”</p>
              {claim.privateProof && <div className="proof-box"><strong>Private proof</strong><span>{claim.privateProof}</span></div>}
              {['approved', 'completed'].includes(claim.status) && (claim.claimant?.phone || claim.claimant?.email) && (
                <div className="handover-box">
                  <strong>Claimant contact</strong>
                  {claim.claimant.phone && <span><Phone size={14} /> {claim.claimant.phone}</span>}
                  {claim.claimant.email && <span><Mail size={14} /> {claim.claimant.email}</span>}
                </div>
              )}
              {claim.status === 'pending' && (
                <>
                  <input className="claim-note-input" maxLength="300" placeholder="Optional note to keep with this decision" value={notes[claim._id] || ''} onChange={(e) => setNotes({ ...notes, [claim._id]: e.target.value })} />
                  <div className="claim-actions">
                    <button className="button button-primary" onClick={() => review(claim, 'approved')}>Approve</button>
                    <button className="button button-outline" onClick={() => review(claim, 'rejected')}>Reject</button>
                  </div>
                </>
              )}
              {claim.status === 'approved' && (
                <div className="claim-actions">
                  <button className="button button-primary" onClick={() => review(claim, 'completed')}>Mark as returned</button>
                  <button className="button button-outline" onClick={() => review(claim, 'rejected')}>Reject</button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><Inbox size={32} /><h3>No claims to review</h3><p>When someone claims one of your reports it will appear here.</p></div>
      ))}
    </section>
  );
}
