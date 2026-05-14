import { NavLink, useLocation } from 'react-router-dom';
import './CustomerApp.css';

const active = '#F18631';
const inactive = '#6b6b6b';

function IconHome({ isOn }) {
  const c = isOn ? active : inactive;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconList({ isOn }) {
  const c = isOn ? active : inactive;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="3" rx="0.5" fill={c} />
      <rect x="4" y="10.5" width="12" height="3" rx="0.5" fill={c} />
      <rect x="4" y="16" width="16" height="3" rx="0.5" fill={c} />
    </svg>
  );
}

function IconShops({ isOn }) {
  const c = isOn ? active : inactive;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <path
        d="M4 10V8a2 2 0 0 1 2-2h2l1-2h6l1 2h2a2 2 0 0 1 2 2v2"
        stroke={c}
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M5 10h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9Z"
        stroke={c}
        strokeWidth="1.55"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M9 14h6" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconUser({ isOn }) {
  const c = isOn ? active : inactive;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <circle cx="12" cy="8.5" r="3.2" stroke={c} strokeWidth="1.6" fill="none" />
      <path
        d="M5.2 20.1c.8-2.4 2.6-3.5 6.8-3.5s5.8 1.1 6.6 3.2"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const items = [
  { to: '/home', end: true, label: 'Home', Icon: IconHome },
  { to: '/orders', label: 'Orders', Icon: IconList },
  { to: '/shops', label: 'Shops', Icon: IconShops },
  { to: '/profile', label: 'Profile', Icon: IconUser },
];

export default function BottomNav() {
  const location = useLocation();

  const onSupportChat = location.pathname === '/chat/support';

  return (
    <nav className="bnav" aria-label="Main">
      {items.map(({ to, end, label, Icon }) => {
        const profileExtra =
          to === '/profile' &&
          (location.pathname.startsWith('/profile') || onSupportChat);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => {
              const on = profileExtra ? true : isActive;
              return on ? 'bnav__item bnav__item--active' : 'bnav__item';
            }}
          >
            {({ isActive }) => {
              const on = profileExtra || isActive;
              return (
                <>
                  <span className="bnav__icon" aria-hidden>
                    <Icon isOn={on} />
                  </span>
                  <span className="bnav__label">{label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}
    </nav>
  );
}
