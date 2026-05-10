import { Outlet, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import Sidebar from '../components/sidebar/Sidebar.jsx';
import './DashboardLayout.css';

const DashboardLayout = () => {
  const mainContentRef = useRef(null);
  const { pathname } = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prevState => !prevState);
  };

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  const layoutClassName = `dashboard-layout`;

  return (
    <div className={layoutClassName}>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      <main className="main-content" ref={mainContentRef}>
        <Outlet />
        {/* ChatWidget buradaki zombi halinden kurtarıldı! */}
      </main>
    </div>
  );
};

export default DashboardLayout;