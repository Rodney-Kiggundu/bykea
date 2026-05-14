import { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  clearShopOwnerSession,
  getShopOwnerSession,
  isShopOwnerSignedIn,
} from '../../lib/shopOwnerAuth';
import '../../pages/shopOwnerPortal.css';

function Ic({ children }) {
  return (
    <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
      {children}
    </span>
  );
}
function IcHome({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-7H9v7H5a1 1 0 0 1-1-1v-9.5Z"
          stroke={c}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </Ic>
  );
}
function IcBox({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <rect x="4" y="5" width="16" height="14" rx="1" stroke={c} strokeWidth="1.3" fill="none" />
        <path d="M4 9.5h16" stroke={c} strokeWidth="1" />
      </svg>
    </Ic>
  );
}
function IcTag2({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M4.5 5.5L12 3.5l7.5 2v12.5a1.2 1.2 0 0 1-1.2 1.2H5.7A1.2 1.2 0 0 1 4.5 18V5.5Z"
          stroke={c}
          strokeWidth="1.2"
          fill="none"
        />
        <path d="M8.5 8.5h7" stroke={c} strokeWidth="1" />
      </svg>
    </Ic>
  );
}
function IcTruck({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M2 10h9v5H2V10Z M11 12h3l2.5 3H20v-2.5L18 10h-5M5.5 17.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z M16.5 17.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"
          stroke={c}
          strokeWidth="1.1"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    </Ic>
  );
}
function IcWallet({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="1" stroke={c} strokeWidth="1.2" fill="none" />
        <path d="M3 9.5h18" stroke={c} strokeWidth="1" />
        <circle cx="16" cy="12" r="0.6" fill={c} />
      </svg>
    </Ic>
  );
}
function IcChart({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path d="M4 20V5M4 20h16" stroke={c} strokeWidth="1.1" />
        <rect x="6" y="12" width="2.5" height="5" fill={c} />
        <rect x="10" y="9" width="2.5" height="8" fill={c} />
        <rect x="14" y="11" width="2.5" height="6" fill={c} />
      </svg>
    </Ic>
  );
}
function IcGear({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M12 8.2a3.8 3.8 0 0 0 0 7.6M8.2 12H4.5M19.5 12H16M12 4.5v-2M12 19.5v-2M15.5 6.5l1.2-1.2M6.3 16.5l-1.2 1.2M15.5 15.5l1.2 1.2M6.3 5.3L5.1 6.5"
          stroke={c}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2.2" stroke={c} strokeWidth="1.1" fill="none" />
      </svg>
    </Ic>
  );
}
function IcChat({ on }) {
  const c = on ? '#fff' : '#333';
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-4.2 3.1c-.5.4-1.2 0-.9-.7l1-2.4H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5Z"
          stroke={c}
          strokeWidth="1.2"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </Ic>
  );
}
function IcDoor() {
  return (
    <Ic>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M8 3h9a1 1 0 0 1 1 1v16H8V3Z M4 5v14h3 M15 12h.1"
          stroke="#c62828"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </Ic>
  );
}
function IcHamb() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
const nav = [
  { to: '/shop-owner/dashboard', label: 'Dashboard', Icon: IcHome, end: true },
  { to: '/shop-owner/orders', label: 'Orders', Icon: IcBox },
  { to: '/shop-owner/delivery-driver', label: 'Delivery driver', Icon: IcTruck },
  { to: '/shop-owner/products', label: 'Products', Icon: IcTag2 },
  { to: '/shop-owner/payments', label: 'Payments', Icon: IcWallet },
  { to: '/shop-owner/analytics', label: 'Analytics', Icon: IcChart },
  { to: '/shop-owner/chat', label: 'Chat', Icon: IcChat },
  { to: '/shop-owner/profile', label: 'Profile & Settings', Icon: IcGear },
];

export default function ShopOwnerLayout() {
  const [sbOpen, setSbOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();

  if (!isShopOwnerSignedIn()) {
    return <Navigate to="/shop-owner/login" replace state={{ from: loc }} />;
  }

  const closeSb = () => setSbOpen(false);
  const logout = () => {
    clearShopOwnerSession();
    navigate('/shop-owner/login', { replace: true });
  };

  const profile = getShopOwnerSession();
  const shopLabel = profile?.business_name?.trim() || 'Your shop';
  const shopInitial = (shopLabel.charAt(0) || 'S').toUpperCase();

  return (
    <div className="sop sopShell">
      {sbOpen && (
        <div className="sopOvl sopOvl--on" onClick={closeSb} role="presentation" aria-hidden />
      )}
      <aside className={sbOpen ? 'sopSb sopSb--open' : 'sopSb'}>
        <NavLink to="/shop-owner/dashboard" className="sopSbL" onClick={closeSb}>
          InGo
        </NavLink>
        <div className="sopSbPro">
          <div className="sopSbAv" aria-hidden>
            {shopInitial}
          </div>
          <div>
            <div className="sopSbNm">{shopLabel}</div>
          </div>
        </div>
        <nav className="sopNav" aria-label="Shop owner">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={!!end}
              className={({ isActive }) => (isActive ? 'sopNav--on' : '')}
              onClick={closeSb}
            >
              {({ isActive }) => (
                <>
                  <Icon on={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <button type="button" className="sopNav--lo" onClick={logout}>
            <IcDoor />
            Logout
          </button>
        </nav>
      </aside>
      <div className="sopMain">
        <header className="sopTop">
          <button type="button" className="sopHamb" aria-label="Open menu" onClick={() => setSbOpen((o) => !o)}>
            <IcHamb />
          </button>
          <h1 className="sopGreet">
            Hy {shopLabel}
          </h1>
        </header>
        <div className="sopCont">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
