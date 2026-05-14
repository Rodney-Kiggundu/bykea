import './adminPortal.css';

export default function AdminPlaceholderPage({ title, description }) {
  return (
    <div className="adm">
      <section className="admCard">
        <div className="admSectionHeader">
          <h2>{title}</h2>
        </div>
        <p className="admDim" style={{ fontSize: '0.92rem' }}>
          {description || `${title} screen is ready for detailed module integration.`}
        </p>
      </section>
    </div>
  );
}
