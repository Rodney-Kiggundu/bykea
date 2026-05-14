import { Link } from 'react-router-dom';
import './legal.css';

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 18.5L8.5 12l7-7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ITEMS = [
  {
    q: 'How do I place a delivery?',
    a: 'From Home, choose Request Delivery, enter pickup and drop-off, then follow the steps to confirm package details and payment.',
  },
  {
    q: 'How do I track my order?',
    a: 'Open Orders to see status, or use Live Tracking when your rider is on the way (when available for that order).',
  },
  {
    q: 'Which payment methods are supported?',
    a: 'Supported options are shown at checkout. This demo may show card and cash placeholders depending on the flow.',
  },
  {
    q: 'How do I update my profile?',
    a: 'Go to Profile, tap Edit Profile, change your details, and save. Your updates are stored on your account.',
  },
  {
    q: 'I can’t log in — what should I check?',
    a: 'Use the same email and password you registered with. If you recently registered, confirm your email has no typos. You can register again only with a different email if the account already exists.',
  },
  {
    q: 'Who do I contact for help?',
    a: 'Visit Help & Support from your profile for email, phone, and other options.',
  },
];

export default function FAQsPage() {
  return (
    <main className="legal-page">
      <div className="legal-card legal-card--pad-top">
        <header className="legal-top">
          <Link to="/profile" className="legal-back" aria-label="Back to profile">
            <BackArrow />
          </Link>
          <h1 className="legal-top__title">FAQs</h1>
          <span className="legal-top__spacer" aria-hidden />
        </header>

        <p className="legal-lead">Common questions about using InGo.</p>

        <div className="legal-faq-list">
          {ITEMS.map(({ q, a }) => (
            <details key={q} className="legal-faq">
              <summary className="legal-faq__q">{q}</summary>
              <p className="legal-faq__a">{a}</p>
            </details>
          ))}
        </div>

        <p className="legal-footnote">
          Still stuck?{' '}
          <Link to="/help-support" className="legal-inline-link">
            Help &amp; Support
          </Link>
        </p>
      </div>
    </main>
  );
}
