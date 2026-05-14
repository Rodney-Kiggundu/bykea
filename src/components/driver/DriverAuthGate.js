import { Navigate, useLocation } from 'react-router-dom';
import { isDriverSignedIn } from '../../lib/driverSession';

/** Use around driver pages that are not under `DriverLayout`. */
export default function DriverAuthGate({ children }) {
  const location = useLocation();
  if (!isDriverSignedIn()) {
    return <Navigate to="/driver/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
