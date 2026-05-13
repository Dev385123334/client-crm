import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { isSupabaseConfigured } from '../supabase/client';
import { Save, RotateCcw, Database } from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const {
    exchangeRate, setExchangeRate,
    profitGoal, setProfitGoal,
    currencyView, setCurrencyView
  } = useContext(AppContext);
  const supabaseEnabled = isSupabaseConfigured();

  const [localRate, setLocalRate] = useState(exchangeRate);
  const [localGoal, setLocalGoal] = useState(profitGoal);
  const [localCurrency, setLocalCurrency] = useState(currencyView);
  const [localSyncFreq, setLocalSyncFreq] = useState(30);
  const [localPaymentReminder, setLocalPaymentReminder] = useState(3);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setExchangeRate(parseFloat(localRate));
    setProfitGoal(parseFloat(localGoal));
    setCurrencyView(localCurrency);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetDefaults = () => {
    setLocalRate(83);
    setLocalGoal(200000);
    setLocalCurrency('USD');
    setLocalSyncFreq(30);
    setLocalPaymentReminder(3);
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-secondary text-sm">Configure your ProfitPilot preferences</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Currency & Exchange */}
        <div className="glass-panel settings-section">
          <h3 className="settings-section-title">💱 Currency & Exchange</h3>
          <div className="input-group">
            <label className="input-label">USD to INR Exchange Rate</label>
            <div className="rate-input">
              <span className="rate-prefix">1 USD =</span>
              <input className="input-field" type="number" step="0.01" value={localRate} onChange={e => setLocalRate(e.target.value)} />
              <span className="rate-suffix">INR</span>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Default Currency View</label>
            <select className="input-field" value={localCurrency} onChange={e => setLocalCurrency(e.target.value)}>
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>

        {/* Goals */}
        <div className="glass-panel settings-section">
          <h3 className="settings-section-title">🎯 Goals & Targets</h3>
          <div className="input-group">
            <label className="input-label">Monthly Profit Target (₹)</label>
            <input className="input-field" type="number" value={localGoal} onChange={e => setLocalGoal(e.target.value)} />
            <span className="text-muted text-sm">Currently: ₹{parseInt(localGoal).toLocaleString('en-IN')}/month</span>
          </div>
        </div>

        {/* Sync */}
        <div className="glass-panel settings-section">
          <h3 className="settings-section-title">🔄 Sync Settings</h3>
          <div className="input-group">
            <label className="input-label">Auto-Sync Frequency</label>
            <select className="input-field" value={localSyncFreq} onChange={e => setLocalSyncFreq(parseInt(e.target.value))}>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every 60 minutes</option>
            </select>
          </div>
        </div>

        {/* Payment */}
        <div className="glass-panel settings-section">
          <h3 className="settings-section-title">💳 Payment Reminders</h3>
          <div className="input-group">
            <label className="input-label">Reminder Days Before Due</label>
            <input className="input-field" type="number" min="1" max="14" value={localPaymentReminder} onChange={e => setLocalPaymentReminder(parseInt(e.target.value))} />
            <span className="text-muted text-sm">Get alerts {localPaymentReminder} days before payment due date</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={resetDefaults}>
          <RotateCcw size={16} /> Reset to Defaults
        </button>
        <button className="btn btn-primary" onClick={save}>
          <Save size={16} /> {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Supabase Status */}
      <div className="glass-panel settings-section">
        <h3 className="settings-section-title"><Database size={16} /> Database Status</h3>
        <p className="text-secondary text-sm mb-4">
          {supabaseEnabled
            ? 'Connected to Supabase. All data is persisted remotely.'
            : 'Using localStorage. Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable Supabase.'}
        </p>
      </div>

      {/* Data Management */}
      <div className="glass-panel settings-section">
        <h3 className="settings-section-title">🗄️ Data Management</h3>
        <p className="text-secondary text-sm mb-4">
          {supabaseEnabled
            ? 'Data is stored in Supabase. Export a backup for safekeeping.'
            : 'All data is stored locally in your browser. Clearing browser data will erase all records.'}
        </p>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={() => {
            const data = {
              settings: { exchangeRate, profitGoal, currencyView },
              monthlyRecords: localStorage.getItem('profitpilot_monthlyRecords'),
              expenses: localStorage.getItem('profitpilot_expenses'),
              team: localStorage.getItem('profitpilot_team'),
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'profitpilot_backup.json'; a.click();
          }}>
            Export Backup
          </button>
          <button className="btn btn-danger" onClick={() => {
            if (confirm('⚠️ This will erase ALL data and reset the app. Are you sure?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}>
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}
