import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import { timeAgo } from '../utils.js';

const POLL_MS = 30000;

/** In-app notifications (claims, match alerts, moderation). Polls the API while signed in. */
export default function NotificationBell() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [unread, setUnread] = useState(0);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await request('/notifications');
      setList(d.notifications || []);
      setUnread(d.unread || 0);
    } catch { /* the bell stays quiet if the API is unreachable */ }
  }, []);

  useEffect(() => {
    if (!user) { setList([]); setUnread(0); return undefined; }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [user, load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) return null;

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      try { await request(`/notifications/${n._id}/read`, { method: 'PATCH' }); } catch { /* ignore */ }
      load();
    }
    navigate(n.link || '/my');
  }

  async function readAll() {
    try { await request('/notifications/read-all', { method: 'PATCH' }); } catch { /* ignore */ }
    load();
  }

  return (
    <div className="bell" ref={box}>
      <button className="icon-button bell-button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="menu">
          <div className="bell-head">
            <strong>Notifications</strong>
            <button className="link-button" onClick={readAll} disabled={!unread}><CheckCheck size={14} /> Mark all read</button>
          </div>
          {list.length ? list.map((n) => (
            <button key={n._id} role="menuitem" className={n.read ? 'bell-item' : 'bell-item unread'} onClick={() => openItem(n)}>
              <span className="bell-title">{n.title}</span>
              <span className="bell-body">{n.body}</span>
              <span className="bell-time">{timeAgo(n.createdAt)}</span>
            </button>
          )) : <p className="bell-empty">You are all caught up. Claim updates and match alerts show up here.</p>}
        </div>
      )}
    </div>
  );
}
