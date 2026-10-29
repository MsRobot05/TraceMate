import { Link } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="empty-state" style={{ marginTop: 40 }}>
      <PackageSearch size={32} /><h3>Page not found</h3><p>That page does not exist.</p>
      <Link className="button button-primary" to="/">Back to overview</Link>
    </section>
  );
}
