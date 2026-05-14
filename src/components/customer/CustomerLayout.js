import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import './CustomerApp.css';

export default function CustomerLayout() {
  return (
    <div className="customer-app">
      <div className="customer-app__outlet">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
