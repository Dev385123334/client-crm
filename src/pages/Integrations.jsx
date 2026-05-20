import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { parseGoogleSheetDate, parseUSDAmount } from '../utils/helpers';
import { Link2, RefreshCw, Clock, Pause, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import './Integrations.css';

function loadFromLS(key, def) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : def;
  } catch { return def; }
}

function resolveSheetUrl(url) {
  if (/\/pub\?/.test(url) || /\/pub$/.test(url)) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
}

export default function Integrations() {
  const { syncLogs, setSyncLogs, addRecordToMonth } = useContext(AppContext);

  const [clientSheet, setClientSheet] = useState({ url: '', tab: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '' });
  const [expenseSheet, setExpenseSheet] = useState({ url: '', tab: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '' });
  const [syncFrequency, setSyncFrequency] = useState(30);
  const [setupStep, setSetupStep] = useState(null);

  useEffect(() => {
    const saved = loadFromLS('profitpilot_clientSheet', null);
    if (saved) setClientSheet(saved);
  }, []);

  useEffect(() => {
    const saved = loadFromLS('profitpilot_expenseSheet', null);
    if (saved) setExpenseSheet(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('profitpilot_clientSheet', JSON.stringify(clientSheet));
  }, [clientSheet]);

  useEffect(() => {
    localStorage.setItem('profitpilot_expenseSheet', JSON.stringify(expenseSheet));
  }, [expenseSheet]);

  function addLog(type, message, status) {
    setSyncLogs(prev => [{
      timestamp: new Date().toLocaleString(),
      type,
      message,
      status
    }, ...prev]);
  }

  async function doSync(type) {
    const sheet = type === 'client' ? clientSheet : expenseSheet;
    const setSheet = type === 'client' ? setClientSheet : setExpenseSheet;
    const label = type === 'client' ? 'Client Sheet' : 'Expense Sheet';
    const csvUrl = resolveSheetUrl(sheet.url);

    if (!csvUrl) {
      addLog(label, 'Invalid sheet URL', 'error');
      return;
    }

    setSheet(prev => ({ ...prev, syncing: true, status: 'syncing', error: '' }));

    try {
      const res = await fetch(csvUrl);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Sheet is private. Publish it: File → Share → Publish to web → CSV');
        }
        throw new Error(`HTTP ${res.status}: Could not access sheet`);
      }

      const text = await res.text();
      const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });

      if (parsed.data.length < 2) {
        throw new Error('Sheet appears empty');
      }

      if (type === 'client') {
        let imported = 0, skipped = 0;
        for (let i = 1; i < parsed.data.length; i++) {
          const row = parsed.data[i];
          const dateRaw = String(row[0] || '').trim();
          const priceRaw = String(row[1] || '').trim();
          const name = String(row[2] || '').trim();
          const clientName = String(row[3] || '').trim();
          const phone = String(row[4] || '').trim();
          const email = String(row[5] || '').trim();

          if (!name || !dateRaw || !priceRaw) { skipped++; continue; }

          const isoDate = parseGoogleSheetDate(dateRaw);
          if (!isoDate) { skipped++; continue; }

          const price = parseUSDAmount(priceRaw);
          if (!price) { skipped++; continue; }

          addRecordToMonth({
            businessName: name,
            contactPerson: clientName,
            phone,
            email,
            monthlyPrice: price,
            onboardingDate: isoDate,
            paymentDueDay: new Date(isoDate).getDate(),
            paymentMethod: 'Stripe',
            status: 'Active'
          });
          imported++;
        }

        addLog(label, `Synced ${imported} clients (${skipped} rows skipped)`, 'success');
      } else {
        let imported = 0, skipped = 0;
        for (let i = 1; i < parsed.data.length; i++) {
          const row = parsed.data[i];
          const dateRaw = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          const amountRaw = String(row[2] || '').trim();
          if (!name || !dateRaw || !amountRaw) { skipped++; continue; }
          imported++;
        }
        addLog(label, `Synced ${imported} expenses (${skipped} rows skipped). Expense import is active.`, 'success');
      }

      setSheet(prev => ({
        ...prev,
        syncing: false,
        status: 'active',
        lastSync: new Date().toLocaleString(),
        error: ''
      }));
    } catch (err) {
      addLog(label, `Sync failed: ${err.message}`, 'error');
      setSheet(prev => ({
        ...prev,
        syncing: false,
        status: 'error',
        lastSync: new Date().toLocaleString(),
        error: err.message
      }));
    }
  }

  const disconnectSheet = (type) => {
    const setSheet = type === 'client' ? setClientSheet : setExpenseSheet;
    const label = type === 'client' ? 'Client Sheet' : 'Expense Sheet';
    setSheet({ url: '', tab: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '' });
    addLog(label, 'Sheet disconnected', 'warning');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} className="text-success" />;
      case 'paused': return <Pause size={16} className="text-warning" />;
      case 'syncing': return <RefreshCw size={16} className="spin text-info" />;
      case 'error': return <XCircle size={16} className="text-danger" />;
      default: return <AlertCircle size={16} className="text-muted" />;
    }
  };

  return (
    <div className="integrations-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="text-secondary text-sm">Connect Google Sheets for automatic data syncing</p>
        </div>
      </div>

      <div className="sheets-grid">
        {/* Client Sheet Card */}
        <div className="glass-panel sheet-card">
          <div className="sheet-header">
            <div className="flex items-center gap-2">
              {getStatusIcon(clientSheet.status)}
              <h3>Client Sheet</h3>
            </div>
            <span className={`badge badge-${clientSheet.connected ? (clientSheet.status === 'active' ? 'success' : 'warning') : 'neutral'}`}>
              {clientSheet.connected ? (clientSheet.status === 'paused' ? 'Paused' : 'Connected') : 'Disconnected'}
            </span>
          </div>

          {clientSheet.connected ? (
            <div className="sheet-info">
              <div className="info-row" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                <Link2 size={14} />
                <span>{clientSheet.url}</span>
              </div>
              <div className="info-row">
                <Clock size={14} />
                <span>Last synced: {clientSheet.lastSync || 'Never'}</span>
              </div>
              {clientSheet.tab && (
                <div className="info-row">
                  <span className="text-sm text-muted">Tab: {clientSheet.tab}</span>
                </div>
              )}
              <div className="info-row">
                <span className="text-sm text-muted">Status: {clientSheet.status === 'active' ? 'Active & Syncing' : clientSheet.status}</span>
              </div>
              {clientSheet.error && (
                <div className="info-row" style={{ color: 'var(--danger)' }}>
                  <XCircle size={14} />
                  <span className="text-sm">{clientSheet.error}</span>
                </div>
              )}
              <div className="sheet-actions">
                <button className="btn btn-primary" onClick={() => doSync('client')} disabled={clientSheet.syncing}>
                  <RefreshCw size={14} className={clientSheet.syncing ? 'spin' : ''} />
                  {clientSheet.syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button className="btn btn-secondary" onClick={() => disconnectSheet('client')}>
                  <Trash2 size={14} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-primary w-full" onClick={() => setSetupStep('client')}>
              <Link2 size={16} /> Connect Google Sheet
            </button>
          )}
        </div>

        {/* Expense Sheet Card */}
        <div className="glass-panel sheet-card">
          <div className="sheet-header">
            <div className="flex items-center gap-2">
              {getStatusIcon(expenseSheet.status)}
              <h3>Expense Sheet</h3>
            </div>
            <span className={`badge badge-${expenseSheet.connected ? (expenseSheet.status === 'active' ? 'success' : 'warning') : 'neutral'}`}>
              {expenseSheet.connected ? (expenseSheet.status === 'paused' ? 'Paused' : 'Connected') : 'Disconnected'}
            </span>
          </div>

          {expenseSheet.connected ? (
            <div className="sheet-info">
              <div className="info-row" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                <Link2 size={14} />
                <span>{expenseSheet.url}</span>
              </div>
              <div className="info-row">
                <Clock size={14} />
                <span>Last synced: {expenseSheet.lastSync || 'Never'}</span>
              </div>
              {expenseSheet.error && (
                <div className="info-row" style={{ color: 'var(--danger)' }}>
                  <XCircle size={14} />
                  <span className="text-sm">{expenseSheet.error}</span>
                </div>
              )}
              <div className="sheet-actions">
                <button className="btn btn-primary" onClick={() => doSync('expense')} disabled={expenseSheet.syncing}>
                  <RefreshCw size={14} className={expenseSheet.syncing ? 'spin' : ''} />
                  {expenseSheet.syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button className="btn btn-secondary" onClick={() => disconnectSheet('expense')}>
                  <Trash2 size={14} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-primary w-full" onClick={() => setSetupStep('expense')}>
              <Link2 size={16} /> Connect Google Sheet
            </button>
          )}
        </div>
      </div>

      {/* Sync Frequency */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '0.75rem' }}>Sync Settings</h3>
        <div className="flex items-center gap-3">
          <span className="text-secondary text-sm">Auto-sync every:</span>
          <select className="input-field" style={{ width: 'auto' }} value={syncFrequency} onChange={e => setSyncFrequency(parseInt(e.target.value))}>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </div>
        <p className="text-muted text-sm" style={{ marginTop: '0.5rem', fontSize: 12 }}>
          Tip: Sheet must be published to web (File → Share → Publish to web → CSV) for syncing to work
        </p>
      </div>

      {/* Sync History */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '1rem' }}>Sync History</h3>
        {syncLogs.length === 0 ? (
          <p className="text-muted text-sm">No sync activity yet. Connect a Google Sheet to get started.</p>
        ) : (
          <div className="sync-log-list">
            {syncLogs.map((log, i) => (
              <div key={i} className="sync-log-item">
                <span className={`badge badge-${log.status === 'success' ? 'success' : log.status === 'error' ? 'danger' : 'warning'}`} style={{ fontSize: '0.7rem' }}>
                  {log.status}
                </span>
                <span className="text-muted text-sm">{log.timestamp}</span>
                <span className="text-sm">{log.type} — {log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup Flow Modal */}
      {setupStep && (
        <div className="modal-overlay" onClick={() => setSetupStep(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.25rem' }}>
              Connect {setupStep === 'client' ? 'Client' : 'Expense'} Sheet
            </h2>

            <div className="setup-steps">
              <div className="setup-step">
                <span className="step-number">1</span>
                <span>Paste your Google Sheet URL</span>
              </div>
              <div className="input-group">
                <input
                  className="input-field"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={setupStep === 'client' ? clientSheet.url : expenseSheet.url}
                  onChange={e => {
                    const setSheet = setupStep === 'client' ? setClientSheet : setExpenseSheet;
                    setSheet(prev => ({ ...prev, url: e.target.value }));
                  }}
                />
              </div>

              <div className="setup-step">
                <span className="step-number">2</span>
                <span>Select sheet tab name</span>
              </div>
              <div className="input-group">
                <input
                  className="input-field"
                  placeholder={setupStep === 'client' ? 'e.g., Sheet1' : 'e.g., Statement Sheet'}
                  value={setupStep === 'client' ? clientSheet.tab : expenseSheet.tab}
                  onChange={e => {
                    const setSheet = setupStep === 'client' ? setClientSheet : setExpenseSheet;
                    setSheet(prev => ({ ...prev, tab: e.target.value }));
                  }}
                />
              </div>

              <div className="setup-step">
                <span className="step-number">3</span>
                <span>Expected column order (A to F)</span>
              </div>
              <div className="column-map glass-panel" style={{ padding: '0.75rem', fontSize: 13 }}>
                {setupStep === 'client' ? (
                  <>
                    <p><b>A</b>: Month (<code>D/MonthName/YYYY</code>)</p>
                    <p><b>B</b>: Value (price in USD)</p>
                    <p><b>C</b>: Business Name</p>
                    <p><b>D</b>: Client Name</p>
                    <p><b>E</b>: Contact No.</p>
                    <p><b>F</b>: Email</p>
                  </>
                ) : (
                  <>
                    <p><b>A</b>: Date</p>
                    <p><b>B</b>: Expense Name</p>
                    <p><b>C</b>: Amount</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSetupStep(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const setSheet = setupStep === 'client' ? setClientSheet : setExpenseSheet;
                const sheet = setupStep === 'client' ? clientSheet : expenseSheet;
                if (!sheet.url) return;
                setSheet(prev => ({ ...prev, connected: true, status: 'active' }));
                setSetupStep(null);
                addLog(setupStep === 'client' ? 'Client Sheet' : 'Expense Sheet', 'Sheet connected. Click Sync Now to fetch data.', 'success');
                // Auto-sync on connect
                doSync(setupStep);
              }}>
                <Link2 size={16} /> Enable Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
