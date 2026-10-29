import { MapPin, Clock3, Sparkles, Pencil, Trash2, HandHelping, Flag } from 'lucide-react';
import { request, photoUrl } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import { timeAgo, isDemoItem, itemCode } from '../utils.js';

const statusLabels = { open: 'Open', matched: 'Matched', 'claim-pending': 'Claim pending', claimed: 'Claimed', returned: 'Returned' };

export default function ItemCard({ item, onChanged }) {
  const { openModal, openEdit, openClaim, notify, loadItems, requireLogin } = useApp();
  const demo = isDemoItem(item);
  const photo = item.photos?.[0];
  const canClaim = !demo && !item.isOwner && !['claimed', 'returned'].includes(item.status);

  const canFlag = !demo && !item.isOwner && !item.alreadyFlagged;

  function flag() {
    if (requireLogin('Sign in to report a problem with a listing.')) openModal('flag', item);
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.title}"? This also removes its claims and cannot be undone.`)) return;
    try {
      await request(`/items/${item._id}`, { method: 'DELETE' });
      notify('Report deleted.');
      await loadItems();
      onChanged?.();
    } catch (e) {
      notify(e.message);
    }
  }

  return (
    <article className="item-card">
      {photo && <img className="item-photo" src={photoUrl(photo)} alt={photo.originalName || item.title} loading="lazy" />}
      <div className="item-card-top">
        <span className={`type-pill ${item.type}`}>{item.type === 'lost' ? 'Looking for' : 'Found'} · {item.category}</span>
        <span className="item-id">{itemCode(item)}</span>
      </div>
      <h3>{item.title}</h3>
      <p className="item-description">{item.description}</p>
      <div className="item-meta">
        <span>
          <MapPin size={15} />{item.location}{' '}
          <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(item.location)}`} style={{ marginLeft: 5 }}>Map</a>
        </span>
        <span><Clock3 size={15} />{timeAgo(item.date || item.createdAt)}</span>
      </div>
      <div className="badge-row">
        {item.status && item.status !== 'open' && <span className={`status-badge ${item.status}`}>{statusLabels[item.status] || item.status}</span>}
        {item.isOwner && <span className="status-badge mine">Your report</span>}
        {item.isOwner && item.hidden && <span className="status-badge claim-rejected" title="Hidden pending moderator review">Hidden · under review</span>}
        {item.isOwner && item.flagCount > 0 && !item.hidden && <span className="status-badge claim-pending">{item.flagCount} flag{item.flagCount > 1 ? 's' : ''}</span>}
      </div>
      <div className="item-actions">
        <button className="button button-soft" onClick={() => openModal('matches', item)}><Sparkles size={15} /> Find matches</button>
        {canClaim && (
          <button className="button button-outline" onClick={() => openClaim(item)}>
            <HandHelping size={15} /> {item.type === 'found' ? 'This is mine' : 'I found this'}
          </button>
        )}
        {canFlag && <button className="icon-button" title="Report a problem with this listing" aria-label="Report a problem" onClick={flag}><Flag size={15} /></button>}
        {item.isOwner && !demo && (
          <div className="mini-actions">
            <button className="icon-button" title="Edit report" onClick={() => openEdit(item)}><Pencil size={15} /></button>
            <button className="icon-button danger-icon" title="Delete report" onClick={remove}><Trash2 size={15} /></button>
          </div>
        )}
      </div>
    </article>
  );
}
