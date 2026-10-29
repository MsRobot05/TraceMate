import { useState } from 'react';
import { X, Sparkles, Send, Bot, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';
import { request } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

const prompts = ['Black headphones near library', 'Blue bottle around sports ground', 'Wallet lost near canteen'];

export default function AssistantModal() {
  const { closeModal, demoMode } = useApp();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function ask(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await request('/ai/recovery-assistant', { method: 'POST', body: JSON.stringify({ query }) }));
    } catch (err) {
      setError(demoMode ? 'Connect the Express API and MongoDB to search real community reports.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <section className="modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow"><Sparkles size={13} /> TRACEMATE INTELLIGENCE</div>
            <h2 id="ai-title">AI Recovery Assistant</h2>
            <p>Describe what you lost or found. I’ll search public campus reports and explain why a result may match.</p>
          </div>
          <button className="icon-button" onClick={closeModal} aria-label="Close"><X /></button>
        </div>
        <div className="ai-prompt-chips">
          {prompts.map((q) => <button key={q} className="button button-soft" onClick={() => setQuery(q)}>{q}</button>)}
        </div>
        <form className="ai-query-form" onSubmit={ask}>
          <label className="sr-only" htmlFor="ai-query">Describe the item</label>
          <textarea id="ai-query" required minLength="5" maxLength="500" rows="3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Example: I lost a navy blue water bottle near the library yesterday…" />
          <button disabled={busy || query.trim().length < 5} className="button button-primary" type="submit">
            {busy ? <><span className="spinner" /> Searching…</> : <><Send size={15} /> Find possible matches</>}
          </button>
        </form>
        {error && <div className="form-error">{error}</div>}
        {result && (
          <div className="ai-results">
            <div className="ai-answer">
              <div className="ai-answer-icon"><Bot size={20} /></div>
              <div><strong>Recovery insight</strong><p>{result.assistantMessage}</p><small>Engine: {result.provider}</small></div>
            </div>
            {result.matches?.length > 0 && (
              <>
                <h3>Possible matches</h3>
                {result.matches.map((m) => (
                  <article className="ai-match-card" key={m._id}>
                    <div className="ai-match-top"><span className={`type-pill ${m.type}`}>{m.type} · {m.category}</span><strong>{m.score}% similarity</strong></div>
                    <h4>{m.title}</h4>
                    <p>{m.description}</p>
                    <div className="item-meta"><span><MapPin size={14} />{m.location}</span><span>{m.status || 'open'}</span></div>
                    <div className="ai-reasons">{m.reasons.map((r) => <span key={r}><CheckCircle2 size={13} />{r}</span>)}</div>
                  </article>
                ))}
              </>
            )}
            {result.disclaimer && <div className="privacy-note"><ShieldCheck size={16} /><span>{result.disclaimer}</span></div>}
          </div>
        )}
        <div className="modal-actions"><button className="button button-outline" onClick={closeModal}>Close assistant</button></div>
      </section>
    </div>
  );
}
