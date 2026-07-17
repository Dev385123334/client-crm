import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { AuthContext } from '../context/AuthContext';
import { EXPENSE_CATEGORIES, categorizeExpense, parseINRAmount, getBaseRole } from '../utils/helpers';
import { Plus, Upload, Trash2, Edit3, Filter, Undo2, Archive, RotateCcw, AlertCircle, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import './Expenses.css';

export default function Expenses() {
  const { user, userRole } = useContext(AuthContext);
  const canDelete = getBaseRole(userRole) !== 'pm_editor';

  const { expenses, setExpenses, deleteExpenses, currentMonth, currentYear, formatINR, logAction, disputes, addDispute, updateDispute, deleteDispute } = useContext(AppContext);
  const [tab, setTab] = useState('expenses');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [importPreview, setImportPreview] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const fileInputRef = useRef(null);

  const monthExpenses = expenses.filter(e => e.month === currentMonth && e.year === currentYear);
  const filtered = filterCategory === 'All' ? monthExpenses : monthExpenses.filter(e => e.category === filterCategory);
  const grouped = {};
  EXPENSE_CATEGORIES.forEach(cat => { grouped[cat] = 0; });
  monthExpenses.forEach(e => { grouped[e.category] = (grouped[e.category] || 0) + e.amount; });
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const fixedMonthlyRecurring = monthExpenses
    .filter(e => e.frequency === 'Monthly Recurring')
    .reduce((s, e) => s + e.amount, 0);

  const [form, setForm] = useState({ name: '', amount: '', category: 'Salaries', frequency: 'Monthly Recurring', date: '', status: 'Paid', notes: '' });

  // ── Disputes ──
  const DISPUTE_PLATFORMS = ['PayPal', 'Stripe', 'Payoneer', 'Skydo', 'Unknown/Bank'];
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ date: `${currentYear}-${currentMonth}-01`, amount: '', platform: 'PayPal', reason: '', status: 'Open' });
  const [editingDispute, setEditingDispute] = useState(null);
  const [disputeSortBy, setDisputeSortBy] = useState('date');
  const [disputeSortAsc, setDisputeSortAsc] = useState(false);

  const totalDisputed = disputes.reduce((s, d) => s + d.amount, 0);
  const totalResolved = disputes.filter(d => d.status === 'Resolved').reduce((s, d) => s + d.amount, 0);
  const totalOpen = disputes.filter(d => d.status === 'Open').reduce((s, d) => s + d.amount, 0);

  const sortedDisputes = [...disputes].sort((a, b) => {
    let cmp = 0;
    if (disputeSortBy === 'date') cmp = a.date.localeCompare(b.date);
    else if (disputeSortBy === 'amount') cmp = a.amount - b.amount;
    return disputeSortAsc ? cmp : -cmp;
  });

  const openAdd = () => {
    setForm({ name: '', amount: '', category: 'Salaries', frequency: 'Monthly Recurring', date: `${currentYear}-${currentMonth}-01`, status: 'Paid', notes: '' });
    setEditExpense(null); setShowAddModal(true);
  };
  const openEdit = (exp) => {
    setForm({ name: exp.name, amount: exp.amount, category: exp.category, frequency: exp.frequency, date: exp.date, status: exp.status, notes: exp.notes || '' });
    setEditExpense(exp); setShowAddModal(true);
  };
  const saveExpense = () => {
    if (!form.name || form.amount === '' || form.amount === null || form.amount === undefined) return;
    if (editExpense) {
      setExpenses(prev => prev.map(e => e.id === editExpense.id ? { ...e, name: form.name, amount: parseINRAmount(form.amount), category: form.category, frequency: form.frequency, date: form.date, status: form.status, notes: form.notes } : e));
      logAction({ user, actionType: 'expense.update', entityType: 'expense', entityId: editExpense.id, entityName: form.name });
    } else {
      const newId = uuidv4();
      setExpenses(prev => [...prev, { id: newId, name: form.name, amount: parseINRAmount(form.amount), category: form.category, frequency: form.frequency, date: form.date, status: form.status, notes: form.notes, month: currentMonth, year: currentYear }]);
      logAction({ user, actionType: 'expense.create', entityType: 'expense', entityId: newId, entityName: form.name, details: { amount: form.amount } });
    }
    setShowAddModal(false);
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, { header: false, skipEmptyLines: true, complete: (results) => { let data = results.data; if (data[0] && isNaN(parseINRAmount(data[0][2]))) data = data.slice(1); setImportPreview(data); setShowImportModal(true); } });
    e.target.value = '';
  };
  const confirmImport = () => {
    if (!importPreview) return;
    let imported = 0, skipped = 0, errors = [];
    const newExpenses = [];
    importPreview.forEach((row, i) => {
      const dateRaw = (row[0] || '').trim(); const name = (row[1] || '').trim(); const amountRaw = (row[2] || '').trim();
      if (!name || !amountRaw) { errors.push(`Row ${i + 1}: Missing data`); return; }
      const amount = parseINRAmount(amountRaw); if (!amount) { errors.push(`Row ${i + 1}: Invalid amount`); return; }
      let isoDate = '';
      if (dateRaw) { const parts = dateRaw.split('/'); if (parts.length === 3) isoDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`; }
      if (!isoDate) isoDate = `${currentYear}-${currentMonth}-01`;
      const isDup = expenses.some(e => e.date === isoDate && e.name === name && e.amount === amount);
      if (isDup) { skipped++; return; }
      newExpenses.push({ id: uuidv4(), name, amount, category: categorizeExpense(name), frequency: 'Monthly Recurring', date: isoDate, status: 'Paid', notes: '', month: currentMonth, year: currentYear });
      imported++;
    });
    setExpenses(prev => [...prev, ...newExpenses]);
    setImportHistory(prev => [{ date: new Date().toLocaleString(), count: imported, skipped, ids: newExpenses.map(e => e.id) }, ...prev]);
    logAction({ user, actionType: 'expense.bulk_import', entityType: 'expense', entityName: `${imported} expenses`, details: { imported, skipped, count: newExpenses.length } });
    alert(`${imported} expenses imported. ${skipped} duplicates skipped.`);
    setShowImportModal(false); setImportPreview(null);
  };
  const undoLastImport = () => { if (!importHistory.length) return; const last = importHistory[0]; setExpenses(prev => prev.filter(e => !last.ids.includes(e.id))); setImportHistory(prev => prev.slice(1)); logAction({ user, actionType: 'expense.undo_import', entityType: 'expense', entityName: `${last.count} expenses`, details: { ids: last.ids } }); };

  const [dragOver, setDragOver] = useState(false);
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (!file) return;
    Papa.parse(file, { header: false, skipEmptyLines: true, complete: (results) => { let data = results.data; if (data[0] && isNaN(parseINRAmount(data[0][2]))) data = data.slice(1); setImportPreview(data); setShowImportModal(true); } });
  };

  // ── Selection & Bulk Actions ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deletedExpenses, setDeletedExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('profitpilot_deletedExpenses') || '[]'); }
    catch { return []; }
  });
  const [showTrashModal, setShowTrashModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('profitpilot_deletedExpenses', JSON.stringify(deletedExpenses));
  }, [deletedExpenses]);

  // ── Undo ──
  const [undoData, setUndoData] = useState(null);
  const [undoRemaining, setUndoRemaining] = useState(0);

  useEffect(() => {
    if (undoData && undoRemaining > 0) {
      const id = setInterval(() => {
        setUndoRemaining(prev => {
          if (prev <= 1) { clearInterval(id); setUndoData(null); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [undoData, undoRemaining]);

  const handleUndo = () => {
    if (!undoData) return;
    setExpenses(prev => [...prev, ...undoData.expenses]);
    setDeletedExpenses(prev => prev.filter(e => !undoData.ids.has(e.id)));
    logAction({ user, actionType: 'expense.restore', entityType: 'expense', entityName: `${undoData.expenses.length} expense(s)` });
    setUndoData(null);
    setUndoRemaining(0);
  };

  const isAllSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    }
  };

  const confirmBulkDelete = () => {
    const toDelete = filtered.filter(e => selectedIds.has(e.id));
    const now = new Date().toISOString();
    const deleted = toDelete.map(e => ({ ...e, deletedAt: now }));
    setDeletedExpenses(prev => [...prev, ...deleted]);
    setExpenses(prev => prev.filter(e => !selectedIds.has(e.id)));
    logAction({ user, actionType: 'expense.bulk_delete', entityType: 'expense', entityName: `${toDelete.length} expenses`, details: { ids: toDelete.map(e => e.id), names: toDelete.map(e => e.name) } });
    setUndoData({ expenses: deleted, ids: new Set(deleted.map(e => e.id)) });
    setUndoRemaining(10);
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
  };

  const softDeleteExpense = (exp) => {
    const now = new Date().toISOString();
    const deleted = { ...exp, deletedAt: now };
    setDeletedExpenses(prev => [...prev, deleted]);
    setExpenses(prev => prev.filter(e => e.id !== exp.id));
    logAction({ user, actionType: 'expense.delete', entityType: 'expense', entityId: exp.id, entityName: exp.name, details: { record: { ...exp } } });
    setUndoData({ expenses: [deleted], ids: new Set([deleted.id]) });
    setUndoRemaining(10);
  };

  const restoreExpense = (exp) => {
    setExpenses(prev => [...prev, { ...exp, deletedAt: undefined }]);
    setDeletedExpenses(prev => prev.filter(e => e.id !== exp.id));
    logAction({ user, actionType: 'expense.restore', entityType: 'expense', entityId: exp.id, entityName: exp.name });
  };

  const permanentlyDeleteExpense = (id) => {
    if (!confirm('Permanently delete this expense? This cannot be undone.')) return;
    const exp = deletedExpenses.find(e => e.id === id);
    deleteExpenses([id]);
    setDeletedExpenses(prev => prev.filter(e => e.id !== id));
    logAction({ user, actionType: 'expense.permanent_delete', entityType: 'expense', entityId: id, entityName: exp?.name });
  };

  const emptyBin = () => {
    if (deletedExpenses.length === 0) return;
    if (!confirm(`Permanently delete all ${deletedExpenses.length} deleted expenses? This cannot be undone.`)) return;
    const ids = deletedExpenses.map(e => e.id);
    deleteExpenses(ids);
    setDeletedExpenses([]);
    logAction({ user, actionType: 'expense.permanent_delete', entityType: 'expense', entityName: `${deletedExpenses.length} expense(s)` });
  };

  const trashCount = deletedExpenses.length;

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="expenses-page">
      {/* Undo Toast */}
      {undoData && (
        <div className="undo-toast">
          <span>{undoData.expenses.length > 1 ? `${undoData.expenses.length} expenses moved to trash.` : 'Expense moved to trash.'}</span>
          <button className="undo-btn" onClick={handleUndo}>Undo ({undoRemaining}s)</button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Expense Manager</h1>
          <p className="page-subtitle">Track and manage all business expenses in INR</p>
        </div>
        <div className="header-actions">
          {trashCount > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowTrashModal(true)} style={{ borderColor: '#f59e0b', color: '#b45309' }}>
              <Archive size={14} /> View Trash ({trashCount})
            </button>
          )}
          {importHistory.length > 0 && <button className="btn btn-secondary" onClick={undoLastImport}><Undo2 size={14} /> Undo Import</button>}
          <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}><Upload size={14} /> Import CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Expense</button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="disputes-tabs">
        <button className={`disputes-tab ${tab === 'expenses' ? 'disputes-tab--active' : ''}`} onClick={() => setTab('expenses')}>Expenses</button>
        <button className={`disputes-tab ${tab === 'disputes' ? 'disputes-tab--active' : ''}`} onClick={() => setTab('disputes')}>
          Disputes {disputes.length > 0 && <span className="disputes-tab-count">{disputes.length}</span>}
        </button>
      </div>

      {tab === 'expenses' && (
      <div className="drop-zone card" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} style={dragOver ? { borderColor: 'var(--accent)', background: 'var(--accent-light)' } : {}}>
        <Upload size={20} style={{ color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Drag & drop a CSV/Excel file here to import expenses</p>
      </div>
      )}

      {tab === 'expenses' && (
      <>
      {/* Summary + Filter Row */}
      <div className="breakdown-row">
        <div className="card">
          <h3 className="breakdown-title">Monthly Expense Summary</h3>
          <div className="summary-list">
            {EXPENSE_CATEGORIES.map(cat => grouped[cat] > 0 && (
              <div key={cat} className="summary-row"><span>{cat}</span><span className="font-semibold">{formatINR(grouped[cat])}</span></div>
            ))}
            <div className="summary-total"><span>TOTAL EXPENSES</span><span>{formatINR(totalExpenses)}</span></div>
            <div className="summary-row" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fixed Monthly Recurring</span>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{formatINR(fixedMonthlyRecurring)}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <h3 className="breakdown-title">Filter & Stats</h3>
          <div className="input-group">
            <label className="input-label">Category Filter</label>
            <select className="input-field" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="summary-row"><span>Total Entries</span><span className="font-semibold">{monthExpenses.length}</span></div>
            <div className="summary-row"><span>Filtered</span><span className="font-semibold">{filtered.length}</span></div>
            <div className="summary-row"><span>Categories Used</span><span className="font-semibold">{EXPENSE_CATEGORIES.filter(c => grouped[c] > 0).length}</span></div>
          </div>
        </div>
      </div>

      {/* Bulk Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <div className="bulk-toolbar-left">
            <span className="bulk-counter">{selectedIds.size} expense{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="bulk-toolbar-actions">
            <button className="btn btn-sm btn-secondary" onClick={toggleSelectAll}>
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            {canDelete && (
              <button className="btn btn-sm btn-danger" onClick={() => setShowBulkDeleteModal(true)}>
                <Trash2 size={14} /> Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input
                  type="checkbox"
                  className="row-checkbox"
                  checked={isAllSelected}
                  ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Date</th>
              <th>Expense Name</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(exp => (
              <tr key={exp.id} className={selectedIds.has(exp.id) ? 'row-selected' : ''}>
                <td className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={selectedIds.has(exp.id)}
                    onChange={() => toggleSelectOne(exp.id)}
                  />
                </td>
                <td>{exp.date.split('-').reverse().join('/')}</td>
                <td className="font-medium">{exp.name}</td>
                <td><span className="badge badge-neutral">{exp.category}</span></td>
                <td className="font-semibold">{formatINR(exp.amount)}</td>
                <td className="text-sm text-muted">{exp.frequency}</td>
                <td><span className={`badge badge-${exp.status === 'Paid' ? 'success' : 'warning'}`}>{exp.status}</span></td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn-icon" onClick={() => openEdit(exp)}><Edit3 size={14} /></button>
                    {canDelete && <button className="btn-icon" onClick={() => softDeleteExpense(exp)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No expenses for this month</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowBulkDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ marginBottom: 12 }}>Delete {selectedIds.size} expense{selectedIds.size > 1 ? 's' : ''}?</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              The following expenses will be moved to Trash. You can restore them anytime.
            </p>
            <div className="bulk-delete-list">
              {sorted.filter(e => selectedIds.has(e.id)).map(e => (
                <div key={e.id} className="bulk-delete-item">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-muted text-sm">{formatINR(e.amount)} &middot; {e.date.split('-').reverse().join('/')}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowBulkDeleteModal(false)}>Cancel</button>
              {canDelete && (
                <button className="btn btn-danger" onClick={confirmBulkDelete}>
                  <Trash2 size={14} /> Delete {selectedIds.size} to Trash
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trash Modal */}
      {showTrashModal && (
        <div className="modal-overlay" onClick={() => setShowTrashModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="trash-header">
              <div className="trash-header-top">
                <h2>Trash (Deleted Expenses)</h2>
                {canDelete && deletedExpenses.length > 0 && (
                  <button className="btn btn-sm btn-danger" onClick={emptyBin}>
                    <Trash2 size={12} /> Empty Bin
                  </button>
                )}
              </div>
              <p className="text-muted text-sm">Deleted expenses are kept until you permanently delete them.</p>
            </div>
            {deletedExpenses.length === 0 ? (
              <div className="card empty-state" style={{ margin: 0 }}>
                <div className="empty-icon"><Archive size={32} /></div>
                <h3>Trash is empty</h3>
                <p className="text-muted text-sm">Deleted expenses will appear here.</p>
              </div>
            ) : (
              <div className="trash-list">
                {[...deletedExpenses].reverse().map(exp => (
                  <div key={exp.id} className="trash-item">
                    <div className="trash-item-main">
                      <h4 className="trash-item-name">{exp.name}</h4>
                      <div className="trash-item-meta">
                        <span>Deleted on {new Date(exp.deletedAt).toLocaleDateString()}</span>
                        <span className="trash-meta-sep">&middot;</span>
                        <span>{formatINR(exp.amount)}</span>
                        <span className="trash-meta-sep">&middot;</span>
                        <span>{exp.date.split('-').reverse().join('/')}</span>
                      </div>
                      <div className="trash-item-details">
                        <span>Category: {exp.category}</span>
                        <span className="trash-meta-sep">&middot;</span>
                        <span>Frequency: {exp.frequency}</span>
                      </div>
                    </div>
                    <div className="trash-item-actions">
                      <button className="btn btn-sm btn-success" onClick={() => restoreExpense(exp)}>
                        <RotateCcw size={12} /> Restore
                      </button>
                      {canDelete && (
                        <button className="btn btn-sm btn-danger" onClick={() => permanentlyDeleteExpense(exp.id)}>
                          <Trash2 size={12} /> Delete Forever
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowTrashModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Expenses tab end ── */}
      </> )}

      {/* ── Disputes tab ── */}
      {tab === 'disputes' && (
      <div className="disputes-section">
        {/* Summary Cards */}
        <div className="disputes-stats-row">
          <div className="card disputes-stat-card">
            <div className="disputes-stat-label">Total Disputed</div>
            <div className="disputes-stat-value disputes-stat-value--total">{formatINR(totalDisputed)}</div>
          </div>
          <div className="card disputes-stat-card">
            <div className="disputes-stat-label">Resolved / Paid Back</div>
            <div className="disputes-stat-value disputes-stat-value--resolved">{formatINR(totalResolved)}</div>
          </div>
          <div className="card disputes-stat-card">
            <div className="disputes-stat-label">Still Open</div>
            <div className="disputes-stat-value disputes-stat-value--open">{formatINR(totalOpen)}</div>
          </div>
        </div>

        {/* Add Dispute Button + Sort Controls */}
        <div className="disputes-toolbar">
          <button className="btn btn-primary" onClick={() => {
            setEditingDispute(null);
            setDisputeForm({ date: `${currentYear}-${currentMonth}-01`, amount: '', platform: 'PayPal', reason: '', status: 'Open' });
            setShowDisputeForm(true);
          }}>
            <Plus size={14} /> Add Dispute
          </button>
          <div className="disputes-sort">
            <span className="text-muted text-sm">Sort by:</span>
            <select className="input-field disputes-sort-select" value={disputeSortBy} onChange={e => setDisputeSortBy(e.target.value)}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
            </select>
            <button className="btn btn-sm btn-secondary" onClick={() => setDisputeSortAsc(!disputeSortAsc)}>
              {disputeSortAsc ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Disputes Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table disputes-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Platform</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDisputes.map(d => (
                <tr key={d.id}>
                  <td>{d.date.split('-').reverse().join('/')}</td>
                  <td className="font-semibold">{formatINR(d.amount)}</td>
                  <td><span className="badge badge-neutral">{d.platform}</span></td>
                  <td className="text-muted text-sm">{d.reason || '—'}</td>
                  <td>
                    <span className={`badge ${d.status === 'Resolved' ? 'badge-success' : d.status === 'Written Off' ? 'badge-warning' : 'badge-danger'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => {
                        setEditingDispute(d);
                        setDisputeForm({ date: d.date, amount: String(d.amount), platform: d.platform, reason: d.reason || '', status: d.status });
                        setShowDisputeForm(true);
                      }}>
                        <Edit3 size={14} />
                      </button>
                      <button className="btn-icon" title="Delete" onClick={() => { if (confirm('Delete this dispute?')) deleteDispute(d.id); }} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedDisputes.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No disputes recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Dispute Add/Edit Modal */}
      {showDisputeForm && (
        <div className="modal-overlay" onClick={() => setShowDisputeForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>{editingDispute ? 'Edit Dispute' : 'Add Dispute'}</h2>
            <div className="input-group">
              <label className="input-label">Date *</label>
              <input className="input-field" type="date" value={disputeForm.date} onChange={e => setDisputeForm({ ...disputeForm, date: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">Amount (₹) *</label>
              <input className="input-field" type="text" inputMode="numeric" value={disputeForm.amount} onChange={e => setDisputeForm({ ...disputeForm, amount: e.target.value })} placeholder="e.g. 50000 or 50,000" />
            </div>
            <div className="input-group">
              <label className="input-label">Platform *</label>
              <select className="input-field" value={disputeForm.platform} onChange={e => setDisputeForm({ ...disputeForm, platform: e.target.value })}>
                {DISPUTE_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Reason / Note</label>
              <input className="input-field" value={disputeForm.reason} onChange={e => setDisputeForm({ ...disputeForm, reason: e.target.value })} placeholder="Optional" />
            </div>
            <div className="input-group">
              <label className="input-label">Status *</label>
              <select className="input-field" value={disputeForm.status} onChange={e => setDisputeForm({ ...disputeForm, status: e.target.value })}>
                <option value="Open">Open</option>
                <option value="Resolved">Resolved</option>
                <option value="Written Off">Written Off</option>
              </select>
            </div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowDisputeForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const amount = parseFloat(disputeForm.amount);
                if (!amount || amount <= 0) return;
                if (editingDispute) {
                  updateDispute(editingDispute.id, {
                    date: disputeForm.date,
                    amount,
                    platform: disputeForm.platform,
                    reason: disputeForm.reason,
                    status: disputeForm.status
                  });
                } else {
                  addDispute({
                    date: disputeForm.date,
                    amount,
                    platform: disputeForm.platform,
                    reason: disputeForm.reason,
                    status: disputeForm.status
                  });
                }
                setShowDisputeForm(false);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>{editExpense ? 'Edit Expense' : 'Add Expense'}</h2>
            <div className="input-group"><label className="input-label">Expense Name *</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">Amount (₹) *</label><input className="input-field" type="text" inputMode="numeric" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 50000 or 50,000" /></div>
              <div className="input-group"><label className="input-label">Category</label><select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">Date Paid</label><input className="input-field" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="input-group"><label className="input-label">Frequency</label><select className="input-field" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}><option value="Monthly Recurring">Monthly Recurring</option><option value="One-Time">One-Time</option></select></div>
            </div>
            <div className="input-group"><label className="input-label">Status</label><select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="Paid">Paid</option><option value="Pending">Pending</option></select></div>
            <div className="input-group"><label className="input-label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveExpense}>Save</button></div>
          </div>
        </div>
      )}
      {showImportModal && importPreview && (
        <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportPreview(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2 style={{ marginBottom: 16 }}>Import Preview — {importPreview.length} entries</h2>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 8 }}>
              <table className="table"><thead><tr><th>#</th><th>Date</th><th>Description</th><th>Amount</th><th>Auto Category</th></tr></thead>
                <tbody>{importPreview.map((row, i) => (<tr key={i}><td>{i + 1}</td><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><span className="badge badge-neutral">{categorizeExpense(row[1] || '')}</span></td></tr>))}</tbody>
              </table>
            </div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportPreview(null); }}>Cancel</button><button className="btn btn-primary" onClick={confirmImport}>Import All ({importPreview.length})</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
