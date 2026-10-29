import { useEffect, useState } from 'react';
import { X, Save, ShieldCheck } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function ProfileModal() {
  const { user, updateUser, closeModal, notify } = useApp();
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '', program: user?.program || '', year: user?.year || '', bio: user?.bio || '', campus: user?.campus || 'MIT-WPU, Pune' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load the latest saved profile from the server.
  useEffect(() => {
    request('/auth/me')
      .then(({ user: u }) => setProfile({ name: u.name || '', phone: u.phone || '', program: u.program || '', year: u.year || '', bio: u.bio || '', campus: u.campus || 'MIT-WPU, Pune' }))
      .catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await request('/auth/profile', { method: 'PATCH', body: JSON.stringify(profile) });
      updateUser(data.user);
      closeModal();
      notify('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">YOUR ACCOUNT</div>
            <h2 id="profile-title">Student profile</h2>
            <p>Keep your recovery contact and campus details up to date.</p>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="Close"><X /></button>
        </div>
        <form className="report-form" onSubmit={save}>
          <label>Full name *<input required minLength="2" maxLength="80" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
          <label>Email address<input value={user?.email || ''} disabled /><small>Email changes are disabled in this version.</small></label>
          <div className="form-two">
            <label>Phone number (private)<input type="tel" inputMode="tel" maxLength="20" pattern="[+0-9\s\(\)\-]{7,20}" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
            <label>Study year
              <select value={profile.year} onChange={(e) => setProfile({ ...profile, year: e.target.value })}>
                <option value="">Select year</option>
                {['1st year', '2nd year', '3rd year', '4th year', 'Postgraduate', 'Other'].map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <label>Course / program<input maxLength="100" value={profile.program} onChange={(e) => setProfile({ ...profile, program: e.target.value })} placeholder="e.g. MCA" /></label>
          <label>Campus<input maxLength="100" value={profile.campus} onChange={(e) => setProfile({ ...profile, campus: e.target.value })} placeholder="MIT-WPU, Pune" /></label>
          <label>About me (optional)<textarea rows="3" maxLength="240" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="A short introduction (no student ID or sensitive details)." /></label>
          <div className="privacy-note"><ShieldCheck size={17} /><span>Your phone number is stored in your account and is not included in public item listings.</span></div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={closeModal}>Cancel</button>
            <button disabled={saving} className="button button-primary" type="submit"><Save size={15} />{saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
