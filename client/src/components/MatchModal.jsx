import { useEffect, useState } from 'react';
import { X, PackageSearch, Search, ShieldCheck } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import { isDemoItem } from '../utils.js';

export default function MatchModal({ item }) {
  const { closeModal, items } = useApp();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (isDemoItem(item)) throw new Error('demo');
        const data = await request(`/items/${item._id}/matches`);
        if (!cancelled) setMatches(data.matches || []);
      } catch {
        // Offline/demo fallback: simple same-category, opposite-type filter.
        if (!cancelled) setMatches(items.filter((x) => x.type !== item.type && x.category === item.category && x._id !== item._id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [item, items]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="modal match-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="eyebrow">SMART SUGGESTIONS</div>
            <h2>Potential matches</h2>
            <p>Opposite-type reports with similar details to “{item.title}”.</p>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="Close"><X /></button>
        </div>
        {loading ? (
          <div className="loading-state"><span className="spinner" /> Looking for matches…</div>
        ) : matches.length ? (
          <div className="match-list">
            {matches.map((m) => (
              <div className="match-row" key={m._id}>
                <div className="match-symbol"><PackageSearch /></div>
                <div>
                  <strong>{m.title}</strong>
                  <p>{m.category} · {m.location}{m.score != null ? ` · ${m.score}% match` : ''}</p>
                  <span>{m.description}</span>
                  {m.reasons?.length > 0 && <p className="match-reasons">{m.reasons.join(' · ')}</p>}
                </div>
                <span className="type-pill">{m.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><Search size={28} /><h3>No likely matches yet</h3><p>Try again when more community reports are available.</p></div>
        )}
        <div className="privacy-note"><ShieldCheck size={17} /><span>Suggestions are not proof of ownership. Verify privately and meet in a safe public place.</span></div>
        <div className="modal-actions"><button className="button button-primary" onClick={closeModal}>Done</button></div>
      </section>
    </div>
  );
}
