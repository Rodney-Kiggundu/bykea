import { Link, useNavigate } from 'react-router-dom';
import CarIcon from '../components/icons/CarIcon';
import './requestFlow.css';

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

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconCar() {
  return <CarIcon size={24} />;
}

function IconBag() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <path
        d="M6 7h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

const OPTIONS = [
  {
    id: 'delivery',
    title: 'Delivery',
    hint: 'Send a parcel or package',
    Icon: IconBox,
    to: '/request-delivery',
  },
  {
    id: 'taxi',
    title: 'Taxi',
    hint: 'Book a ride',
    Icon: IconCar,
    to: '/book-ride',
  },
  {
    id: 'shop',
    title: 'Shop',
    hint: 'Browse shops and order',
    Icon: IconBag,
    to: '/shops',
  },
];

export default function RequestServiceChoicePage() {
  const navigate = useNavigate();

  return (
    <div className="flow-screen">
      <div className="flow-topbar">
        <Link to="/home" className="flow-back" aria-label="Back to home">
          <BackArrow />
        </Link>
        <h1 className="flow-topbar__title">Request</h1>
        <span className="flow-topbar__spacer" aria-hidden />
      </div>

      <div className="rsc-body">
        <p className="rsc-lead">What would you like?</p>
        <div className="rsc-list" role="list">
          {OPTIONS.map(({ id, title, hint, Icon, to }) => (
            <button
              key={id}
              type="button"
              className="rsc-row"
              onClick={() => navigate(to)}
              role="listitem"
            >
              <span className="rsc-row__ic" aria-hidden>
                <Icon />
              </span>
              <span className="rsc-row__txt">
                <span className="rsc-row__title">{title}</span>
                <span className="rsc-row__hint">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
