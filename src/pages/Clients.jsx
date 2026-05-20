import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { calculateTenure, formatDate, getPaymentStatus, getPaymentAlert, parseGoogleSheetDate, parseUSDAmount, CLIENT_STATUSES, PAYMENT_METHODS, STATUS_NOTES, MONTH_NAMES } from '../utils/helpers';
import { Plus, Upload, ArrowUpDown, Check, X, Search, Mail, Trash2, Edit3, DollarSign, AlertCircle, RotateCcw, Archive } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import './Clients.css';

export default function Clients() {
  const {
    currentMonthRecords, currentMonthActive, currentMonthCancelled, currentMonthTrash,
    monthlyRecords,
    addRecordToMonth, updateRecordInMonth, softDeleteRecord,
    softDeleteRecordFromAllMonths, restoreRecord, permanentlyDeleteRecord,
    getAllTrashRecords, getMonthlyRecords,
    currentMonth, currentYear, monthKey,
    exchangeRate, currencyView, setCurrencyView,
    convertToINR, formatUSD, formatINR
  } = useContext(AppContext);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editRecordId, setEditRecordId] = useState(null);
  const [sortBy, setSortBy] = useState('onboardingDate');
  const [sortDir, setSortDir] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [undoData, setUndoData] = useState(null);
  const [undoRemaining, setUndoRemaining] = useState(0);
  const undoIntervalRef = useRef(null);

  useEffect(() => {
    if (undoData && undoRemaining > 0) {
      undoIntervalRef.current = setInterval(() => {
        setUndoRemaining(prev => {
          if (prev <= 1) {
            clearInterval(undoIntervalRef.current);
            setUndoData(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(undoIntervalRef.current);
    }
  }, [undoData, undoRemaining]);

  const handleUndo = () => {
    if (!undoData) return;
    undoData.records.forEach(rec => {
      restoreRecord(rec.recordId, rec.previousStatus || 'Active', rec.month, rec.year);
    });
    clearInterval(undoIntervalRef.current);
    setUndoData(null);
    setUndoRemaining(0);
  };

  const records = currentMonthRecords;
  const activeRecords = currentMonthActive;
  const cancelledRecords = currentMonthCancelled;

  const activeCount = activeRecords.length;
  const totalMRR = activeRecords.reduce((s, r) => s + r.monthlyPrice, 0);
  const avgClientValue = activeCount > 0 ? totalMRR / activeCount : 0;
  const revenueLost = cancelledRecords.reduce((s, r) => s + r.monthlyPrice, 0);

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let nextMonthNum = parseInt(currentMonth) + 1;
  let nextYearNum = parseInt(currentYear);
  if (nextMonthNum > 12) { nextMonthNum = 1; nextYearNum++; }
  const nextMonthName = monthNames[nextMonthNum];
  const curMonthName = monthNames[parseInt(currentMonth)];

  const cashReceived = records.reduce((s, r) => s + ((r.paymentReceived || 0) - (r.refundAmount || 0) - (r.chargebackAmount || 0)), 0);

  const upcomingCollections = activeRecords.map(r => {
    const dueDay = r.paymentDueDay || parseInt(r.onboardingDate.split('-')[2]) || 1;
    const viewMonth = parseInt(currentMonth);
    const viewYear = parseInt(currentYear);
    const lastDay = new Date(viewYear, viewMonth, 0).getDate();
    const dueDayAdjusted = Math.min(dueDay, lastDay);
    const dueDate = new Date(viewYear, viewMonth - 1, dueDayAdjusted);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const hasPayment = r.paymentReceived > 0;
    return { ...r, diffDays, hasPayment };
  }).filter(r => !r.hasPayment && r.diffDays >= 0 && r.diffDays <= 7).sort((a, b) => a.diffDays - b.diffDays);

  const tenureBuckets = [
    { min: 9, max: Infinity, label: '9+ months', key: '9plus' },
    { min: 6, max: 9, label: '6-9 months', key: '6to9' },
    { min: 3, max: 6, label: '3-6 months', key: '3to6' },
    { min: 0, max: 3, label: '0-3 months', key: '0to3' },
  ];

  const tenures = activeRecords.map(r => calculateTenure(r.onboardingDate, currentMonth, currentYear));
  const bucketCounts = tenureBuckets.map(b => tenures.filter(t => t.months >= b.min && t.months < b.max).length);
  const [t9plus, t6to9, t3to6, tUnder3] = bucketCounts;

  const bucketRevenues = tenureBuckets.map(b => {
    const months = b.min === 9 ? Infinity : b.max;
    const min = b.min;
    return activeRecords.filter(r => {
      const m = calculateTenure(r.onboardingDate, currentMonth, currentYear).months;
      return m >= min && m < months;
    }).reduce((s, r) => s + r.monthlyPrice, 0);
  });
  const [rev9plus, rev6to9, rev3to6, revUnder3] = bucketRevenues;

  const sortedByDate = [...activeRecords].sort((a, b) => a.onboardingDate.localeCompare(b.onboardingDate));
  const oldest = sortedByDate[0];
  const newest = sortedByDate[sortedByDate.length - 1];

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sorted = [...records].filter(r => {
    if (!searchQuery) return true;
    return r.businessName.toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    let valA, valB;
    if (sortBy === 'onboardingDate') { valA = a.onboardingDate; valB = b.onboardingDate; }
    else if (sortBy === 'monthlyPrice') { valA = a.monthlyPrice; valB = b.monthlyPrice; }
    else if (sortBy === 'tenure') {
      valA = calculateTenure(a.onboardingDate, currentMonth, currentYear).months;
      valB = calculateTenure(b.onboardingDate, currentMonth, currentYear).months;
    }
    else if (sortBy === 'businessName') { valA = a.businessName.toLowerCase(); valB = b.businessName.toLowerCase(); }
    else { valA = a[sortBy]; valB = b[sortBy]; }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const isAllSelected = sorted.length > 0 && sorted.every(r => selectedIds.has(r.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(r => r.id)));
    }
  };

  const markAsPaid = (recordId, amount) => {
    updateRecordInMonth(recordId, { paymentReceived: amount, refundAmount: 0, chargebackAmount: 0 });
  };

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const [form, setForm] = useState({
    businessName: '', contactPerson: '', phone: '', email: '',
    monthlyPrice: '', onboardingDate: '',
    status: 'Active', statusDate: '', statusNote: 'None',
    contractEndDate: '', paymentDueDay: '', paymentMethod: 'Stripe', notes: '',
    paymentReceived: '', refundAmount: '', chargebackAmount: ''
  });

  const openAddModal = () => {
    setForm({
      businessName: '', contactPerson: '', phone: '', email: '',
      monthlyPrice: '', onboardingDate: '',
      status: 'Active', statusDate: '', statusNote: 'None',
      contractEndDate: '', paymentDueDay: '', paymentMethod: 'Stripe', notes: '',
      paymentReceived: '', refundAmount: '', chargebackAmount: ''
    });
    setEditRecordId(null);
    setShowAddModal(true);
  };

  const openEditModal = (record) => {
    setForm({
      businessName: record.businessName,
      contactPerson: record.contactPerson || '',
      phone: record.phone || '',
      email: record.email || '',
      monthlyPrice: record.monthlyPrice,
      onboardingDate: record.onboardingDate,
      status: record.status,
      statusDate: record.statusDate || '',
      statusNote: record.statusNote || 'None',
      contractEndDate: record.contractEndDate || '',
      paymentDueDay: record.paymentDueDay,
      paymentMethod: record.paymentMethod || 'Stripe',
      notes: record.notes || '',
      paymentReceived: record.paymentReceived || '',
      refundAmount: record.refundAmount || '',
      chargebackAmount: record.chargebackAmount || ''
    });
    setEditRecordId(record.id);
    setShowAddModal(true);
  };

  const saveClient = () => {
    if (!form.businessName || !form.monthlyPrice || !form.onboardingDate) return;
    const dueDay = form.paymentDueDay || new Date(form.onboardingDate).getDate();
    const recordData = {
      businessName: form.businessName,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      monthlyPrice: parseFloat(form.monthlyPrice),
      onboardingDate: form.onboardingDate,
      contractEndDate: form.contractEndDate,
      paymentDueDay: parseInt(dueDay),
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      status: form.status,
      statusDate: form.statusDate,
      statusNote: form.statusNote,
      paymentReceived: parseFloat(form.paymentReceived) || 0,
      refundAmount: parseFloat(form.refundAmount) || 0,
      chargebackAmount: parseFloat(form.chargebackAmount) || 0
    };

    if (editRecordId) {
      updateRecordInMonth(editRecordId, recordData);
    } else {
      addRecordToMonth(recordData);
    }
    setShowAddModal(false);
  };

  const promptDelete = (record) => {
    setDeleteTarget(record);
    setShowDeleteModal(true);
  };

  const confirmDelete = (deleteAll = false) => {
    if (!deleteTarget) return;
    if (deleteAll) {
      softDeleteRecordFromAllMonths(deleteTarget.businessName);
    } else {
      softDeleteRecord(deleteTarget.id);
    }
    setUndoData({
      records: [{
        recordId: deleteTarget.id,
        month: currentMonth,
        year: currentYear,
        previousStatus: deleteTarget.status,
        businessName: deleteTarget.businessName,
        deletedFromAll: deleteAll
      }]
    });
    setUndoRemaining(10);
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const confirmBulkDelete = () => {
    const recordsToDelete = sorted.filter(r => selectedIds.has(r.id));
    recordsToDelete.forEach(r => softDeleteRecord(r.id));
    setUndoData({
      records: recordsToDelete.map(r => ({
        recordId: r.id,
        month: currentMonth,
        year: currentYear,
        previousStatus: r.status,
        businessName: r.businessName,
        deletedFromAll: false
      }))
    });
    setUndoRemaining(10);
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => { setImportPreview(results.data); setShowImportModal(true); }
    });
  };

  const confirmImport = () => {
    if (!importPreview) return;
    let imported = 0, skipped = 0, errors = [];
    importPreview.forEach((row, i) => {
      const name = row['Buiness Name'] || row['Business Name'] || row['business_name'] || row['Name'] || '';
      let dateRaw = row['Month'] || row['Onboarding Date'] || row['onboarding_date'] || row['Date'] || '';
      let priceRaw = row['Value'] || row['Monthly Price'] || row['monthly_price'] || row['Price'] || '';
      const statusRaw = row['Status'] || row['status'] || 'Active';
      const clientName = row['Client Name'] || row['client_name'] || row['Contact Person'] || '';
      const phoneRaw = row['Contact No.'] || row['contact_no'] || row['Phone'] || '';
      const emailRaw = row['Email'] || row['email'] || '';
      if (!name) { errors.push(`Row ${i + 2}: Missing business name`); return; }
      let isoDate = parseGoogleSheetDate(dateRaw);
      if (!isoDate && dateRaw) { const d = new Date(dateRaw); if (!isNaN(d)) isoDate = d.toISOString().split('T')[0]; }
      if (!isoDate) { errors.push(`Row ${i + 2}: Invalid date "${dateRaw}"`); return; }
      const price = parseUSDAmount(priceRaw);
      if (!price) { errors.push(`Row ${i + 2}: Invalid price "${priceRaw}"`); return; }
      const dup = records.find(r => r.businessName === name && r.onboardingDate === isoDate);
      if (dup) { skipped++; return; }
      addRecordToMonth({
        businessName: name, contactPerson: clientName, phone: phoneRaw,
        email: emailRaw, monthlyPrice: price, onboardingDate: isoDate,
        paymentDueDay: new Date(isoDate).getDate(), paymentMethod: 'Stripe',
        notes: row['Notes'] || '', status: statusRaw
      });
      imported++;
    });
    alert(`${imported} clients imported. ${skipped} duplicates skipped.${errors.length ? '\n\nErrors:\n' + errors.join('\n') : ''}`);
    setShowImportModal(false); setImportPreview(null);
  };

  const showAmount = (usd) => currencyView === 'INR' ? formatINR(convertToINR(usd)) : formatUSD(usd);
  const pctOf = (val, total) => total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';

  const allTrash = getAllTrashRecords();
  const trashCount = allTrash.length;

  const emptyTrash = () => {
    if (trashCount === 0) return;
    if (!confirm(`Permanently delete all ${trashCount} trashed client${trashCount > 1 ? 's' : ''}? This cannot be undone.`)) return;
    allTrash.forEach(tr => permanentlyDeleteRecord(tr.id, tr._month, tr._year));
  };

  return (
    <div className="clients-page">
      {/* Undo Toast */}
      {undoData && (
        <div className="undo-toast">
          <span>{undoData.records.length > 1 ? `${undoData.records.length} clients moved to trash.` : 'Client moved to trash.'}</span>
          <button className="undo-btn" onClick={handleUndo}>Undo ({undoRemaining}s)</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Client Manager</h1>
          <p className="page-subtitle">{curMonthName} {currentYear} — Client payments tracked in USD.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
            <Upload size={14} /> Import
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileImport} />
          {trashCount > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowTrashModal(true)} style={{ borderColor: '#f59e0b', color: '#b45309' }}>
              <Archive size={14} /> View Trash ({trashCount})
            </button>
          )}
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={14} /> Add Client
          </button>
        </div>
      </div>

      {/* Collect This Week Widget */}
      {upcomingCollections.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #f59e0b', background: '#fffbeb' }}>
          <h3 className="mb-3 font-semibold flex items-center gap-2" style={{ color: '#b45309' }}>
            <AlertCircle size={18} /> COLLECT THIS WEEK
          </h3>
          <div className="flex flex-col gap-2">
            {upcomingCollections.map(r => (
              <div key={r.id} className="flex justify-between items-center p-3 rounded" style={{ background: '#fff', border: '1px solid var(--border-light)' }}>
                <div>
                  <span className="font-semibold mr-2 text-heading">{r.businessName}</span>
                  <span className="text-muted text-sm mr-2">— {formatUSD(r.monthlyPrice)} —</span>
                  <span className={`text-sm font-semibold ${r.diffDays === 0 ? 'text-warning' : 'text-body'}`}>
                    {r.diffDays === 0 ? 'Invoice due TODAY' : `Invoice due in ${r.diffDays} day${r.diffDays > 1 ? 's' : ''}`}
                  </span>
                </div>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => markAsPaid(r.id, r.monthlyPrice)}>
                  <Check size={14} /> Mark as Paid
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="stats-row">
        <div className="card stat-card">
          <div className="stat-label">Active Clients</div>
          <div className="stat-value">{activeCount}</div>
        </div>
        <div className="card stat-card" style={{ background: 'var(--success-bg)', borderColor: 'var(--success)' }}>
          <div className="stat-label" style={{ color: 'var(--success)' }}>Cash Received This Month</div>
          <div className="stat-value">{formatUSD(cashReceived)} / {formatINR(convertToINR(cashReceived))}</div>
          <div className="stat-sub">Net after refunds/chargebacks</div>
        </div>
        <div className="card stat-card" style={{ background: 'var(--info-bg)', borderColor: 'var(--info)' }}>
          <div className="stat-label" style={{ color: 'var(--info)' }}>Current Month MRR</div>
          <div className="stat-value">{formatUSD(totalMRR)} / {formatINR(convertToINR(totalMRR))}</div>
          <div className="stat-sub">From active clients only</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Average Client Value</div>
          <div className="stat-value">{formatUSD(avgClientValue)} / {formatINR(convertToINR(avgClientValue))}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Oldest Client</div>
          <div className="stat-value">{oldest ? oldest.businessName : '-'}</div>
          {oldest && <div className="stat-sub">{calculateTenure(oldest.onboardingDate, currentMonth, currentYear).text}</div>}
        </div>
        <div className="card stat-card">
          <div className="stat-label">Newest Client</div>
          <div className="stat-value">{newest ? newest.businessName : '-'}</div>
          {newest && <div className="stat-sub">{formatDate(newest.onboardingDate)}</div>}
        </div>
      </div>

      {/* Breakdown Row */}
      <div className="breakdown-row">
        <div className="card breakdown-card">
          <h3 className="breakdown-title">Client Age Breakdown</h3>
          <div className="breakdown-list">
            {tenureBuckets.map((b, i) => {
              const counts = [t9plus, t6to9, t3to6, tUnder3][i];
              const revs = [rev9plus, rev6to9, rev3to6, revUnder3][i];
              return (
                <div key={b.key} className="breakdown-item">
                  <div className="breakdown-left">
                    <span className="breakdown-label">{b.label}</span>
                    <div className="breakdown-bar"><div className="bar-fill" style={{ width: `${activeCount > 0 ? (counts / activeCount) * 100 : 0}%` }}></div></div>
                  </div>
                  <span className="breakdown-value">{counts} clients - {formatUSD(revs)}/mo</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card breakdown-card">
          <h3 className="breakdown-title">Revenue by Client Tenure</h3>
          <div className="revenue-tenure-list">
            {tenureBuckets.map((b, i) => {
              const revs = [rev9plus, rev6to9, rev3to6, revUnder3][i];
              return (
                <div key={b.key} className="rev-tenure-item">
                  <span className="rev-tenure-label">{b.label}</span>
                  <span className="rev-tenure-value">{formatUSD(revs)} ({pctOf(revs, totalMRR)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Client Status (Next Month Projection) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="mb-4 text-heading font-semibold text-lg">CLIENT STATUS (For {nextMonthName} onwards)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--success-bg)' }}>
            <h4 className="font-semibold text-success mb-3">ACTIVE CLIENTS (Will appear in {nextMonthName}):</h4>
            <div className="flex flex-col gap-2">
              {activeRecords.map(r => (
                <div key={r.id} className="flex justify-between items-center text-sm">
                  <span>&#10003; {r.businessName}</span>
                  <span className="font-semibold">{formatUSD(r.monthlyPrice)}/mo</span>
                </div>
              ))}
              {activeRecords.length === 0 && <div className="text-sm text-muted">No active clients.</div>}
            </div>
            <div className="mt-4 pt-3 border-top" style={{ borderTop: '1px solid rgba(22, 163, 74, 0.2)' }}>
              <div className="flex justify-between items-center font-bold text-success">
                <span>{nextMonthName} MRR Forecast:</span>
                <span>{formatUSD(totalMRR)} ({activeCount} active clients)</span>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--danger-bg)' }}>
            <h4 className="font-semibold text-danger mb-3">CANCELLED CLIENTS (Won't appear in {nextMonthName}):</h4>
            <div className="flex flex-col gap-2">
              {cancelledRecords.map(r => (
                <div key={r.id} className="text-sm border-bottom pb-2 mb-1" style={{ borderBottom: '1px dashed rgba(220, 38, 38, 0.2)' }}>
                  <div className="flex justify-between items-center font-semibold text-danger">
                    <span>&#10007; {r.businessName}</span>
                    <span>{formatUSD(r.monthlyPrice)}/mo</span>
                  </div>
                  {r.statusDate && <div className="text-muted mt-1 text-xs">Cancelled: {formatDate(r.statusDate)}</div>}
                  {r.statusNote && r.statusNote !== 'None' && <div className="text-muted text-xs">Note: &ldquo;{r.statusNote}&rdquo;</div>}
                  {r.paymentReceived > 0 && <div className="text-muted text-xs mt-1">Payment Made: {formatUSD(r.paymentReceived)}</div>}
                </div>
              ))}
              {cancelledRecords.length === 0 && <div className="text-sm text-muted">No cancelled clients.</div>}
            </div>
            <div className="mt-4 pt-3 border-top" style={{ borderTop: '1px solid rgba(220, 38, 38, 0.2)' }}>
              <div className="flex justify-between items-center font-bold text-danger">
                <span>Revenue Lost:</span>
                <span>-{formatUSD(revenueLost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <div className="bulk-toolbar-left">
            <span className="bulk-counter">{selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="bulk-toolbar-actions">
            <button className="btn btn-sm btn-secondary" onClick={toggleSelectAll}>
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => setShowBulkDeleteModal(true)}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Client Table */}
      {sorted.length > 0 ? (
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
                <th onClick={() => handleSort('businessName')}>Client Name <ArrowUpDown size={10} /></th>
                <th onClick={() => handleSort('onboardingDate')}>Onboarded <ArrowUpDown size={10} /></th>
                <th onClick={() => handleSort('tenure')}>Tenure <ArrowUpDown size={10} /></th>
                <th>Status</th>
                <th onClick={() => handleSort('monthlyPrice')}>Monthly Price <ArrowUpDown size={10} /></th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(record => {
                const tenure = calculateTenure(record.onboardingDate, currentMonth, currentYear);
                const ps = {
                  hasPayment: record.paymentReceived > 0,
                  received: record.paymentReceived || 0,
                  refund: record.refundAmount || 0,
                  chargeback: record.chargebackAmount || 0,
                  net: (record.paymentReceived || 0) - (record.refundAmount || 0) - (record.chargebackAmount || 0)
                };
                if (ps.hasPayment) {
                  ps.label = 'PAID';
                  ps.type = 'success';
                  ps.emoji = '\uD83D\uDFE2';
                } else {
                  const dueDay = record.paymentDueDay || parseInt(record.onboardingDate.split('-')[2]) || 1;
                  const viewMonth = parseInt(currentMonth);
                  const viewYear = parseInt(currentYear);
                  const lastDay = new Date(viewYear, viewMonth, 0).getDate();
                  const dueDayAdjusted = Math.min(dueDay, lastDay);
                  const dueDate = new Date(viewYear, viewMonth - 1, dueDayAdjusted);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  dueDate.setHours(0, 0, 0, 0);
                  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) { ps.label = `OVERDUE by ${Math.abs(diffDays)} Days`; ps.type = 'danger'; ps.emoji = '\uD83D\uDD34'; }
                  else if (diffDays === 0) { ps.label = 'DUE TODAY'; ps.type = 'warning'; ps.emoji = '\uD83D\uDFE0'; }
                  else if (diffDays <= 7) { ps.label = `Invoice in ${diffDays} Days`; ps.type = 'warning'; ps.emoji = '\uD83D\uDFE1'; }
                  else { ps.label = `DUE IN ${diffDays} DAYS`; ps.type = 'neutral'; ps.emoji = '\u26AA'; }
                }
                return (
                  <tr key={record.id} className={selectedIds.has(record.id) ? 'row-selected' : ''} style={{ cursor: 'pointer' }} onClick={() => { setDetailRecord(record); setShowDetailModal(true); }}>
                    <td className="checkbox-cell" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelectOne(record.id)}
                      />
                    </td>
                    <td>
                      <div className="client-name-cell">
                        <span className="status-dot" data-status={record.status}></span>
                        <span className="font-medium">{record.businessName}</span>
                      </div>
                    </td>
                    <td>{formatDate(record.onboardingDate)}</td>
                    <td>{tenure.text}</td>
                    <td>
                      <span className={`badge badge-${record.status === 'Active' ? 'success' : record.status === 'Paused' ? 'warning' : record.status === 'Cancelled' ? 'danger' : 'info'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold">{formatUSD(record.monthlyPrice)}</span>
                      <span className="text-muted text-xs" style={{ marginLeft: 6 }}>(&asymp;{formatINR(convertToINR(record.monthlyPrice))})</span>
                    </td>
                    <td>
                      {ps.hasPayment ? (
                        <div>
                          <span className="font-semibold" style={{ color: ps.net > 0 ? 'var(--success)' : (ps.received > 0 ? 'var(--warning)' : 'var(--text-heading)') }}>
                            {formatUSD(ps.net)}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`badge badge-${ps.type}`}>{ps.emoji} {ps.label}</span>
                            {(ps.refund > 0 || ps.chargeback > 0) && (
                              <span className="text-xs text-muted">
                                (-{formatUSD(ps.refund + ps.chargeback)})
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-${ps.type}`}>{ps.emoji} {ps.label}</span>
                          {ps.label !== 'PAID' && (
                            <button className="btn-icon" title="Mark as Paid" onClick={() => markAsPaid(record.id, record.monthlyPrice)}>
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-icon" title="Edit" onClick={e => { e.stopPropagation(); openEditModal(record); }}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-icon" title="Delete" style={{ color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); promptDelete(record); }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty-state">
          <div className="empty-icon">
            <Mail size={32} />
          </div>
          <h3>No clients yet this month</h3>
          <p className="text-muted text-sm">Add or import your client list to start tracking MRR and churn.</p>
          <button className="btn btn-primary" onClick={openAddModal} style={{ marginTop: 12 }}>
            <Plus size={14} /> Add Client
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 style={{ marginBottom: 12 }}>Delete &ldquo;{deleteTarget.businessName}&rdquo;?</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              This client will be moved to Trash for 30 days. You can restore it anytime during this period.
            </p>
            <p className="text-sm text-muted" style={{ marginBottom: 20 }}>
              <strong>Delete from:</strong> {curMonthName} {currentYear} only &mdash; other months are not affected.
            </p>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>Cancel</button>
              <button className="btn btn-danger-outline" onClick={() => confirmDelete(true)} style={{ borderColor: '#dc2626', color: '#dc2626' }}>
                <Trash2 size={14} /> Delete from All Months
              </button>
              <button className="btn btn-danger" onClick={() => confirmDelete(false)}>
                <Trash2 size={14} /> Delete from {curMonthName} Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowBulkDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ marginBottom: 12 }}>Delete {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''}?</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              The following clients will be moved to Trash for 30 days. You can restore them anytime during this period.
            </p>
            <div className="bulk-delete-list">
              {sorted.filter(r => selectedIds.has(r.id)).map(r => (
                <div key={r.id} className="bulk-delete-item">
                  <span className="font-medium">{r.businessName}</span>
                  <span className="text-muted text-sm">{formatUSD(r.monthlyPrice)}/mo &middot; Onboarded {formatDate(r.onboardingDate)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowBulkDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmBulkDelete}>
                <Trash2 size={14} /> Delete {selectedIds.size} to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>{editRecordId ? 'Edit Client' : 'Add New Client'}</h2>
            <div className="input-group">
              <label className="input-label">Business Name *</label>
              <input className="input-field" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Contact Person</label>
                <input className="input-field" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(999) 999-9999" />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input-field" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="client@example.com" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Monthly Price (USD) *</label>
                <input className="input-field" type="number" value={form.monthlyPrice} onChange={e => setForm({ ...form, monthlyPrice: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Status</label>
                <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {CLIENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {form.status === 'Cancelled' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <div className="input-group mb-0">
                  <label className="input-label">Date Cancelled</label>
                  <input className="input-field" type="date" value={form.statusDate} onChange={e => setForm({ ...form, statusDate: e.target.value })} />
                </div>
                <div className="input-group mb-0">
                  <label className="input-label">Status Note</label>
                  <select className="input-field" value={form.statusNote} onChange={e => setForm({ ...form, statusNote: e.target.value })}>
                    {STATUS_NOTES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Payment Record for Current Month */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16 }}>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><DollarSign size={16} /> Payment Record ({curMonthName} {currentYear})</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="input-group mb-0">
                  <label className="input-label">Payment Received ($)</label>
                  <input className="input-field" type="number" placeholder="0" value={form.paymentReceived} onChange={e => setForm({ ...form, paymentReceived: e.target.value })} />
                </div>
                <div className="input-group mb-0">
                  <label className="input-label">Refund Amount ($)</label>
                  <input className="input-field" type="number" placeholder="0" value={form.refundAmount} onChange={e => setForm({ ...form, refundAmount: e.target.value })} />
                </div>
                <div className="input-group mb-0">
                  <label className="input-label">Chargeback Amount ($)</label>
                  <input className="input-field" type="number" placeholder="0" value={form.chargebackAmount} onChange={e => setForm({ ...form, chargebackAmount: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 text-right text-sm">
                <span className="font-semibold text-heading">
                  Net Receipt: {formatUSD((parseFloat(form.paymentReceived) || 0) - (parseFloat(form.refundAmount) || 0) - (parseFloat(form.chargebackAmount) || 0))}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Onboarding Date *</label>
                <input className="input-field" type="date" value={form.onboardingDate} onChange={e => setForm({ ...form, onboardingDate: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Contract End Date</label>
                <input className="input-field" type="date" value={form.contractEndDate} onChange={e => setForm({ ...form, contractEndDate: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Payment Due Day</label>
                <input className="input-field" type="number" min="1" max="31" value={form.paymentDueDay} onChange={e => setForm({ ...form, paymentDueDay: e.target.value })} placeholder="Auto" />
              </div>
              <div className="input-group">
                <label className="input-label">Payment Method</label>
                <select className="input-field" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Notes</label>
              <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveClient}>Save Client</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportModal && importPreview && (
        <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportPreview(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2 style={{ marginBottom: 16 }}>Import Preview &mdash; {importPreview.length} rows</h2>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <table className="table">
                <thead>
                  <tr><th>#</th>{Object.keys(importPreview[0] || {}).map(k => <th key={k}>{k}</th>)}</tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 100).map((row, i) => (
                    <tr key={i}><td>{i + 1}</td>{Object.values(row).map((v, j) => <td key={j}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmImport}>Import All ({importPreview.length})</button>
            </div>
          </div>
        </div>
      )}

      {/* Trash View Modal */}
      {showTrashModal && (
        <div className="modal-overlay" onClick={() => setShowTrashModal(false)}>
          <div className="modal-content trash-modal" onClick={e => e.stopPropagation()}>
            <div className="trash-header">
              <div className="trash-header-top">
                <h2>Trash (Deleted Clients)</h2>
                {allTrash.length > 0 && (
                  <button className="btn btn-sm btn-danger" onClick={emptyTrash}>
                    <Trash2 size={12} /> Empty Bin
                  </button>
                )}
              </div>
              <p className="text-muted text-sm">Deleted clients are kept for 30 days before permanent deletion.</p>
            </div>
            {allTrash.length === 0 ? (
              <div className="card empty-state" style={{ margin: 0 }}>
                <div className="empty-icon"><Archive size={32} /></div>
                <h3>Trash is empty</h3>
                <p className="text-muted text-sm">Deleted clients will appear here.</p>
              </div>
            ) : (
              <div className="trash-list">
                {allTrash.map(tr => {
                  const delDate = tr.deletedAt ? new Date(tr.deletedAt) : new Date();
                  const expiresAt = new Date(delDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const monthLabel = MONTH_NAMES[parseInt(tr._month) - 1];
                  return (
                    <div key={`${tr._year}-${tr._month}-${tr.id}`} className="trash-item">
                      <div className="trash-item-main">
                        <h4 className="trash-item-name">{tr.businessName}</h4>
                        <div className="trash-item-meta">
                          <span>Deleted from {monthLabel} {tr._year}</span>
                          <span className="trash-meta-sep">&middot;</span>
                          <span>{formatDate(delDate.toISOString().split('T')[0])}</span>
                          {tr.deletedReason && (
                            <>
                              <span className="trash-meta-sep">&middot;</span>
                              <span>Reason: {tr.deletedReason}</span>
                            </>
                          )}
                        </div>
                        <div className="trash-item-details">
                          <span>Monthly Price: {formatUSD(tr.monthlyPrice)}</span>
                          <span className="trash-meta-sep">&middot;</span>
                          <span>Status before delete: {tr.status}</span>
                        </div>
                        {daysLeft > 0 ? (
                          <div className="trash-expiry">Will be permanently deleted in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</div>
                        ) : (
                          <div className="trash-expiry expired">Pending permanent deletion</div>
                        )}
                      </div>
                      <div className="trash-item-actions">
                        <button className="btn btn-sm btn-success" onClick={() => {
                          restoreRecord(tr.id, 'Active', tr._month, tr._year);
                        }}>
                          <RotateCcw size={12} /> Restore to Active
                        </button>
                        <button className="btn btn-sm btn-warning" onClick={() => {
                          restoreRecord(tr.id, 'Cancelled', tr._month, tr._year);
                        }}>
                          <RotateCcw size={12} /> Restore to Cancelled
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => {
                          if (confirm(`Permanently delete "${tr.businessName}" from ${monthLabel} ${tr._year}? This cannot be undone.`)) {
                            permanentlyDeleteRecord(tr.id, tr._month, tr._year);
                          }
                        }}>
                          <Trash2 size={12} /> Delete Forever
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowTrashModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {showDetailModal && detailRecord && (
        <div className="modal-overlay" onClick={() => { setShowDetailModal(false); setDetailRecord(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>{detailRecord.businessName}</h2>
              <button className="btn-icon" onClick={() => { setShowDetailModal(false); setDetailRecord(null); }}><X size={18} /></button>
            </div>
            <div className="detail-grid">
              <div className="detail-row">
                <span className="detail-label">Contact</span>
                <span className="detail-value">{detailRecord.contactPerson || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phone</span>
                <span className="detail-value">{detailRecord.phone || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{detailRecord.email || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Onboarded</span>
                <span className="detail-value">{formatDate(detailRecord.onboardingDate)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tenure</span>
                <span className="detail-value">{calculateTenure(detailRecord.onboardingDate, currentMonth, currentYear).text}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Monthly Price</span>
                <span className="detail-value">{formatUSD(detailRecord.monthlyPrice)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className={`badge badge-${detailRecord.status === 'Active' ? 'success' : detailRecord.status === 'Paused' ? 'warning' : 'danger'}`}>{detailRecord.status}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payment Method</span>
                <span className="detail-value">{detailRecord.paymentMethod || '—'}</span>
              </div>
              {detailRecord.notes && (
                <div className="detail-row">
                  <span className="detail-label">Notes</span>
                  <span className="detail-value">{detailRecord.notes}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowDetailModal(false); setDetailRecord(null); }}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                openEditModal(detailRecord);
                setShowDetailModal(false);
                setDetailRecord(null);
              }}>Edit Client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
