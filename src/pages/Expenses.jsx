import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { EXPENSE_CATEGORIES, categorizeExpense, parseINRAmount } from '../utils/helpers';
import { Plus, Upload, Trash2, Edit3, Filter, Undo2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import './Expenses.css';

export default function Expenses() {
  const { expenses, setExpenses, currentMonth, currentYear, formatINR } = useContext(AppContext);

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
    if (!form.name || !form.amount) return;
    if (editExpense) {
      setExpenses(prev => prev.map(e => e.id === editExpense.id ? { ...e, name: form.name, amount: parseFloat(form.amount), category: form.category, frequency: form.frequency, date: form.date, status: form.status, notes: form.notes } : e));
    } else {
      setExpenses(prev => [...prev, { id: uuidv4(), name: form.name, amount: parseFloat(form.amount), category: form.category, frequency: form.frequency, date: form.date, status: form.status, notes: form.notes, month: currentMonth, year: currentYear }]);
    }
    setShowAddModal(false);
  };
  const deleteExpense = (id) => { if (confirm('Delete this expense?')) setExpenses(prev => prev.filter(e => e.id !== id)); };

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

  return (
    <div className="expenses-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense Manager</h1>
          <p className="page-subtitle">Track and manage all business expenses in INR</p>
        </div>
        <div className="header-actions">
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

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead><tr><th>Date</th><th>Expense Name</th><th>Category</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(exp => (
              <tr key={exp.id}>
                <td>{exp.date.split('-').reverse().join('/')}</td>
                <td className="font-medium">{exp.name}</td>
                <td><span className="badge badge-neutral">{exp.category}</span></td>
                <td className="font-semibold">{formatINR(exp.amount)}</td>
                <td className="text-sm text-muted">{exp.frequency}</td>
                <td><span className={`badge badge-${exp.status === 'Paid' ? 'success' : 'warning'}`}>{exp.status}</span></td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn-icon" onClick={() => openEdit(exp)}><Edit3 size={14} /></button>
                    <button className="btn-icon" onClick={() => deleteExpense(exp.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No expenses for this month</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>{editExpense ? 'Edit Expense' : 'Add Expense'}</h2>
            <div className="input-group"><label className="input-label">Expense Name *</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">Amount (₹) *</label><input className="input-field" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
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
