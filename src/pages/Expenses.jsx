import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { AuthContext } from '../context/AuthContext';
import { EXPENSE_CATEGORIES, categorizeExpense, parseINRAmount } from '../utils/helpers';
import { Plus, Upload, Trash2, Edit3, Filter, Undo2, Archive, RotateCcw, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import './Expenses.css';

export default function Expenses() {
  const { userRole } = useContext(AuthContext);
  const canDelete = userRole === 'admin';

  const { expenses, setExpenses, deleteExpenses, currentMonth, currentYear, formatINR } = useContext(AppContext);

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

  const [form, setForm] = useState({ name: '', amount: '', category: 'Salaries', frequency: 'Monthly Recurring', date: '', status: 'Paid', notes: '' });

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
    } else {
      setExpenses(prev => [...prev, { id: uuidv4(), name: form.name, amount: parseINRAmount(form.amount), category: form.category, frequency: form.frequency, date: form.date, status: form.status, notes: form.notes, month: currentMonth, year: currentYear }]);
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
    alert(`${imported} expenses imported. ${skipped} duplicates skipped.`);
    setShowImportModal(false); setImportPreview(null);
  };
  const undoLastImport = () => { if (!importHistory.length) return; const last = importHistory[0]; setExpenses(prev => prev.filter(e => !last.ids.includes(e.id))); setImportHistory(prev => prev.slice(1)); };

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
    setUndoData({ expenses: [deleted], ids: new Set([deleted.id]) });
    setUndoRemaining(10);
  };

  const restoreExpense = (exp) => {
    setExpenses(prev => [...prev, { ...exp, deletedAt: undefined }]);
    setDeletedExpenses(prev => prev.filter(e => e.id !== exp.id));
  };

  const permanentlyDeleteExpense = (id) => {
    if (!confirm('Permanently delete this expense? This cannot be undone.')) return;
    deleteExpenses([id]);
    setDeletedExpenses(prev => prev.filter(e => e.id !== id));
  };

  const emptyBin = () => {
    if (deletedExpenses.length === 0) return;
    if (!confirm(`Permanently delete all ${deletedExpenses.length} deleted expenses? This cannot be undone.`)) return;
    const ids = deletedExpenses.map(e => e.id);
    deleteExpenses(ids);
    setDeletedExpenses([]);
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

      <div className="drop-zone card" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} style={dragOver ? { borderColor: 'var(--accent)', background: 'var(--accent-light)' } : {}}>
        <Upload size={20} style={{ color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Drag & drop a CSV/Excel file here to import expenses</p>
      </div>

      {/* Summary + Filter Row */}
      <div className="breakdown-row">
        <div className="card">
          <h3 className="breakdown-title">Monthly Expense Summary</h3>
          <div className="summary-list">
            {EXPENSE_CATEGORIES.map(cat => grouped[cat] > 0 && (
              <div key={cat} className="summary-row"><span>{cat}</span><span className="font-semibold">{formatINR(grouped[cat])}</span></div>
            ))}
            <div className="summary-total"><span>TOTAL EXPENSES</span><span>{formatINR(totalExpenses)}</span></div>
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
