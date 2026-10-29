import { useRef, useState } from 'react';
import { X, ShieldCheck, Sparkles, ArrowUpRight, ImagePlus, Trash2 } from 'lucide-react';
import { request, uploadPhoto, photoUrl } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import { categories, campusLocations, safeMeetingPoints, makeEmptyForm } from '../constants.js';

const MAX_PHOTOS = 3;

function formFromItem(item) {
  const base = makeEmptyForm();
  if (!item) return base;
  return {
    ...base,
    title: item.title || '', type: item.type || 'lost', category: item.category || 'Electronics',
    description: item.description || '', location: item.location || '',
    date: new Date(item.date || item.createdAt || Date.now()).toISOString().slice(0, 10),
    contactName: item.contactName || '', contactEmail: item.contactEmail || '', contactPhone: item.contactPhone || '',
    safeMeetingPoint: item.safeMeetingPoint || base.safeMeetingPoint,
    photos: item.photos || []
  };
}

export default function ReportFormModal({ item }) {
  const { closeModal, notify, loadItems, demoMode } = useApp();
  const editing = Boolean(item);
  const [form, setForm] = useState(() => formFromItem(item));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [aiNote, setAiNote] = useState('');
  const fileRef = useRef(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (demoMode) throw new Error('Connect MongoDB and the API before saving reports. Sample mode is read-only.');
      if (editing) await request(`/items/${item._id}`, { method: 'PATCH', body: JSON.stringify(form) });
      else await request('/items', { method: 'POST', body: JSON.stringify(form) });
      closeModal();
      notify(editing ? 'Report updated successfully.' : 'Report created successfully.');
      await loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (form.photos.length >= MAX_PHOTOS) { setError(`You can attach up to ${MAX_PHOTOS} photos.`); return; }
    setUploading(true);
    setError('');
    try {
      const photo = await uploadPhoto(file);
      setForm((f) => ({ ...f, photos: [...f.photos, { url: photo.url, originalName: photo.originalName }] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function improveDescription() {
    setAiNote('');
    try {
      const d = await request('/ai/assist', { method: 'POST', body: JSON.stringify({ description: form.description }) });
      setForm((f) => ({ ...f, description: d.suggestion }));
      setAiNote(d.fallback ? 'Local AI fallback cleaned the description.' : 'Gemini improved your description.');
    } catch (err) {
      setAiNote(err.message);
    }
  }

  async function analyse() {
    setAiNote('');
    try {
      const d = await request('/ai/analyze', { method: 'POST', body: JSON.stringify({ title: form.title, description: form.description }) });
      setForm((f) => ({ ...f, title: f.title || d.title, category: d.category }));
      setAiNote(`AI helper suggests ${d.category}. ${d.tips.join(' ')} ${d.disclaimer}`);
    } catch (err) {
      setAiNote(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">COMMUNITY REPORT</div>
            <h2 id="form-title">{editing ? 'Edit report' : 'Create an item report'}</h2>
            <p>Share enough detail to identify the item, but keep private clues private.</p>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="Close"><X /></button>
        </div>
        <form className="report-form" onSubmit={save}>
          <div className="form-two">
            <label>Report type *
              <select value={form.type} onChange={set('type')}>
                <option value="lost">I lost an item</option>
                <option value="found">I found an item</option>
              </select>
            </label>
            <label>Category *
              <select value={form.category} onChange={set('category')}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
          </div>
          <label>Item name *
            <input required minLength="3" maxLength="100" value={form.title} onChange={set('title')} placeholder="e.g. Blue insulated water bottle" />
          </label>
          <label>Public description *
            <textarea required minLength="10" maxLength="1000" rows="3" value={form.description} onChange={set('description')} placeholder="Describe visible features. Avoid serial numbers or private identifying details." />
            <div className="inline-actions">
              <button type="button" className="button button-soft" onClick={improveDescription}><Sparkles size={15} /> Improve description with AI</button>
              <button type="button" className="button button-soft" onClick={analyse}><Sparkles size={15} /> Analyse report &amp; suggest category</button>
            </div>
            {aiNote && <small className="ai-note">{aiNote}</small>}
          </label>

          <div className="photo-field">
            <span className="field-label">Photos (optional, up to {MAX_PHOTOS})</span>
            <div className="photo-grid">
              {form.photos.map((p, index) => (
                <div className="photo-thumb" key={p.url}>
                  <img src={photoUrl(p)} alt={p.originalName || `Photo ${index + 1}`} />
                  <button type="button" className="photo-remove" aria-label="Remove photo" onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((x) => x.url !== p.url) }))}><Trash2 size={14} /></button>
                </div>
              ))}
              {form.photos.length < MAX_PHOTOS && (
                <button type="button" className="photo-add" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={20} /><span>{uploading ? 'Uploading…' : 'Add photo'}</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={addPhoto} />
            <small>JPEG, PNG or WebP, up to 5 MB. Do not photograph ID numbers or private details.</small>
          </div>

          <div className="form-two">
            <label>MIT-WPU campus location *
              <input required list="mitwpu-locations" maxLength="120" value={form.location} onChange={set('location')} placeholder="Choose or type a campus location" />
              <datalist id="mitwpu-locations">{campusLocations.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
            <label>Date *<input required type="date" value={form.date} onChange={set('date')} /></label>
          </div>
          <div className="form-two">
            <label>Your name (optional)<input maxLength="80" value={form.contactName} onChange={set('contactName')} placeholder="Name for recovery contact" /></label>
            <label>Contact email (optional)<input type="email" maxLength="160" value={form.contactEmail} onChange={set('contactEmail')} placeholder="you@example.com" /></label>
          </div>
          <div className="form-two">
            <label>Phone number (optional)
              <input type="tel" inputMode="tel" maxLength="20" value={form.contactPhone} onChange={set('contactPhone')} placeholder="e.g. +91 98765 43210" pattern="[+0-9\s\(\)\-]{7,20}" />
              <small>Private: shared only with a claimant you approve.</small>
            </label>
            <label>Suggested safe handover point
              <select value={form.safeMeetingPoint} onChange={set('safeMeetingPoint')}>{safeMeetingPoints.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
          </div>
          <div className="privacy-note"><ShieldCheck size={17} /><span>Reports are linked to your account. Phone, email and contact name stay private until you approve a claim. Meet at a staffed public point; never share student ID numbers publicly.</span></div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={closeModal}>Cancel</button>
            <button disabled={saving || uploading} className="button button-primary" type="submit">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish report'} <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
