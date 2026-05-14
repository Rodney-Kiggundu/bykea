import { Link } from 'react-router-dom';
import './legal.css';

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <header className="legal-top">
          <Link to="/" className="legal-back" aria-label="Back to home">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15.5 18.5L8.5 12l7-7.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1 className="legal-top__title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            Terms &amp; Conditions
          </h1>
          <span className="legal-top__spacer" aria-hidden />
        </header>

        <p className="legal-updated">Last updated: May 2, 2026</p>

        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By using InGo, you agree to these Terms and all applicable local laws. If you do
            not agree, please do not use the app.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. User Accounts</h2>
          <p>
            You are responsible for keeping your account information accurate and secure. You
            must not share your credentials with others.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Service Usage</h2>
          <p>
            You agree to use the platform lawfully and respectfully. Any misuse, fraud, or
            abuse may result in account suspension.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Payments and Refunds</h2>
          <p>
            Charges are shown before confirmation where possible. Refund decisions depend on
            the order status and support review.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Limitation of Liability</h2>
          <p>
            InGo is provided on an as-available basis. We are not liable for indirect losses,
            delays, or interruptions beyond reasonable control.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Shop owners &amp; merchants</h2>
          <p>
            If you register a shop on InGo, you confirm your business details are accurate, you
            have the right to sell listed goods or services, and you will fulfil orders in line
            with displayed timings and pricing. We may suspend listings that breach these Terms,
            local law, or platform safety rules.
          </p>
        </section>

        <p className="legal-footnote">
          Questions? See{' '}
          <Link to="/help-support" className="legal-inline-link">
            Help &amp; support
          </Link>{' '}
          or{' '}
          <Link to="/privacy-policy" className="legal-inline-link">
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
