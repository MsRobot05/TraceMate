import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ShieldCheck, CheckCircle2, MapPin, ArrowUpRight, Box, PackageSearch, Search } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import StatCard from '../components/StatCard.jsx';
import ItemCard from '../components/ItemCard.jsx';

export default function Overview() {
  const navigate = useNavigate();
  const { items, loading, openCreate } = useApp();
  const counts = useMemo(() => ({
    all: items.length,
    lost: items.filter((i) => i.type === 'lost').length,
    found: items.filter((i) => i.type === 'found').length,
    returned: items.filter((i) => i.status === 'returned').length,
    rate: items.length ? Math.round((items.filter((i) => i.status === 'returned').length / items.length) * 100) : 0
  }), [items]);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> YOUR CAMPUS, CONNECTED</div>
          <h1>Lost something?<br /><span>Let’s bring it back.</span></h1>
          <p>A smarter way to reconnect lost belongings with the people who need them. Every little clue counts.</p>
          <div className="hero-buttons">
            <button className="button button-primary" onClick={openCreate}><Plus size={17} /> Create a report</button>
            <button className="button button-outline" onClick={() => navigate('/reports')}>Browse reports <ArrowUpRight size={16} /></button>
          </div>
          <div className="hero-trust"><ShieldCheck size={16} /> Community-powered. Privacy-minded.</div>
        </div>
        <div className="hero-art">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-box"><Box size={74} strokeWidth={1.2} /></div>
          <div className="float-tag tag-top"><CheckCircle2 size={16} /> Item found!</div>
          <div className="float-tag tag-bottom"><MapPin size={16} /> Campus community</div>
          <div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✧</div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={PackageSearch} label="Total reports" value={counts.all} caption="Across the community" tone="purple" />
        <StatCard icon={Search} label="Lost items" value={counts.lost} caption="Waiting to be found" tone="amber" />
        <StatCard icon={CheckCircle2} label="Found items" value={counts.found} caption="Ready for recovery" tone="green" />
        <StatCard icon={ShieldCheck} label="Recovered" value={counts.returned} caption={`${counts.rate}% recovery rate`} tone="blue" />
      </section>

      <section className="reports-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE COMMUNITY FEED</div>
            <h2>Recent item reports</h2>
            <p>Every report is one more chance to reunite someone with their belongings. {counts.returned > 0 && `${counts.returned} already returned.`}</p>
          </div>
          <button className="button button-outline desktop-create" onClick={() => navigate('/reports')}>See all reports <ArrowUpRight size={16} /></button>
        </div>
        {loading ? (
          <div className="loading-state"><span className="spinner" /> Loading community reports…</div>
        ) : items.length ? (
          <div className="items-grid">{items.slice(0, 6).map((item) => <ItemCard key={item._id} item={item} />)}</div>
        ) : (
          <div className="empty-state">
            <PackageSearch size={32} /><h3>No reports yet</h3><p>Be the first to create a report for your campus.</p>
            <button className="button button-primary" onClick={openCreate}><Plus size={16} /> Create a report</button>
          </div>
        )}
      </section>

      <section className="safe-banner">
        <div className="safe-banner-icon"><ShieldCheck size={24} /></div>
        <div><h3>Recovery should be safe and simple.</h3><p>Verify ownership privately. Personal information should never appear in public reports.</p></div>
        <button className="button button-outline" onClick={() => navigate('/safe-recovery')}>Our safety guide <ArrowUpRight size={16} /></button>
      </section>
    </>
  );
}
