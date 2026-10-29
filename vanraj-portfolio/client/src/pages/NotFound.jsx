import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section container" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', paddingTop: 'var(--nav-height)' }}>
      <h1 style={{ color: 'var(--color-accent)' }}>404</h1>
      <p>This page doesn&apos;t exist.</p>
      <Link to="/" className="btn btn-primary">
        Back to Home
      </Link>
    </section>
  );
}
