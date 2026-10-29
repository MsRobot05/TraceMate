import { useMemo, useState } from 'react';
import { Search, Plus, PackageSearch } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { categories } from '../constants.js';
import ItemCard from '../components/ItemCard.jsx';

const PAGE_SIZE = 12;

export default function Reports() {
  const { items, loading, openCreate } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState('newest');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((item) =>
      (filter === 'all' || item.type === filter) &&
      (!availableOnly || ['open', 'matched', 'claim-pending'].includes(item.status || 'open')) &&
      (category === 'all' || item.category === category) &&
      (!q || `${item.title} ${item.description} ${item.location} ${item.category}`.toLowerCase().includes(q)));
    const time = (i) => new Date(i.date || i.createdAt || 0).getTime();
    return sort === 'oldest' ? [...list].sort((a, b) => time(a) - time(b)) : [...list].sort((a, b) => time(b) - time(a));
  }, [items, filter, category, search, availableOnly, sort]);

  return (
    <section className="reports-section" style={{ paddingTop: 28 }}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">COMMUNITY LISTINGS</div>
          <h2>Browse item reports</h2>
          <p>Every report is one more chance to reunite someone with their belongings.</p>
        </div>
        <button className="button button-outline desktop-create" onClick={openCreate}><Plus size={16} /> New report</button>
      </div>
      <div className="filter-bar">
        <div className="search-field">
          <Search size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items, details or locations…" aria-label="Search reports" />
        </div>
        <div className="filter-pills">
          {['all', 'lost', 'found'].map((f) => (
            <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All reports' : f === 'lost' ? 'Lost' : 'Found'}
            </button>
          ))}
        </div>
        <select className="category-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="category-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort order">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <label className="check-pill"><input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} /> Still unresolved</label>
      </div>
      {loading ? (
        <div className="loading-state"><span className="spinner" /> Loading community reports…</div>
      ) : shown.length ? (
        <>
          <div className="items-grid">{shown.slice(0, visible).map((item) => <ItemCard key={item._id} item={item} />)}</div>
          {shown.length > visible && (
            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <button className="button button-outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show more ({shown.length - visible} remaining)</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <PackageSearch size={32} /><h3>No reports found</h3><p>Try another search or create the first report for this filter.</p>
          <button className="button button-primary" onClick={openCreate}><Plus size={16} /> Create a report</button>
        </div>
      )}
      <div className="feed-foot">
        <span>Showing {Math.min(visible, shown.length)} of {shown.length} matching reports ({items.length} total)</span>
        <span><span className="live-dot" /> Community feed</span>
      </div>
    </section>
  );
}
