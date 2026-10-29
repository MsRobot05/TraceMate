import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, PackageSearch, ShieldCheck, Plus, Menu, X, Sparkles, CheckCircle2,
  AlertCircle, RefreshCw, UserRound, BrainCircuit, ArrowUpRight, ClipboardList, ShieldAlert
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import Brand from './Brand.jsx';
import Footer from './Footer.jsx';
import ModalHost from './ModalHost.jsx';
import NotificationBell from './NotificationBell.jsx';

/** Layout route: sidebar + top bar + the active page (<Outlet/>) + global modals. */
export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, notice, setNotice, error, loadItems, openCreate, openModal, logout } = useApp();
  const close = () => setMobileOpen(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Brand />
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <NavLink to="/" end onClick={close}><LayoutDashboard size={18} /> Overview</NavLink>
          <NavLink to="/reports" onClick={close}><PackageSearch size={18} /> Item reports</NavLink>
          <NavLink to="/my" onClick={close}><ClipboardList size={18} /> My activity</NavLink>
          <NavLink to="/safe-recovery" onClick={close}><ShieldCheck size={18} /> Safe recovery</NavLink>
          <NavLink to="/agent" onClick={close}><BrainCircuit size={18} /> AI Agent &amp; Pending <span>NEW</span></NavLink>
          {user?.role === 'admin' && <NavLink to="/admin" onClick={close}><ShieldAlert size={18} /> Moderation</NavLink>}
          <button className="nav-ai-button" onClick={() => { openModal('assistant'); close(); }}>
            <BrainCircuit size={18} /> AI Recovery Assistant <span>NEW</span>
          </button>
        </nav>
        <div className="sidebar-promo">
          <span className="promo-icon"><Sparkles size={20} /></span>
          <h3>Found something?</h3>
          <p>One small report could help someone recover something important.</p>
          <button className="button button-primary button-wide" onClick={() => { openCreate(); close(); }}>
            Report an item <ArrowUpRight size={16} />
          </button>
          <div className="promo-foot">A student-built community PoC</div>
        </div>
        <div className="sidebar-bottom"><ShieldCheck size={16} /><span>Community-first recovery</span></div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" onClick={close} aria-label="Close menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X /> : <Menu />}
          </button>
          <div>
            <div className="breadcrumb">Workspace <span>/</span> Community</div>
            <div className="top-title">Your campus, connected <span className="live-dot" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user ? (
              <>
                <NotificationBell />
                <button className="button button-outline" onClick={() => openModal('profile')}><UserRound size={15} /> {user.name?.split(' ')[0] || 'Profile'}</button>
                <button className="button button-outline" onClick={() => logout()}>Sign out</button>
              </>
            ) : (
              <button className="button button-outline" onClick={() => openModal('auth')}>Sign in / Register</button>
            )}
            <button className="button button-primary top-create" onClick={openCreate}><Plus size={17} /> Create a report</button>
          </div>
        </header>

        {notice && (
          <div className="notice">
            <CheckCircle2 size={17} /><span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss">×</button>
          </div>
        )}
        {error && (
          <div className="api-warning">
            <AlertCircle size={17} /><span>{error}</span>
            <button onClick={loadItems}><RefreshCw size={14} /> Retry</button>
          </div>
        )}

        <Outlet />
        <Footer />
      </main>
      <ModalHost />
    </div>
  );
}
