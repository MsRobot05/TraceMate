import { useState } from 'react';
import { X, Flag, ShieldCheck } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

const reasons = ['Looks like spam or a fake report', 'Contains private or sensitive information', 'Inappropriate content', 'Duplicate of another report'];

export default function FlagModal({ item }) {
  const { closeModal, notify, loadItems } = useApp();
  const [reason, setReason] = useState(reasons[0]);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await request(`/items/${item._id}/flag`, { method: 'POST', body: JSON.stringify({ reason: `${reason}${extra.trim() ? ` — ${extra.trim()}` : ''}` }) });
      closeModal();
      notify(d.message);
      await loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) closeModal(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="flag-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow"><Flag size={13} /> COMMUNITY MODERATION</div>
            <h2 id="flag-title">Report a problem</h2>
            <p>“{item.title}” · {item.location}</p>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="Close" disabled={busy}><X /></button>
        </div>
        <form className="report-form" onSubmit={submit}>
          <label>What is wrong with this report?
            <select value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
          <label>More detail (optional)
            <textarea rows="3" maxLength="200" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Anything a moderator should know." />
          </label>
          <div className="privacy-note"><ShieldCheck size={17} /><span>A moderator reviews every flagged report. A report flagged by 3 different members is hidden automatically until it is reviewed.</span></div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={closeModal}>Cancel</button>
            <button disabled={busy} className="button button-primary" type="submit"><Flag size={15} /> {busy ? 'Sending…' : 'Submit flag'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
