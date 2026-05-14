import './legal.css';

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: May 2, 2026</p>

        <section className="legal-section">
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly, such as name, phone number, and
            email, plus order and location details required for services.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Data</h2>
          <p>
            Data is used to provide deliveries, improve service quality, process payments, and
            send important account or order notifications.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Data Sharing</h2>
          <p>
            We share only necessary data with drivers, vendors, and trusted payment or support
            partners to complete your requests.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Data Security</h2>
          <p>
            We apply reasonable safeguards to protect your information. No system is fully
            secure, but we continuously improve security controls.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Your Rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data, subject to
            legal and operational requirements.
          </p>
        </section>
      </div>
    </main>
  );
}
