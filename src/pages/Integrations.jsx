import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { AuthContext } from '../context/AuthContext';
import { parseGoogleSheetDate, parseUSDAmount, parseINRAmount, categorizeExpense, parseTabName, getBaseRole } from '../utils/helpers';
import { fetchSheetTabs, parseSheetUrl, resolveSheetUrl } from '../utils/sheets';
import { v4 as uuidv4 } from 'uuid';
import { Link2, RefreshCw, Clock, Pause, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import './Integrations.css';

function loadFromLS(key, def) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : def;
  } catch { return def; }
}

function parseExpenseDate(dateStr) {
  if (!dateStr) return null;
  let parts = dateStr.split('/');
  if (parts.length !== 3) parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  d = d.padStart(2, '0');
  m = m.padStart(2, '0');
  if (y.length === 2) y = '20' + y;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${m}-${d}`;
}

const VITE_GOOGLE_SHEETS_API_KEY = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GOOGLE_SHEETS_API_KEY : '';

export default function Integrations() {
  const { syncLogs, setSyncLogs, addRecordToMonth, saveRecordsNow, expenses, setExpenses } = useContext(AppContext);
  const { userRole } = useContext(AuthContext);
  const baseRole = getBaseRole(userRole);
  const canSeeClient = baseRole === 'admin' || baseRole === 'pm_editor';
  const canSeeExpense = baseRole === 'admin' || baseRole === 'hr_editor';

  const [clientSheet, setClientSheet] = useState(() => {
    const saved = loadFromLS('profitpilot_clientSheet', null);
    const defaults = { url: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '', foundTabs: [] };
    return saved ? { ...defaults, ...saved } : defaults;
  });
  const [expenseSheet, setExpenseSheet] = useState(() => {
    const saved = loadFromLS('profitpilot_expenseSheet', null);
    const defaults = { url: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '', foundTabs: [] };
    return saved ? { ...defaults, ...saved } : defaults;
  });
  const [syncFrequency, setSyncFrequency] = useState(30);
  const [setupStep, setSetupStep] = useState(null);
  const [setupError, setSetupError] = useState('');
  const [syncProgress, setSyncProgress] = useState('');

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

    if (type === 'expense') {
      const csvUrl = resolveSheetUrl(sheet.url);
      if (!csvUrl) {
        addLog(label, 'Invalid sheet URL', 'error');
        return;
      }

      const sheetInfo = parseSheetUrl(sheet.url);
      if (!sheetInfo) {
        addLog(label, 'Could not extract sheet ID from URL', 'error');
        return;
      }

      if (!VITE_GOOGLE_SHEETS_API_KEY) {
        addLog(label, 'VITE_GOOGLE_SHEETS_API_KEY is not set in environment. Add it to .env and restart.', 'error');
        return;
      }

      setSheet(prev => ({ ...prev, syncing: true, status: 'syncing', error: '' }));
      setSyncProgress('');

      try {
        setSyncProgress('Detecting sheet tabs...');
        const tabs = await fetchSheetTabs(sheetInfo.id, VITE_GOOGLE_SHEETS_API_KEY);
        const monthTabs = [];
        for (const tab of tabs) {
          const parsed = parseTabName(tab.title);
          if (parsed) monthTabs.push({ ...tab, parsed });
        }

        if (monthTabs.length === 0) {
          throw new Error(`No tabs found matching "Month YYYY" format. Found tabs: ${tabs.map(t => t.title).join(', ') || 'none'}`);
        }

        let totalImported = 0, totalSkipped = 0;
        const allNew = [];
        const tabResults = [];

        for (const monthTab of monthTabs) {
          setSyncProgress(`Syncing ${monthTab.title}...`);
          const tabUrl = resolveSheetUrl(sheet.url, monthTab.gid);
          if (!tabUrl) continue;

          const res = await fetch(tabUrl);
          if (!res.ok) {
            tabResults.push(`${monthTab.title}: HTTP ${res.status}`);
            continue;
          }

          const text = await res.text();
          if (/<html|<head|<body/i.test(text)) {
            tabResults.push(`${monthTab.title}: Private sheet`);
            continue;
          }

          const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
          if (parsed.data.length < 2) {
            tabResults.push(`${monthTab.title}: Empty`);
            continue;
          }

          let imported = 0, skipped = 0;
          const startRow = parseExpenseDate(String(parsed.data[0]?.[0] || '')) ? 0 : 1;
          for (let i = startRow; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            const dateRaw = String(row[0] || '').trim();
            const name = String(row[1] || '').trim();
            const amountRaw = String(row[2] || '').trim();
            if (!name || !amountRaw) { skipped++; continue; }
            const amount = parseINRAmount(amountRaw);
            if (!amount) { skipped++; continue; }
            const isoDate = parseExpenseDate(dateRaw) || `${monthTab.parsed.year}-${monthTab.parsed.month}-01`;
            const isDup = expenses.some(e => e.date === isoDate && e.name === name && e.amount === amount);
            if (isDup) { skipped++; continue; }
            allNew.push({
              id: uuidv4(),
              name,
              amount,
              category: categorizeExpense(name),
              frequency: 'One-Time',
              date: isoDate,
              status: 'Paid',
              notes: '',
              month: monthTab.parsed.month,
              year: monthTab.parsed.year
            });
            imported++;
          }
          tabResults.push(`${monthTab.title}: ${imported} imported, ${skipped} skipped`);
          totalImported += imported;
          totalSkipped += skipped;
        }

        if (allNew.length > 0) {
          setExpenses(prev => [...prev, ...allNew]);
        }

        setSheet(prev => ({
          ...prev,
          syncing: false,
          status: 'active',
          lastSync: new Date().toLocaleString(),
          foundTabs: monthTabs.map(t => t.title),
          error: ''
        }));

        const detail = tabResults.join(' | ');
        addLog(label, totalImported > 0
          ? `Synced ${totalImported} expenses across ${monthTabs.length} month(s). ${detail}`
          : `No new expenses. ${detail}`, totalImported > 0 ? 'success' : 'info');
        setSyncProgress('');

      } catch (err) {
        addLog(label, `Sync failed: ${err.message}`, 'error');
        setSheet(prev => ({
          ...prev,
          syncing: false,
          status: 'error',
          lastSync: new Date().toLocaleString(),
          error: err.message
        }));
        setSyncProgress('');
      }
    } else {
      const csvUrl = resolveSheetUrl(sheet.url);
      if (!csvUrl) {
        addLog(label, 'Invalid sheet URL', 'error');
        return;
      }

      const sheetInfo = parseSheetUrl(sheet.url);
      if (!sheetInfo) {
        addLog(label, 'Could not extract sheet ID from URL', 'error');
        return;
      }

      if (!VITE_GOOGLE_SHEETS_API_KEY) {
        addLog(label, 'VITE_GOOGLE_SHEETS_API_KEY is not set in environment. Add it to .env and restart.', 'error');
        return;
      }

      setSheet(prev => ({ ...prev, syncing: true, status: 'syncing', error: '' }));
      setSyncProgress('');

      try {
        setSyncProgress('Detecting sheet tabs...');
        const tabs = await fetchSheetTabs(sheetInfo.id, VITE_GOOGLE_SHEETS_API_KEY);
        const monthTabs = [];
        for (const tab of tabs) {
          const parsed = parseTabName(tab.title);
          if (parsed) monthTabs.push({ ...tab, parsed });
        }

        if (monthTabs.length === 0) {
          throw new Error(`No tabs found matching "Month YYYY" format. Found tabs: ${tabs.map(t => t.title).join(', ') || 'none'}`);
        }

        let totalImported = 0, totalSkipped = 0;
        const tabResults = [];

        for (const monthTab of monthTabs) {
          setSyncProgress(`Syncing ${monthTab.title}...`);
          const tabUrl = resolveSheetUrl(sheet.url, monthTab.gid);
          if (!tabUrl) continue;

          const res = await fetch(tabUrl);
          if (!res.ok) {
            tabResults.push(`${monthTab.title}: HTTP ${res.status}`);
            continue;
          }

          const text = await res.text();
          if (/<html|<head|<body/i.test(text)) {
            tabResults.push(`${monthTab.title}: Private sheet`);
            continue;
          }

          const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
          if (parsed.data.length < 2) {
            tabResults.push(`${monthTab.title}: Empty`);
            continue;
          }

          let imported = 0, skipped = 0;
          const startRow = parseGoogleSheetDate(String(parsed.data[0]?.[0] || '')) ? 0 : 1;
          for (let i = startRow; i < parsed.data.length; i++) {
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
            }, monthTab.parsed.month, monthTab.parsed.year);
            imported++;
          }
          tabResults.push(`${monthTab.title}: ${imported} imported, ${skipped} skipped`);
          totalImported += imported;
          totalSkipped += skipped;
        }

        await new Promise(r => setTimeout(r, 800));

        try {
          await saveRecordsNow();
        } catch (saveErr) {
          throw new Error(`Data was parsed but failed to save to database: ${saveErr.message}`, { cause: saveErr });
        }

        setSheet(prev => ({
          ...prev,
          syncing: false,
          status: 'active',
          lastSync: new Date().toLocaleString(),
          foundTabs: monthTabs.map(t => t.title),
          error: ''
        }));

        const detail = tabResults.join(' | ');
        addLog(label, totalImported > 0
          ? `Synced ${totalImported} clients across ${monthTabs.length} month(s). ${detail}`
          : `No new clients. ${detail}`, totalImported > 0 ? 'success' : 'info');
        setSyncProgress('');

      } catch (err) {
        addLog(label, `Sync failed: ${err.message}`, 'error');
        setSheet(prev => ({
          ...prev,
          syncing: false,
          status: 'error',
          lastSync: new Date().toLocaleString(),
          error: err.message
        }));
        setSyncProgress('');
      }
    }
  }

  const disconnectSheet = (type) => {
    const setSheet = type === 'client' ? setClientSheet : setExpenseSheet;
    const label = type === 'client' ? 'Client Sheet' : 'Expense Sheet';
    if (type === 'client') {
      setSheet({ url: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '', foundTabs: [] });
    } else {
      setSheet({ url: '', connected: false, syncing: false, lastSync: null, status: 'disconnected', error: '', foundTabs: [] });
    }
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
        {canSeeClient && (
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
              {syncProgress && (
                <div className="info-row">
                  <RefreshCw size={14} className="spin" />
                  <span className="text-sm">{syncProgress}</span>
                </div>
              )}
              {(clientSheet.foundTabs || []).length > 0 && (
                <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <span className="text-sm text-muted">Found {(clientSheet.foundTabs || []).length} month tab(s):</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {clientSheet.foundTabs.map((tab, i) => (
                      <span key={i} className="badge badge-success" style={{ fontSize: '0.7rem' }}>{tab}</span>
                    ))}
                  </div>
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
            <button className="btn btn-primary w-full" onClick={() => { setSetupStep('client'); setSetupError(''); }}>
              <Link2 size={16} /> Connect Google Sheet
            </button>
          )}
        </div>
        )}

        {canSeeExpense && (
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
              {syncProgress && (
                <div className="info-row">
                  <RefreshCw size={14} className="spin" />
                  <span className="text-sm">{syncProgress}</span>
                </div>
              )}
              {(expenseSheet.foundTabs || []).length > 0 && (
                <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <span className="text-sm text-muted">Found {(expenseSheet.foundTabs || []).length} month tab(s):</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {expenseSheet.foundTabs.map((tab, i) => (
                      <span key={i} className="badge badge-success" style={{ fontSize: '0.7rem' }}>{tab}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="info-row">
                <span className="text-sm text-muted">Status: {expenseSheet.status === 'active' ? 'Active & Syncing' : expenseSheet.status}</span>
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
            <button className="btn btn-primary w-full" onClick={() => { setSetupStep('expense'); setSetupError(''); }}>
              <Link2 size={16} /> Connect Google Sheet
            </button>
          )}
        </div>
        )}
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
          Tip: Name tabs as <code>Month YYYY</code> (e.g. <code>January 2025</code>) for auto-detection on both Client and Expense sheets.
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
                <span>Expected column order (A to F)</span>
              </div>
              <div className="column-map glass-panel" style={{ padding: '0.75rem', fontSize: 13 }}>
                {setupStep === 'client' ? (
                  <>
                    <p><b>A</b>: Date (<code>D/MonthName/YYYY</code>)</p>
                    <p><b>B</b>: Value (price in USD)</p>
                    <p><b>C</b>: Business Name</p>
                    <p><b>D</b>: Client Name</p>
                    <p><b>E</b>: Contact No.</p>
                    <p><b>F</b>: Email</p>
                    <p className="text-muted" style={{ marginTop: 6, fontSize: 11 }}>
                      Tab names must follow <code>Month YYYY</code> format (e.g. <code>January 2025</code>).
                      All matching tabs will be detected and synced automatically.
                    </p>
                  </>
                ) : (
                  <>
                    <p><b>A</b>: Date (<code>DD/MM/YYYY</code>)</p>
                    <p><b>B</b>: Expense Name</p>
                    <p><b>C</b>: Amount</p>
                    <p className="text-muted" style={{ marginTop: 6, fontSize: 11 }}>
                      Tab names must follow <code>Month YYYY</code> format (e.g. <code>January 2025</code>).
                      All matching tabs will be detected and synced automatically.
                    </p>
                  </>
                )}
              </div>

              {setupError && (
                <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,0,0,0.08)', borderRadius: 6 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>Connection Error</p>
                  <p style={{ marginBottom: 4 }}>{setupError}</p>
                  <p style={{ fontSize: 11, opacity: 0.8 }}>
                    To fix this, share your sheet publicly:
                    <br />1. In your sheet, click <b>Share</b> (top-right)
                    <br />2. Change to <b>"Anyone with the link"</b> → <b>"Viewer"</b>
                    <br />3. Also go to <b>File → Share → Publish to web</b> → <b>"Entire document"</b> → <b>Publish</b>
                    <br />4. Then click Enable Sync again
                  </p>
                </div>
              )}
              {setupStep === 'client' && !VITE_GOOGLE_SHEETS_API_KEY && (
                <div style={{ color: 'var(--warning)', fontSize: 13, marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,165,0,0.08)', borderRadius: 6 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>API Key Missing</p>
                  <p style={{ fontSize: 11, opacity: 0.8 }}>
                    Set <code>VITE_GOOGLE_SHEETS_API_KEY</code> in your <code>.env</code> file and restart the server.
                  </p>
                </div>
              )}
              {setupStep === 'expense' && !VITE_GOOGLE_SHEETS_API_KEY && (
                <div style={{ color: 'var(--warning)', fontSize: 13, marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,165,0,0.08)', borderRadius: 6 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>API Key Missing</p>
                  <p style={{ fontSize: 11, opacity: 0.8 }}>
                    Set <code>VITE_GOOGLE_SHEETS_API_KEY</code> in your <code>.env</code> file and restart the server.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setSetupStep(null); setSetupError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                const setSheet = setupStep === 'client' ? setClientSheet : setExpenseSheet;
                const sheet = setupStep === 'client' ? clientSheet : expenseSheet;
                if (!sheet.url) return;
                if (setupStep === 'expense') {
                  if (!VITE_GOOGLE_SHEETS_API_KEY) return;
                  const sheetInfo = parseSheetUrl(sheet.url);
                  if (sheetInfo) {
                    try {
                      const tabs = await fetchSheetTabs(sheetInfo.id, VITE_GOOGLE_SHEETS_API_KEY);
                      const monthTabs = tabs.filter(t => parseTabName(t.title)).map(t => t.title);
                      setSheet(prev => ({ ...prev, connected: true, status: 'active', foundTabs: monthTabs }));
                      setSetupStep(null);
                      setSetupError('');
                      addLog('Expense Sheet', `Connected. Found ${monthTabs.length} month tab(s): ${monthTabs.join(', ') || 'none'}`, 'success');
                      doSync('expense');
                    } catch (err) {
                      setSetupError(err.message);
                    }
                  } else {
                    setSheet(prev => ({ ...prev, connected: true, status: 'active' }));
                    setSetupStep(null);
                    setSetupError('');
                    addLog('Expense Sheet', 'Sheet connected. Click Sync Now to fetch data.', 'success');
                    doSync('expense');
                  }
                } else {
                  if (!VITE_GOOGLE_SHEETS_API_KEY) return;
                  const sheetInfo = parseSheetUrl(sheet.url);
                  if (sheetInfo) {
                    try {
                      const tabs = await fetchSheetTabs(sheetInfo.id, VITE_GOOGLE_SHEETS_API_KEY);
                      const monthTabs = tabs.filter(t => parseTabName(t.title)).map(t => t.title);
                      setSheet(prev => ({ ...prev, connected: true, status: 'active', foundTabs: monthTabs }));
                      setSetupStep(null);
                      setSetupError('');
                      addLog('Client Sheet', `Connected. Found ${monthTabs.length} month tab(s): ${monthTabs.join(', ') || 'none'}`, 'success');
                      doSync('client');
                    } catch (err) {
                      setSetupError(err.message);
                    }
                  } else {
                    setSheet(prev => ({ ...prev, connected: true, status: 'active' }));
                    setSetupStep(null);
                    setSetupError('');
                    addLog('Client Sheet', 'Sheet connected. Click Sync Now to fetch data.', 'success');
                    doSync('client');
                  }
                }
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
