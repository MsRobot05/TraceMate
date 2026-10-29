import { useState } from 'react';
import { X, ShieldCheck, Send } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function ClaimModal({ item }) {
  const { closeModal, notify, loadItems } = useApp();
  const [message, setMessage] = useState('');
  const [privateProof, setPrivateProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isFound = item.type === 'found';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/claims', { method: 'POST', body: JSON.stringify({ itemId: item._id, message, privateProof }) });
      closeModal();
      notify('Claim submitted. The report owner will review it — track it under My activity.');
      await loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) closeModal(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">PRIVATE CLAIM</div>
            <h2 id="claim-title">{isFound ? 'Claim this item' : 'I found this item'}</h2>
            <p>“{item.title}” · {item.location}</p>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="Close" disabled={busy}><X /></button>
        </div>
        <form className="report-form" onSubmit={submit}>
          <label>Message to the report owner *
            <textarea required maxLength="1200" rows="3" value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={isFound ? 'Tell them why you believe this is yours and when you lost it.' : 'Tell them where and when you found it.'} />
          </label>
          <label>Private proof (only the owner sees this)
            <textarea maxLength="500" rows="3" value={privateProof} onChange={(e) => setPrivateProof(e.target.value)}
              placeholder="A detail that is not in the public report — a mark, sticker, contents, lock-screen, etc." />
            <small>Never include OTPs, passwords or ID numbers.</small>
          </label>
          <div className="privacy-note"><ShieldCheck size={17} /><span>The owner’s phone and email stay hidden until they approve your claim. Meet at a staffed public place.</span></div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={closeModal}>Cancel</button>
            <button disabled={busy} className="button button-primary" type="submit"><Send size={15} /> {busy ? 'Sending…' : 'Submit claim'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
