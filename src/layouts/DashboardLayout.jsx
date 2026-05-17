import { Outlet, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';
import Sidebar from '../components/sidebar/Sidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import './DashboardLayout.css';

/** ≤1024: drawer + hamburger | 1025–1280: daraltılmış sidebar | >1280: tam sidebar */
const DRAWER_BREAKPOINT = 1024;
const TABLET_BREAKPOINT = 1280;

const getLayoutMode = (width) => {
  if (width <= DRAWER_BREAKPOINT) return 'mobile';
  if (width <= TABLET_BREAKPOINT) return 'tablet';
  return 'desktop';
};

const DashboardLayout = () => {
  const mainContentRef = useRef(null);
  const { pathname } = useLocation();
  const { sidebarSide } = useTheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [layoutMode, setLayoutMode] = useState(() =>
    typeof window !== 'undefined' ? getLayoutMode(window.innerWidth) : 'desktop'
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const isMobile = layoutMode === 'mobile';
  const isTablet = layoutMode === 'tablet';
  const sidebarCollapsed = isMobile ? false : isSidebarCollapsed || isTablet;

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const toggleMobileDrawer = () => {
    setIsMobileDrawerOpen((prev) => !prev);
  };

  // Pencere boyutunu izle
  useEffect(() => {
    const onResize = () => {
      const mode = getLayoutMode(window.innerWidth);
      setLayoutMode(mode);
      if (mode !== 'mobile') setIsMobileDrawerOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sayfa değiştiğinde drawer'ı kapat ve scroll'u sıfırla
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  // Drawer açıkken body scroll kilidi
  useEffect(() => {
    if (isMobile && isMobileDrawerOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isMobile, isMobileDrawerOpen]);

  // Sidebar / drawer geçişlerinde Recharts ResponsiveContainer yeniden ölçsün
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 380);
    return () => window.clearTimeout(id);
  }, [isMobileDrawerOpen, isSidebarCollapsed, layoutMode]);

  const layoutClassName = [
    'dashboard-layout',
    `sidebar-${sidebarSide}`,
    isMobile ? 'is-mobile' : '',
    isTablet ? 'is-tablet' : '',
    isMobile && isMobileDrawerOpen ? 'drawer-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClassName}>
      {/* Mobil hamburger butonu */}
      {isMobile && (
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={toggleMobileDrawer}
          aria-label={isMobileDrawerOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        >
          {isMobileDrawerOpen ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      )}

      {/* Mobil overlay */}
      {isMobile && isMobileDrawerOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        isMobile={isMobile}
        onNavigate={() => {
          if (isMobile) setIsMobileDrawerOpen(false);
        }}
      />

      <main className="main-content" ref={mainContentRef}>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
