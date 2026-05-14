import '../components/customer/CustomerApp.css';

export default function CustomerTabPlaceholder({ title, description }) {
  return (
    <div className="tab-surface" role="main">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
