import React, { useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { Users, Receipt, UsersRound, BarChart3, TrendingUp, Link2, ChevronLeft, ChevronRight, ScatterChart } from 'lucide-react';
import './Layout.css';

const navItems = [
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/expenses', label: 'Expenses', icon: Receipt },
  { path: '/team', label: 'Team', icon: UsersRound },
  { path: '/pnl', label: 'P&L Summary', icon: BarChart3 },
  { path: '/forecast', label: 'Revenue Forecast', icon: TrendingUp },
  { path: '/scaling', label: 'Sales Scaling', icon: ScatterChart },
  { path: '/integrations', label: 'Integrations', icon: Link2 },
];

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Layout({ children }) {
  const { exchangeRate, currentMonth, setCurrentMonth, currentYear, setCurrentYear } = useContext(AppContext);

  const goMonth = (dir) => {
    let m = parseInt(currentMonth) + dir;
    let y = parseInt(currentYear);
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setCurrentMonth(String(m).padStart(2, '0'));
    setCurrentYear(String(y));
  };

  const monthLabel = `${MONTH_LABELS[parseInt(currentMonth) - 1]} ${currentYear}`;

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

            {/* Exchange rate */}
            <div className="topbar-rate">
              <span>1 USD = ₹</span>
              <span className="rate-value">{exchangeRate}</span>
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
          {children}
        </main>
      </div>
    </div>
  );
}
