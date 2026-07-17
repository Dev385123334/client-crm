import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Plus, Check, X, Edit3, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import './BankDeposits.css';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMonthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function BankDeposits() {
  const {
    bankDeposits, addBankDeposit, updateBankDeposit, deleteBankDeposit,
    getBankDepositsForMonth,
    monthlyRecords, currentMonth, currentYear,
    formatUSD, formatINR,
    pendingWithdrawal, setPendingWithdrawal,
    disputes
  } = useContext(AppContext);

  const [showForm, setShowForm] = useState(false);
  const [newDate, setNewDate] = useState(getToday());
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showNoteField, setShowNoteField] = useState(false);
  const [error, setError] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const amountRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [editingPending, setEditingPending] = useState(false);
  const [pendingValue, setPendingValue] = useState('');

  useEffect(() => {
    if (showForm && amountRef.current) {
      amountRef.current.focus();
    }
  }, [showForm]);

  useEffect(() => {
    if (highlightedId) {
      const timer = setTimeout(() => setHighlightedId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightedId]);

  const openForm = () => {
    setNewDate(getToday());
    setNewAmount('');
    setNewNote('');
    setShowNoteField(false);
    setError(null);
    setShowForm(true);
  };

  const submitEntry = () => {
    const amount = parseFloat(newAmount);
    if (!amount || amount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    const selectedDate = new Date(newDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      setError('Date cannot be in the future');
      return;
    }
    setError(null);

    const deposit = addBankDeposit({
      date: newDate,
      inrAmount: amount,
      note: newNote.trim() || null
    });

    setHighlightedId(deposit.id);

    setNewDate(getToday());
    setNewAmount('');
    setNewNote('');
    setShowNoteField(false);
    if (amountRef.current) amountRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitEntry();
    }
  };

  const startEditing = (deposit) => {
    setEditingId(deposit.id);
    setEditDate(deposit.date);
    setEditAmount(String(deposit.inrAmount));
    setEditNote(deposit.note || '');
    setEditError(null);
  };

  const saveEdit = (id) => {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) {
      setEditError('Amount must be a positive number');
      return;
    }
    const selectedDate = new Date(editDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      setEditError('Date cannot be in the future');
      return;
    }
    setEditError(null);
    updateBankDeposit(id, {
      date: editDate,
      inrAmount: amount,
      note: editNote.trim() || null
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const confirmDelete = (deposit) => {
    setDeleteConfirm(deposit);
  };

  const executeDelete = () => {
    if (deleteConfirm) {
      deleteBankDeposit(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const startEditPending = () => {
    setPendingValue(String(pendingWithdrawal));
    setEditingPending(true);
  };

  const savePending = () => {
    const val = parseFloat(pendingValue);
    if (!isNaN(val) && val >= 0) {
      setPendingWithdrawal(val);
    }
    setEditingPending(false);
  };

  const handlePendingKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      savePending();
    }
    if (e.key === 'Escape') {
      setEditingPending(false);
    }
  };

  const monthKey = `${currentYear}-${currentMonth}`;
  const monthRecords = (monthlyRecords[monthKey] || []).filter(r => !r.isDeleted);
  const invoicedThisMonth = monthRecords.reduce((s, r) => s + ((r.paymentReceived || 0) + (r.upsellAmount || 0) - (r.downsellAmount || 0) - (r.refundAmount || 0) - (r.chargebackAmount || 0)), 0);
  const actualInrThisMonth = getBankDepositsForMonth(currentMonth, currentYear).reduce((sum, d) => sum + d.inrAmount, 0);

  const grouped = {};
  for (const d of bankDeposits) {
    const key = getMonthKey(d.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  }
  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const monthTotals = {};
  for (const [key, deposits] of Object.entries(grouped)) {
    monthTotals[key] = deposits.reduce((sum, d) => sum + d.inrAmount, 0);
  }

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const curMonthName = monthNames[parseInt(currentMonth)];

  // ── Monthly Summary rebuilt ──
  const allTimeTotal = Object.values(monthTotals).reduce((a, b) => a + b, 0);
  const totalDisputesAll = disputes.reduce((s, d) => s + d.amount, 0);
  const netAllTimeTotal = allTimeTotal - totalDisputesAll;
  const thisMonthTotal = monthTotals[`${currentYear}-${currentMonth}`] || 0;
  const prevMonth = parseInt(currentMonth) - 1;
  const prevYear = prevMonth < 1 ? parseInt(currentYear) - 1 : parseInt(currentYear);
  const prevMonthKey = `${prevYear}-${String(prevMonth < 1 ? 12 : prevMonth).padStart(2, '0')}`;
  const lastMonthTotal = monthTotals[prevMonthKey] || 0;
  const avgMonthly = sortedGroupKeys.length > 0 ? allTimeTotal / sortedGroupKeys.length : 0;
  const thisMonthTrend = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : null;

  // Bar chart
  const monthsAsc = [...sortedGroupKeys].reverse();
  const maxBar = Math.max(...Object.values(monthTotals), 1);

  // Accordion state keyed by month key
  const [expandedMonths, setExpandedMonths] = useState({});

  const toggleMonth = (key) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bank-deposits-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Deposit Log</h1>
          <p className="page-subtitle">Record actual INR amounts credited from Payoneer withdrawals.</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="bd-stats-row">
        <div className="card bd-stat-card bd-stat-card--primary">
          <div className="bd-stat-label">Actual INR Received This Month</div>
          <div className="bd-stat-value">{formatINR(actualInrThisMonth)}</div>
          <div className="bd-stat-sub">From Bank Deposit Log — confirmed bank amount.</div>
        </div>
        <div className="card bd-stat-card">
          <div className="bd-stat-label">Invoiced This Month (USD)</div>
          <div className="bd-stat-value">{formatUSD(invoicedThisMonth)}</div>
          <div className="bd-stat-sub">Gross amount — before processing fees and conversion.</div>
        </div>
        <div className="card bd-stat-card">
          <div className="bd-stat-label">Pending Withdrawal (USD)</div>
          {editingPending ? (
            <div className="bd-pending-edit">
              <span className="bd-pending-prefix">$</span>
              <input
                type="number"
                step="0.01"
                className="input-field bd-pending-input"
                value={pendingValue}
                onChange={e => setPendingValue(e.target.value)}
                onKeyDown={handlePendingKeyDown}
                autoFocus
              />
              <button className="btn-icon btn-icon-sm" onClick={savePending} title="Save">
                <Check size={14} />
              </button>
              <button className="btn-icon btn-icon-sm" onClick={() => setEditingPending(false)} title="Cancel">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="bd-stat-value">{formatUSD(pendingWithdrawal)}</div>
              <div className="bd-stat-sub">
                Current Payoneer balance —{' '}
                <button className="bd-edit-link" onClick={startEditPending}>update</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bd-summary">
        {/* KPI Cards */}
        <div className="bd-summary-stats">
          <div className="card bd-summary-stat bd-summary-stat--net">
            <div className="bd-summary-stat-label">Net Total (Deposits − Disputes)</div>
            <div className="bd-summary-stat-value">{formatINR(netAllTimeTotal)}</div>
            <div className="bd-summary-stat-sub">Gross: {formatINR(allTimeTotal)} &minus; Disputes: {formatINR(totalDisputesAll)}</div>
          </div>
          <div className="card bd-summary-stat bd-summary-stat--primary">
            <div className="bd-summary-stat-label">This Month</div>
            <div className="bd-summary-stat-value">{formatINR(thisMonthTotal)}</div>
            {thisMonthTrend !== null && (
              <div className={`bd-summary-stat-trend ${thisMonthTrend >= 0 ? 'bd-summary-stat-trend--up' : 'bd-summary-stat-trend--down'}`}>
                {thisMonthTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(thisMonthTrend).toFixed(1)}% vs last month
              </div>
            )}
          </div>
          <div className="card bd-summary-stat">
            <div className="bd-summary-stat-label">Last Month</div>
            <div className="bd-summary-stat-value">{formatINR(lastMonthTotal)}</div>
          </div>
          <div className="card bd-summary-stat">
            <div className="bd-summary-stat-label">Avg Monthly Deposit</div>
            <div className="bd-summary-stat-value">{formatINR(avgMonthly)}</div>
            <div className="bd-summary-stat-sub">Across {sortedGroupKeys.length} months</div>
          </div>
        </div>

        {/* Bar Chart */}
        {monthsAsc.length > 0 && (
          <div className="card bd-bar-chart-card">
            <h3 className="bd-bar-chart-title">Monthly Trend</h3>
            <div className="bd-bar-chart">
              {monthsAsc.map(key => {
                const [year, month] = key.split('-');
                const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
                const val = monthTotals[key] || 0;
                const pct = (val / maxBar) * 100;
                return (
                  <div key={key} className="bd-bar-chart-item" title={`${label}: ${formatINR(val)} (${grouped[key].length} txns)`}>
                    <div className="bd-bar-chart-bar" style={{ height: `${Math.max(pct, 4)}%` }}>
                      <div className="bd-bar-chart-tooltip">
                        {formatINR(val)}<br /><span className="text-xs">{grouped[key].length} txns</span>
                      </div>
                    </div>
                    <span className="bd-bar-chart-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Accordion */}
        <div className="card bd-accordion-card">
          <div className="bd-accordion-card-header">
            <h3 className="bd-accordion-title">Month-by-Month Breakdown</h3>
            <div className="bd-accordion-total-wrap">
              <span className="bd-accordion-total">{formatINR(netAllTimeTotal)}</span>
              <span className="bd-accordion-total-sub">net of {formatINR(totalDisputesAll)} disputes</span>
            </div>
          </div>
          <div className="bd-accordion">
            {sortedGroupKeys.map(key => {
              const [year, month] = key.split('-');
              const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
              const isOpen = expandedMonths[key];
              return (
                <div key={key} className="bd-accordion-item">
                  <div className="bd-accordion-header" onClick={() => toggleMonth(key)}>
                    <div className="bd-accordion-header-left">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="bd-accordion-month">{monthName}</span>
                    </div>
                    <div className="bd-accordion-header-right">
                      <span className="bd-accordion-count">{grouped[key].length} txn{grouped[key].length !== 1 ? 's' : ''}</span>
                      <span className="bd-accordion-amount">{formatINR(monthTotals[key])}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bd-accordion-body">
                      {grouped[key].map(deposit => (
                        <div key={deposit.id} className="bd-accordion-row">
                          <span className="bd-accordion-row-date">{formatDateDisplay(deposit.date)}</span>
                          <span className="bd-accordion-row-amount">{formatINR(deposit.inrAmount)}</span>
                          {deposit.note && <span className="bd-accordion-row-note">{deposit.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!showForm ? (
        <button className="btn btn-primary add-deposit-btn" onClick={openForm}>
          <Plus size={16} /> Add Deposit
        </button>
      ) : (
        <div className="deposit-entry-row card">
          <div className="deposit-entry-fields">
            <div className="deposit-field deposit-field-date">
              <label className="deposit-field-label">Date</label>
              <input
                type="date"
                className="input-field"
                value={newDate}
                onChange={e => { setNewDate(e.target.value); setError(null); }}
              />
            </div>
            <div className="deposit-field deposit-field-amount">
              <label className="deposit-field-label">INR Amount</label>
              <div className="deposit-amount-wrap">
                <span className="deposit-currency">₹</span>
                <input
                  ref={amountRef}
                  type="number"
                  step="0.01"
                  className="input-field deposit-amount-input"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={e => { setNewAmount(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
            <div className="deposit-field-actions">
              <button className="btn btn-primary" onClick={submitEntry} title="Save">
                <Check size={16} />
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)} title="Cancel">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="deposit-entry-extras">
            {!showNoteField ? (
              <button className="add-note-link" onClick={() => setShowNoteField(true)}>
                <Plus size={12} /> Add note
              </button>
            ) : (
              <div className="deposit-note-wrap">
                <input
                  type="text"
                  className="input-field deposit-note-input"
                  placeholder="e.g. covers Drayton + Praxora + Kasia"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="btn-icon btn-icon-sm" onClick={() => setShowNoteField(false)} title="Remove note">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          {error && <div className="deposit-error">{error}</div>}
        </div>
      )}

      {bankDeposits.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">
            <Plus size={32} />
          </div>
          <h3>No deposits recorded yet</h3>
          <p className="text-muted text-sm">Click &ldquo;Add Deposit&rdquo; above to log your first Payoneer withdrawal.</p>
        </div>
      ) : (
        <div className="deposit-list">
          {sortedGroupKeys.map(groupKey => {
            const [year, month] = groupKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            return (
              <div key={groupKey} className="deposit-group">
                <div className="deposit-group-header">
                  <span className="deposit-group-title">{monthName}</span>
                  <span className="deposit-group-total">Total: {formatINR(monthTotals[groupKey])}</span>
                </div>
                <div className="deposit-group-list">
                  {grouped[groupKey].map(deposit => (
                    <div
                      key={deposit.id}
                      className={`deposit-row ${highlightedId === deposit.id ? 'deposit-row--highlight' : ''}`}
                    >
                      {editingId === deposit.id ? (
                        <div className="deposit-edit-row">
                          <div className="deposit-edit-fields">
                            <div className="deposit-field deposit-field-date">
                              <input
                                type="date"
                                className="input-field"
                                value={editDate}
                                onChange={e => { setEditDate(e.target.value); setEditError(null); }}
                              />
                            </div>
                            <div className="deposit-field deposit-field-amount">
                              <div className="deposit-amount-wrap">
                                <span className="deposit-currency">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input-field deposit-amount-input"
                                  value={editAmount}
                                  onChange={e => { setEditAmount(e.target.value); setEditError(null); }}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(deposit.id); }}
                                />
                              </div>
                            </div>
                            <div className="deposit-field deposit-field-note">
                              <input
                                type="text"
                                className="input-field"
                                placeholder="Note"
                                value={editNote}
                                onChange={e => setEditNote(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(deposit.id); }}
                              />
                            </div>
                          </div>
                          <div className="deposit-edit-actions">
                            <button className="btn-icon" title="Save" onClick={() => saveEdit(deposit.id)}>
                              <Check size={14} />
                            </button>
                            <button className="btn-icon" title="Cancel" onClick={cancelEdit}>
                              <X size={14} />
                            </button>
                          </div>
                          {editError && <div className="deposit-error deposit-error--edit">{editError}</div>}
                        </div>
                      ) : (
                        <>
                          <div className="deposit-row-info">
                            <span className="deposit-row-date">{formatDateDisplay(deposit.date)}</span>
                            <span className="deposit-row-amount">{formatINR(deposit.inrAmount)}</span>
                            {deposit.note && <span className="deposit-row-note">{deposit.note}</span>}
                          </div>
                          <div className="deposit-row-actions">
                            <button className="btn-icon" title="Edit" onClick={() => startEditing(deposit)}>
                              <Edit3 size={14} />
                            </button>
                            <button className="btn-icon" title="Delete" onClick={() => confirmDelete(deposit)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ marginBottom: 12 }}>Delete this deposit?</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
              {formatDateDisplay(deleteConfirm.date)} &mdash; {formatINR(deleteConfirm.inrAmount)}
            </p>
            {deleteConfirm.note && (
              <p className="text-sm text-muted" style={{ marginBottom: 16 }}>Note: {deleteConfirm.note}</p>
            )}
            <p className="text-sm text-muted" style={{ marginBottom: 20 }}>This action cannot be undone.</p>
            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={executeDelete}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
