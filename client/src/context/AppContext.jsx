import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '../api.js';
import { demoItems } from '../constants.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('tracemate_user') || 'null');
  } catch {
    return null;
  }
}

/**
 * Global app state: signed-in user, shared report feed, notices and the active modal.
 * Pages and components read this through useApp().
 */
export function AppProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [notice, setNotice] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [modal, setModal] = useState(null); // { name, payload }

  const notify = useCallback((message) => setNotice(message), []);
  const openModal = useCallback((name, payload = null) => setModal({ name, payload }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/items');
      setItems(data.items || []);
      setDemoMode(false);
      setError('');
    } catch {
      setItems(demoItems);
      setDemoMode(true);
      setError('API not connected — showing sample reports. Start MongoDB and the Express server to save real reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const login = useCallback(async (data) => {
    localStorage.setItem('tracemate_token', data.token);
    localStorage.setItem('tracemate_user', JSON.stringify(data.user));
    setUser(data.user);
    await loadItems();
  }, [loadItems]);

  const updateUser = useCallback((nextUser) => {
    localStorage.setItem('tracemate_user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback((message = 'Signed out.') => {
    localStorage.removeItem('tracemate_token');
    localStorage.removeItem('tracemate_user');
    setUser(null);
    setNotice(message);
    loadItems();
  }, [loadItems]);

  // The API helper fires this event when a stored token is rejected (expired/invalid).
  useEffect(() => {
    const onUnauthorized = () => logout('Your session expired. Please sign in again.');
    window.addEventListener('tracemate:unauthorized', onUnauthorized);
    return () => window.removeEventListener('tracemate:unauthorized', onUnauthorized);
  }, [logout]);

  const requireLogin = useCallback((message) => {
    if (user) return true;
    setNotice(message);
    setModal({ name: 'auth', payload: null });
    return false;
  }, [user]);

  const openCreate = useCallback(() => {
    if (requireLogin('Please sign in or register before creating a report.')) openModal('report', null);
  }, [requireLogin, openModal]);

  const openEdit = useCallback((item) => {
    if (requireLogin('Sign in with the account that owns this report.')) openModal('report', item);
  }, [requireLogin, openModal]);

  const openClaim = useCallback((item) => {
    if (requireLogin('Sign in to submit a claim.')) openModal('claim', item);
  }, [requireLogin, openModal]);

  const value = useMemo(() => ({
    user, notice, items, loading, error, demoMode, modal,
    notify, setNotice, loadItems, login, logout, updateUser, requireLogin,
    openModal, closeModal, openCreate, openEdit, openClaim
  }), [user, notice, items, loading, error, demoMode, modal, notify, loadItems, login, logout, updateUser, requireLogin, openModal, closeModal, openCreate, openEdit, openClaim]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
