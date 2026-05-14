import { useState } from 'react';
import { Link } from 'react-router-dom';
import './shopOwnerPortal.css';

const FAQ = [
  {
    q: 'When do I get paid?',
    a: 'Payouts are processed on your schedule (weekly or bi-weekly). You can review pending and completed payouts under Payments.',
  },
  {
    q: 'A customer cancelled after I started prep.',
    a: 'If the order was already accepted, open a dispute from the order detail and our team will review timestamps and chat.',
  },
  {
    q: 'How do delivery requests work?',
    a: 'When an order needs a rider, it appears under Delivery requests. You can request a rider match; riders are assigned by the platform in production.',
  },
];

export default function ShopOwnerSupportPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    setSubject('');
    setMessage('');
    window.setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="sop">
      <div className="sopPageH">
        <h1>Support</h1>
      </div>
      <div className="sopCard" style={{ maxWidth: '32rem', marginBottom: '0.65rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 800 }}>Contact</h2>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b6b6b', lineHeight: 1.45 }}>
          Shop partner help:{' '}
          <a className="sopLink" href="mailto:shops@ingo.example">
            shops@ingo.example
          </a>
          <br />
          Urgent order issues: call <strong>0330 123 4567</strong> (UK demo).
        </p>
        <Link to="/shop-owner/support/chat" className="sopBtn2" style={{ marginTop: '0.55rem', display: 'inline-flex', textDecoration: 'none' }}>
          Open live chat
        </Link>
      </div>
      <div className="sopCard" style={{ maxWidth: '32rem', marginBottom: '0.65rem' }}>
        <h2 style={{ margin: '0 0 0.45rem', fontSize: '0.95rem', fontWeight: 800 }}>Common questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {FAQ.map((item) => (
            <details key={item.q} className="sopCard" style={{ padding: '0.5rem 0.55rem' }}>
              <summary style={{ fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>{item.q}</summary>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#555', lineHeight: 1.45 }}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
      <form className="sopCard sopPanForm" style={{ maxWidth: '32rem' }} onSubmit={submit}>
        <h2 style={{ margin: '0 0 0.45rem', fontSize: '0.95rem', fontWeight: 800 }}>Send a message</h2>
        {sent && (
          <p className="sopBdg sopBdg--d" role="status" style={{ margin: '0 0 0.5rem' }}>
            Thanks — your note was recorded (demo only).
          </p>
        )}
        <label className="sopL" htmlFor="so-supp-sub">
          Subject
        </label>
        <input id="so-supp-sub" className="sopI" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <label className="sopL" htmlFor="so-supp-msg">
          Message
        </label>
        <textarea id="so-supp-msg" value={message} onChange={(e) => setMessage(e.target.value)} required />
        <button type="submit" className="sopBtn2">
          Submit
        </button>
      </form>
    </div>
  );
}
