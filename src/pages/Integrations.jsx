import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Link2, RefreshCw, Pause, Play, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import './Integrations.css';

export default function Integrations() {
  const { syncLogs, setSyncLogs } = useContext(AppContext);

  const [clientSheet, setClientSheet] = useState({ url: '', tab: '', connected: false, syncing: false, lastSync: null, status: 'disconnected' });
  const [expenseSheet, setExpenseSheet] = useState({ url: '', tab: '', connected: false, syncing: false, lastSync: null, status: 'disconnected' });
  const [syncFrequency, setSyncFrequency] = useState(30);
  const [setupStep, setSetupStep] = useState(null); // 'client' | 'expense' | null

  // Column mappings
  const [columnMap, setColumnMap] = useState({
    client: { dateCol: 'A', priceCol: 'B', nameCol: 'C' },
    expense: { dateCol: 'A', nameCol: 'B', amountCol: 'C' }
  });

  const connectSheet = (type) => {
    const sheet = type === 'client' ? clientSheet : expenseSheet;
    if (!sheet.url) return;

    // Simulate connection
    const setSheet = type === 'client' ? setClientSheet : setExpenseSheet;
    setSheet(prev => ({ ...prev, connected: true, syncing: true, status: 'syncing' }));

    setTimeout(() => {
      setSheet(prev => ({
        ...prev,
        syncing: false,
        status: 'active',
        lastSync: new Date().toLocaleString()
      }));
      setSyncLogs(prev => [{
        timestamp: new Date().toLocaleString(),
        type: type === 'client' ? 'Client Sheet' : 'Expense Sheet',
        message: `Initial sync completed successfully`,
        status: 'success'
      }, ...prev]);
    }, 2000);

    setSetupStep(null);
  };

  const syncNow = (type) => {
    const setSheet = type === 'client' ? setClientSheet : setExpenseSheet;
    setSheet(prev => ({ ...prev, syncing: true }));

    setTimeout(() => {
      setSheet(prev => ({
        ...prev,
        syncing: false,
        lastSync: new Date().toLocaleString()
      }));
      setSyncLogs(prev => [{
        timestamp: new Date().toLocaleString(),
        type: type === 'client' ? 'Client Sheet' : 'Expense Sheet',
        message: `Manual sync completed`,
        status: 'success'
      }, ...prev]);
    }, 1500);
  };

  const togglePause = (type) => {
    const setSheet = type === 'client' ? setClientSheet : setExpenseSheet;
    setSheet(prev => ({
      ...prev,
      status: prev.status === 'paused' ? 'active' : 'paused'
    }));
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

      {/* Connected Sheets Status */}
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
              <div className="info-row">
                <Clock size={14} />
                <span>Last synced: {clientSheet.lastSync || 'Never'}</span>
              </div>
              <div className="info-row">
                <span className="text-sm text-muted">Status: {clientSheet.status === 'active' ? 'Active & Syncing' : clientSheet.status}</span>
              </div>
              <div className="sheet-actions">
                <button className="btn btn-primary" onClick={() => syncNow('client')} disabled={clientSheet.syncing}>
                  <RefreshCw size={14} className={clientSheet.syncing ? 'spin' : ''} />
                  {clientSheet.syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button className="btn btn-secondary" onClick={() => togglePause('client')}>
                  {clientSheet.status === 'paused' ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
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
              <div className="info-row">
                <Clock size={14} />
                <span>Last synced: {expenseSheet.lastSync || 'Never'}</span>
              </div>
              <div className="info-row">
                <span className="text-sm text-muted">Status: {expenseSheet.status === 'active' ? 'Active & Syncing' : expenseSheet.status}</span>
              </div>
              <div className="sheet-actions">
                <button className="btn btn-primary" onClick={() => syncNow('expense')} disabled={expenseSheet.syncing}>
                  <RefreshCw size={14} className={expenseSheet.syncing ? 'spin' : ''} />
                  {expenseSheet.syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button className="btn btn-secondary" onClick={() => togglePause('expense')}>
                  {expenseSheet.status === 'paused' ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
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
        <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>
          Next auto-sync: In {syncFrequency} minutes
        </p>
      </div>

      {/* Sync History Log */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '1rem' }}>📜 Sync History</h3>
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
                  placeholder={setupStep === 'client' ? 'e.g., Ad X Main' : 'e.g., Statement Sheet'}
                  value={setupStep === 'client' ? clientSheet.tab : expenseSheet.tab}
                  onChange={e => {
                    const setSheet = setupStep === 'client' ? setClientSheet : setExpenseSheet;
                    setSheet(prev => ({ ...prev, tab: e.target.value }));
                  }}
                />
              </div>

              <div className="setup-step">
                <span className="step-number">3</span>
                <span>Confirm column mapping</span>
              </div>
              <div className="column-map glass-panel" style={{ padding: '0.75rem' }}>
                {setupStep === 'client' ? (
                  <>
                    <p className="text-sm">Column A: Onboarding Date (D/Month/YYYY)</p>
                    <p className="text-sm">Column B: Monthly Price (USD)</p>
                    <p className="text-sm">Column C: Business Name</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm">Column A: Date (DD/MM/YYYY)</p>
                    <p className="text-sm">Column B: Expense Name</p>
                    <p className="text-sm">Column C: Amount (₹)</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSetupStep(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => connectSheet(setupStep)}>
                <Link2 size={16} /> Enable Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
