import React, { useContext } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { AuthContext } from '../../context/AuthContext';
import { getBaseRole } from '../../utils/helpers';
import { Users, Receipt, UsersRound, BarChart3, TrendingUp, Link2, ChevronLeft, ChevronRight, ScatterChart, UserCheck, LogOut, UserPlus, ClipboardList } from 'lucide-react';
import SecurityLayer from '../SecurityLayer/SecurityLayer';
import '../SecurityLayer/SecurityLayer.css';
import './Layout.css';

const allNavItems = [
  { path: '/clients', label: 'Clients', icon: Users, roles: ['admin', 'pm_editor'] },
  { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'hr_editor'] },
  { path: '/team', label: 'Team', icon: UsersRound, roles: ['admin', 'hr_editor'] },
  { path: '/pnl', label: 'P&L Summary', icon: BarChart3, roles: ['admin'] },
  { path: '/retention', label: 'PM Retention', icon: UserCheck, roles: ['admin'] },
  { path: '/forecast', label: 'Revenue Forecast', icon: TrendingUp, roles: ['admin'] },
  { path: '/scaling', label: 'Sales Scaling', icon: ScatterChart, roles: ['admin', 'hr_editor'] },
  { path: '/integrations', label: 'Integrations', icon: Link2, roles: ['admin', 'hr_editor', 'pm_editor'] },
  { path: '/client-pm', label: 'Client-PM', icon: UserPlus, roles: ['admin'] },
  { path: '/audit-log', label: 'Audit Log', icon: ClipboardList, roles: ['admin'] },
];

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Layout({ children }) {
  const { currentMonth, setCurrentMonth, currentYear, setCurrentYear } = useContext(AppContext);
  const { userRole, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const baseRole = getBaseRole(userRole);
  const navItems = allNavItems.filter(item => item.roles.includes(baseRole));

  const goMonth = (dir) => {
    let m = parseInt(currentMonth) + dir;
    let y = parseInt(currentYear);
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setCurrentMonth(String(m).padStart(2, '0'));
    setCurrentYear(String(y));
  };

  const monthLabel = `${MONTH_LABELS[parseInt(currentMonth) - 1]} ${currentYear}`;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-wrap">
            <BarChart3 size={18} />
          </div>
          <span className="brand-text">ProfitPilot</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left"></div>
          <div className="topbar-right">
            {/* Currency selector */}
            <div className="topbar-currency">
              <span className="currency-label">USD</span>
            </div>

            {/* Month nav */}
            <div className="month-nav">
              <button className="month-arrow" onClick={() => goMonth(-1)}>
                <ChevronLeft size={18} />
              </button>
              <span className="month-label">{monthLabel}</span>
              <button className="month-arrow" onClick={() => goMonth(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <SecurityLayer>
            {children}
          </SecurityLayer>
        </main>
      </div>
    </div>
  );
}
