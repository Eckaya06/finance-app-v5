import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Sidebar.css';

import { FiHome, FiRepeat, FiPieChart, FiBox, FiClipboard, FiChevronsLeft, FiChevronsRight, FiPlusCircle, FiSettings, FiBarChart2, FiTrendingUp } from 'react-icons/fi';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const { t } = useTranslation();

  const sidebarClassName = `sidebar ${isCollapsed ? 'collapsed' : ''}`;

  const menuItems = [
    { name: t('sidebar.overview'), path: '/home', icon: <FiHome size={20} /> },
    { name: t('sidebar.incomeExpense'), icon: <FiPlusCircle size={20} />, path: '/income-expense' },
    { name: t('sidebar.transactions'), path: '/transactions', icon: <FiRepeat size={20} /> },
    { name: t('sidebar.budgets'), path: '/budgets', icon: <FiPieChart size={20} /> },
    { name: t('sidebar.analytics'), path: '/analytics', icon: <FiBarChart2 size={20} /> },
    { name: t('sidebar.portfolio'), path: '/portfolio', icon: <FiTrendingUp size={20} /> },
    { name: t('sidebar.pots'), path: '/pots', icon: <FiBox size={20} /> },
    { name: t('sidebar.recurringBills'), path: '/bills', icon: <FiClipboard size={20} /> },
    { name: t('sidebar.settings'), path: '/settings', icon: <FiSettings size={20} /> },
  ];

  return (
    <aside className={sidebarClassName}>
      <div className="sidebar-logo">
        <h2 className="logo-text">{isCollapsed ? 'f' : t('sidebar.logo')}</h2>
      </div>
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink to={item.path} title={item.name}>
                <span className="nav-icon">{item.icon}</span>
                {!isCollapsed && <span className="nav-text">{item.name}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <button className="minimize-btn" onClick={onToggle} title={isCollapsed ? t('sidebar.expandMenu') : t('sidebar.minimizeMenu')}>
          {isCollapsed ? <FiChevronsRight size={20} /> : <FiChevronsLeft size={20} />}
          {!isCollapsed && <span>{t('sidebar.minimizeMenu')}</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
