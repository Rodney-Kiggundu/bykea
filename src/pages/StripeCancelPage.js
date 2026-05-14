import { Link } from 'react-router-dom';

export default function StripeCancelPage() {
  return (
    <div style={{ padding: '1.25rem', maxWidth: 520, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem' }}>Payment cancelled</h1>
      <p style={{ margin: '0 0 0.75rem', color: '#444' }}>You left checkout without paying. No charge was made.</p>
      <p style={{ margin: 0 }}>
        <Link to="/">Home</Link>
      </p>
    </div>
  );
}
