import { ShieldCheck, CheckCircle2, MapPin } from 'lucide-react';

export default function SafeRecovery() {
  return (
    <section className="safe-page">
      <div className="eyebrow">PRIVACY BY DESIGN</div>
      <h1>Recovery should be safe and simple.</h1>
      <p className="page-lead">Reconnect belongings without exposing private information in public reports.</p>
      <div className="safe-grid">
        <div className="safe-card"><div className="safe-icon"><ShieldCheck /></div><h3>Keep details private</h3><p>Do not publish student ID numbers, addresses, phone numbers, or other sensitive details in item descriptions. Contact details on a report stay hidden until you approve a claim.</p></div>
        <div className="safe-card"><div className="safe-icon"><CheckCircle2 /></div><h3>Verify ownership</h3><p>Claimants submit a private proof that only the report owner can read. Ask for a detail that is not visible in the public report before approving.</p></div>
        <div className="safe-card"><div className="safe-icon"><MapPin /></div><h3>Meet in a safe place</h3><p>Use a campus help desk or staffed public location. Involve campus security if an item is valuable or a situation feels unsafe.</p></div>
      </div>
      <div className="safety-callout">
        <ShieldCheck />
        <div>
          <strong>Proof-of-concept limitation</strong>
          <p>Accounts use email and password only. TraceMate does not verify student identity, so confirm ownership yourself and never rely on suggested matches alone.</p>
        </div>
      </div>
    </section>
  );
}
