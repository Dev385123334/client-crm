import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Calendar, DollarSign, Filter, ChevronDown } from 'lucide-react';
import './FilterBar.css';

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', color: '#10b981' },
  { value: 'Paused', label: 'Paused', color: '#f59e0b' },
  { value: 'Cancelled', label: 'Cancelled', color: '#ef4444' },
];

export default function FilterBar({ records, filters, onFiltersChange }) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [showAmountPanel, setShowAmountPanel] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const searchRef = useRef(null);
  const barRef = useRef(null);
  const debounceRef = useRef(null);

  const datePanelRef = useRef(null);
  const amountPanelRef = useRef(null);
  const statusPanelRef = useRef(null);

  const activeCount = Object.values(filters).filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && v !== null && !Array.isArray(v))).length + (filters.search ? 1 : 0);
  const actualActive = (filters.search ? 1 : 0)
    + (filters.status && filters.status.length ? 1 : 0)
    + (filters.dateRange ? 1 : 0)
    + (filters.amount ? 1 : 0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(e.intersectionRatio < 1),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
    );
    if (barRef.current) observer.observe(barRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (datePanelRef.current && !datePanelRef.current.contains(e.target) && !e.target.closest('[data-filter="date"]')) setShowDatePanel(false);
      if (amountPanelRef.current && !amountPanelRef.current.contains(e.target) && !e.target.closest('[data-filter="amount"]')) setShowAmountPanel(false);
      if (statusPanelRef.current && !statusPanelRef.current.contains(e.target) && !e.target.closest('[data-filter="status"]')) setShowStatusPanel(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      };
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, []);

  const debouncedSearch = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value || '' });
    }, 300);
  }, [filters, onFiltersChange]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  const clearSearch = () => {
    setSearchInput('');
    onFiltersChange({ ...filters, search: '' });
    searchRef.current?.focus();
  };

  const toggleStatus = (status) => {
    const current = filters.status || [];
    const next = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
    onFiltersChange({ ...filters, status: next.length ? next : null });
  };

  const setDateRange = (range) => {
    onFiltersChange({ ...filters, dateRange: range });
    setShowDatePanel(false);
  };

  const setAmount = (amt) => {
    onFiltersChange({ ...filters, amount: amt });
    setShowAmountPanel(false);
  };

  const clearAll = () => {
    setSearchInput('');
    onFiltersChange({ search: '', status: null, dateRange: null, amount: null });
  };

  const chipColor = (key) => {
    switch (key) {
      case 'search': return '#3b82f6';
      case 'status': return '#8b5cf6';
      case 'dateRange': return '#06b6d4';
      case 'amount': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className={`filter-bar-wrapper ${isSticky ? 'is-sticky' : ''}`} ref={barRef}>
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            ref={searchRef}
            className="filter-search-input"
            placeholder="Search clients by name, email, or company..."
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button className="filter-search-clear" onClick={clearSearch} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
          <span className="filter-search-kbd">⌘K</span>
        </div>

        <div className="filter-actions">
          <div className="filter-dropdown-group">
            <button className="filter-btn" data-filter="status" onClick={() => { setShowStatusPanel(s => !s); setShowDatePanel(false); setShowAmountPanel(false); }}>
              <Filter size={14} /> Status {filters.status?.length ? `(${filters.status.length})` : ''} <ChevronDown size={12} />
            </button>
            {showStatusPanel && (
              <div className="filter-panel" ref={statusPanelRef}>
                <div className="filter-panel-header">Payment Status</div>
                <div className="filter-status-list">
                  {STATUS_OPTIONS.map(s => (
                    <label key={s.value} className="filter-status-item">
                      <input type="checkbox" checked={filters.status?.includes(s.value) || false} onChange={() => toggleStatus(s.value)} />
                      <span className="status-badge-dot" style={{ background: s.color }} />
                      {s.label}
                    </label>
                  ))}
                </div>
                <div className="filter-panel-footer">
                  <button className="btn btn-sm btn-secondary" onClick={() => { onFiltersChange({ ...filters, status: null }); setShowStatusPanel(false); }}>Clear</button>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowStatusPanel(false)}>Apply</button>
                </div>
              </div>
            )}
          </div>

          <div className="filter-dropdown-group">
            <button className="filter-btn" data-filter="date" onClick={() => { setShowDatePanel(s => !s); setShowStatusPanel(false); setShowAmountPanel(false); }}>
              <Calendar size={14} /> Date <ChevronDown size={12} />
            </button>
            {showDatePanel && (
              <div className="filter-panel filter-panel-date" ref={datePanelRef}>
                <div className="filter-panel-header">Onboarded Date</div>
                <div className="filter-date-presets">
                  {[
                    { label: 'This month', getValue: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0], end: n.toISOString().split('T')[0] }; } },
                    { label: 'Last month', getValue: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString().split('T')[0], end: new Date(n.getFullYear(), n.getMonth(), 0).toISOString().split('T')[0] }; } },
                    { label: 'Last 3 months', getValue: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth() - 3, 1).toISOString().split('T')[0], end: n.toISOString().split('T')[0] }; } },
                    { label: 'Last 6 months', getValue: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth() - 6, 1).toISOString().split('T')[0], end: n.toISOString().split('T')[0] }; } },
                    { label: 'This year', getValue: () => { const n = new Date(); return { start: new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0], end: n.toISOString().split('T')[0] }; } },
                  ].map(p => (
                    <button key={p.label} className="filter-date-preset" onClick={() => setDateRange(p.getValue())}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="filter-date-custom">
                  <span>Custom range</span>
                  <div className="filter-date-fields">
                    <input type="date" className="input-field input-sm" value={filters.dateRange?.start || ''} onChange={e => setDateRange({ ...filters.dateRange, start: e.target.value, end: filters.dateRange?.end || '' })} />
                    <span className="filter-date-to">to</span>
                    <input type="date" className="input-field input-sm" value={filters.dateRange?.end || ''} onChange={e => setDateRange({ ...filters.dateRange, start: filters.dateRange?.start || '', end: e.target.value })} />
                  </div>
                </div>
                <div className="filter-panel-footer">
                  <button className="btn btn-sm btn-secondary" onClick={() => { onFiltersChange({ ...filters, dateRange: null }); setShowDatePanel(false); }}>Clear</button>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowDatePanel(false)}>Apply</button>
                </div>
              </div>
            )}
          </div>

          <div className="filter-dropdown-group">
            <button className="filter-btn" data-filter="amount" onClick={() => { setShowAmountPanel(s => !s); setShowStatusPanel(false); setShowDatePanel(false); }}>
              <DollarSign size={14} /> Amount <ChevronDown size={12} />
            </button>
            {showAmountPanel && (
              <div className="filter-panel filter-panel-amount" ref={amountPanelRef}>
                <div className="filter-panel-header">Monthly Price (USD)</div>
                <div className="filter-amount-fields">
                  <div className="filter-amount-field">
                    <label>Min</label>
                    <input type="number" className="input-field input-sm" placeholder="0" value={filters.amount?.min ?? ''} onChange={e => setAmount({ ...filters.amount, min: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="filter-amount-field">
                    <label>Max</label>
                    <input type="number" className="input-field input-sm" placeholder="10000" value={filters.amount?.max ?? ''} onChange={e => setAmount({ ...filters.amount, max: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <div className="filter-amount-presets">
                  {[
                    { label: 'Under $100', getValue: () => ({ max: 100 }) },
                    { label: '$100 - $500', getValue: () => ({ min: 100, max: 500 }) },
                    { label: '$500 - $1K', getValue: () => ({ min: 500, max: 1000 }) },
                    { label: 'Over $1K', getValue: () => ({ min: 1000 }) },
                  ].map(p => (
                    <button key={p.label} className="filter-amount-preset" onClick={() => setAmount(p.getValue())}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="filter-panel-footer">
                  <button className="btn btn-sm btn-secondary" onClick={() => { onFiltersChange({ ...filters, amount: null }); setShowAmountPanel(false); }}>Clear</button>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowAmountPanel(false)}>Apply</button>
                </div>
              </div>
            )}
          </div>

          {actualActive > 0 && (
            <button className="filter-btn filter-btn-clear" onClick={clearAll} aria-label="Clear all filters">
              <X size={14} /> Clear All
            </button>
          )}
        </div>
      </div>

      {actualActive > 0 && (
        <div className="filter-chips">
          {filters.search && (
            <span className="filter-chip" style={{ '--chip-color': chipColor('search') }}>
              <Search size={12} /> "{filters.search}" <X size={12} className="filter-chip-x" onClick={clearSearch} />
            </span>
          )}
          {filters.status?.length > 0 && (
            <span className="filter-chip" style={{ '--chip-color': chipColor('status') }}>
              <Filter size={12} /> {filters.status.length === 1 ? filters.status[0] : `${filters.status.length} statuses`} <X size={12} className="filter-chip-x" onClick={() => onFiltersChange({ ...filters, status: null })} />
            </span>
          )}
          {filters.dateRange && (
            <span className="filter-chip" style={{ '--chip-color': chipColor('dateRange') }}>
              <Calendar size={12} /> {filters.dateRange.start || '...'} – {filters.dateRange.end || '...'} <X size={12} className="filter-chip-x" onClick={() => onFiltersChange({ ...filters, dateRange: null })} />
            </span>
          )}
          {filters.amount && (
            <span className="filter-chip" style={{ '--chip-color': chipColor('amount') }}>
              <DollarSign size={12} /> {filters.amount.min ? `$${filters.amount.min}` : '$0'}{filters.amount.max ? ` – $${filters.amount.max}` : '+'} <X size={12} className="filter-chip-x" onClick={() => onFiltersChange({ ...filters, amount: null })} />
            </span>
          )}
          <span className="filter-count">{actualActive} filter{actualActive > 1 ? 's' : ''} applied</span>
        </div>
      )}
    </div>
  );
}
