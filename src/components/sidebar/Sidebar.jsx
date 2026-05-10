import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Sidebar.css';

import { FiHome, FiRepeat, FiPieChart, FiBox, FiClipboard, FiChevronsLeft, FiChevronsRight, FiPlusCircle, FiSettings, FiBarChart2, FiTrendingUp } from 'react-icons/fi';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const { t } = useTranslation();

  const sidebarClassName = `sidebar ${isCollapsed ? 'collapsed' : ''}`;

  // Sidebar artık üç bölüme ayrılmış halde render edilir:
  //  1) Üst (kategorisiz): Overview + Analytics
  //  2) SPENDING & TRACKING: Gelir/Gider, İşlemler, Bütçeler, Tekrarlayan Faturalar
  //  3) ASSETS: Kumbaralar, Portföy, Ayarlar
  // Daraltılmış (collapsed) modda kategori başlıkları gizlenir.
  const navGroups = [
    {
      key: 'top',
      title: null,
      items: [
        { name: t('sidebar.overview'), path: '/home', icon: <FiHome size={20} /> },
        { name: t('sidebar.analytics'), path: '/analytics', icon: <FiBarChart2 size={20} /> },
      ],
    },
    {
      key: 'spending',
      title: t('sidebar.groupSpending'),
      items: [
        { name: t('sidebar.incomeExpense'), path: '/income-expense', icon: <FiPlusCircle size={20} /> },
        { name: t('sidebar.transactions'), path: '/transactions', icon: <FiRepeat size={20} /> },
        { name: t('sidebar.budgets'), path: '/budgets', icon: <FiPieChart size={20} /> },
        { name: t('sidebar.recurringBills'), path: '/bills', icon: <FiClipboard size={20} /> },
      ],
    },
    {
      key: 'assets',
      title: t('sidebar.groupAssets'),
      items: [
        { name: t('sidebar.pots'), path: '/pots', icon: <FiBox size={20} /> },
        { name: t('sidebar.portfolio'), path: '/portfolio', icon: <FiTrendingUp size={20} /> },
        { name: t('sidebar.settings'), path: '/settings', icon: <FiSettings size={20} /> },
      ],
    },
  ];

  return (
    <aside className={sidebarClassName}>
      <div className="sidebar-logo">
        <h2 className="logo-text">{isCollapsed ? 'f' : t('sidebar.logo')}</h2>
      </div>
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.key} className="nav-group">
            {/* Başlığı her zaman DOM'da tut; collapsed iken CSS ile büzüştür.
                Koşullu render edersek expand sırasında ani layout shift olur
                ve alttaki item'lar zıplar gibi görünür. */}
            {group.title && (
              <span className="nav-group-title">{group.title}</span>
            )}
            <ul className="nav-list">
              {group.items.map((item) => (
                <li key={item.path} className="nav-item">
                  <NavLink to={item.path} title={item.name}>
                    <span className="nav-icon">{item.icon}</span>
                    {/* Span her zaman DOM'da; collapsed iken CSS ile gizleniyor.
                        Koşullu render edersek mount/unmount sırasında flex
                        sıkışmasından dolayı yazılar üst üste biner. */}
                    <span className="nav-text">{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="minimize-btn" onClick={onToggle} title={isCollapsed ? t('sidebar.expandMenu') : t('sidebar.minimizeMenu')}>
          {isCollapsed ? <FiChevronsRight size={20} /> : <FiChevronsLeft size={20} />}
          <span>{t('sidebar.minimizeMenu')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
