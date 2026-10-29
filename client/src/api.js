// Central API helper used by every page and component.
export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SERVER = API.replace(/\/api\/?$/, '');
const TOKEN_KEY = 'tracemate_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach the TraceMate server. Is the API running?');
  }

  const data = await response.json().catch(() => ({ message: 'The server returned an unreadable response.' }));

  if (response.status === 401 && token && !path.startsWith('/auth/login')) {
    window.dispatchEvent(new Event('tracemate:unauthorized'));
  }
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function uploadPhoto(file) {
  const token = getToken();
  const body = new FormData();
  body.append('photo', file);
  let response;
  try {
    response = await fetch(`${API}/uploads`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error('Cannot reach the TraceMate server. Is the API running?');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Image upload failed.');
  return data.photo;
}

export const photoUrl = (photo) => (photo?.url?.startsWith('http') ? photo.url : `${SERVER}${photo?.url || ''}`);
