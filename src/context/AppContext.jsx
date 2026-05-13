import React, { createContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isSupabaseConfigured } from '../supabase/client';
import {
  loadSettings, saveSettings,
  loadMonthlyRecords, saveMonthlyRecords,
  loadExpenses, saveExpenses,
  loadTeam, saveTeam,
  loadSyncLogs, saveSyncLogs,
  migrateFromLocalStorage
} from '../supabase/db';

export const AppContext = createContext();

const MONTH_KEYS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const initialClientsData = [
  { businessName: 'Aruba Palm Realtors', onboardingDate: '2025-08-01', monthlyPrice: 350, paymentMethod: 'Stripe', paymentDueDay: 1 },
  { businessName: 'Sunny Ice Cream Truck', onboardingDate: '2026-02-04', monthlyPrice: 256, paymentMethod: 'Stripe', paymentDueDay: 4 },
  { businessName: 'Montauk Hat', onboardingDate: '2025-11-05', monthlyPrice: 150, paymentMethod: 'Stripe', paymentDueDay: 5 },
  { businessName: 'G&G Exterminating', onboardingDate: '2025-12-06', monthlyPrice: 500, paymentMethod: 'Stripe', paymentDueDay: 6 },
  { businessName: 'Superstars Roofing', onboardingDate: '2026-04-07', monthlyPrice: 200, paymentMethod: 'Stripe', paymentDueDay: 7 },
  { businessName: 'Kirkwood Trading Company', onboardingDate: '2026-04-08', monthlyPrice: 500, paymentMethod: 'Stripe', paymentDueDay: 8 },
  { businessName: 'Rawmantic Chocolate', onboardingDate: '2025-12-10', monthlyPrice: 1100, paymentMethod: 'Stripe', paymentDueDay: 10 },
  { businessName: 'Windows on the Lake', onboardingDate: '2026-03-15', monthlyPrice: 700, paymentMethod: 'Stripe', paymentDueDay: 15 },
  { businessName: 'Excellence Janitorial Svcs', onboardingDate: '2025-09-15', monthlyPrice: 500, paymentMethod: 'Stripe', paymentDueDay: 15 },
  { businessName: 'THE VILLAGES REALTOR', onboardingDate: '2026-04-16', monthlyPrice: 800, paymentMethod: 'Stripe', paymentDueDay: 16 },
  { businessName: 'Sublime Cleaning', onboardingDate: '2026-03-17', monthlyPrice: 300, paymentMethod: 'Stripe', paymentDueDay: 17 },
  { businessName: 'Centex Security Cameras', onboardingDate: '2026-02-20', monthlyPrice: 750, paymentMethod: 'Stripe', paymentDueDay: 20 },
  { businessName: 'Alexandria Gifts Inc', onboardingDate: '2026-01-29', monthlyPrice: 300, paymentMethod: 'Stripe', paymentDueDay: 29 },
  { businessName: 'Perfect Plastic Cards', onboardingDate: '2025-06-30', monthlyPrice: 394, paymentMethod: 'Stripe', paymentDueDay: 30 }
];

function createMonthlyRecord(client, overrides = {}) {
  return {
    id: uuidv4(),
    businessName: client.businessName || '',
    contactPerson: client.contactPerson || '',
    onboardingDate: client.onboardingDate || '',
    monthlyPrice: client.monthlyPrice || 0,
    paymentMethod: client.paymentMethod || 'Stripe',
    paymentDueDay: client.paymentDueDay || 1,
    contractEndDate: client.contractEndDate || '',
    notes: client.notes || '',
    status: 'Active',
    statusDate: '',
    statusNote: 'None',
    paymentReceived: 0,
    refundAmount: 0,
    chargebackAmount: 0,
    isDeleted: false,
    deletedAt: null,
    deletedReason: '',
    ...overrides
  };
}

function createInitialMonthlyRecords() {
  const records = initialClientsData.map(c => createMonthlyRecord(c));
  return { '2026-04': records };
}

function migrateFromOldLocalStorageFormat() {
  try {
    const oldClients = JSON.parse(localStorage.getItem('profitpilot_clients'));
    if (!oldClients || !Array.isArray(oldClients)) return null;
    const oldStatusHistory = JSON.parse(localStorage.getItem('profitpilot_clientStatusHistory')) || [];
    const oldPayments = JSON.parse(localStorage.getItem('profitpilot_payments')) || [];
    const records = oldClients.map(client => {
      const statusEntry = oldStatusHistory.find(h => h.clientId === client.id && h.month === '04' && h.year === '2026') ||
        oldStatusHistory.find(h => h.clientId === client.id) || {};
      const paymentEntry = oldPayments.find(p => p.clientId === client.id && p.month === '04' && p.year === '2026') || {};
      return createMonthlyRecord(client, {
        status: statusEntry.status || 'Active',
        statusDate: statusEntry.statusDate || '',
        statusNote: statusEntry.statusNote || 'None',
        paymentReceived: paymentEntry.receivedAmount || 0,
        refundAmount: paymentEntry.refundAmount || 0,
        chargebackAmount: paymentEntry.chargebackAmount || 0
      });
    });
    return { '2026-04': records };
  } catch {
    return null;
  }
}

function findPreviousMonthKey(records, targetMonth, targetYear) {
  const target = parseInt(targetYear) * 12 + parseInt(targetMonth);
  const keys = Object.keys(records);
  let bestKey = null;
  let bestDiff = Infinity;
  for (const key of keys) {
    const [y, m] = key.split('-').map(Number);
    const val = y * 12 + m;
    const diff = target - val;
    if (diff > 0 && diff < bestDiff) {
      bestDiff = diff;
      bestKey = key;
    }
  }
  return bestKey;
}

function cleanupExpiredTrash(records) {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  for (const key of Object.keys(records)) {
    records[key] = records[key].filter(r => {
      if (!r.isDeleted || !r.deletedAt) return true;
      return (now - new Date(r.deletedAt).getTime()) < thirtyDays;
    });
    if (records[key].length === 0) delete records[key];
  }
  return records;
}

const initialExpenses = [
  { id: uuidv4(), name: 'Salaries', amount: 294850, category: 'Salaries', frequency: 'Monthly Recurring', date: '2026-04-01', status: 'Paid', month: '04', year: '2026' },
  { id: uuidv4(), name: 'Office & Rent', amount: 83214, category: 'Office & Rent', frequency: 'Monthly Recurring', date: '2026-04-01', status: 'Paid', month: '04', year: '2026' },
  { id: uuidv4(), name: 'Tools & Software', amount: 10421, category: 'Tools & Software', frequency: 'Monthly Recurring', date: '2026-04-01', status: 'Paid', month: '04', year: '2026' },
  { id: uuidv4(), name: 'Data & Hosting', amount: 26121, category: 'Data & Hosting', frequency: 'Monthly Recurring', date: '2026-04-01', status: 'Paid', month: '04', year: '2026' },
  { id: uuidv4(), name: 'Compliance/Legal', amount: 17807, category: 'Compliance & Legal', frequency: 'Monthly Recurring', date: '2026-04-01', status: 'Paid', month: '04', year: '2026' },
  { id: uuidv4(), name: 'Miscellaneous', amount: 389, category: 'Miscellaneous', frequency: 'Monthly Recurring', date: '2026-04-01', status: 'Paid', month: '04', year: '2026' }
];

const preloadedTeam = [
  { id: uuidv4(), name: 'Sidra', team: 'Email', role: 'Email Marketing', monthlySalary: 11000 },
  { id: uuidv4(), name: 'Nimra', team: 'Email', role: 'Email Marketing', monthlySalary: 11000 },
  { id: uuidv4(), name: 'Sandeep Rana', team: 'Email', role: 'Email Marketing', monthlySalary: 27000 },
  { id: uuidv4(), name: 'Deepak Mishra', team: 'Email', role: 'Email Marketing', monthlySalary: 25000 },
  { id: uuidv4(), name: 'Dinesh', team: 'Email', role: 'Email Marketing', monthlySalary: 20000 },
  { id: uuidv4(), name: 'Deepanshu', team: 'Email', role: 'Email Marketing', monthlySalary: 25000 },
  { id: uuidv4(), name: 'Jahid', team: 'Email', role: 'Email Marketing', monthlySalary: 35000 },
  { id: uuidv4(), name: 'Rahul', team: 'Email', role: 'Email Marketing', monthlySalary: 20000 },
  { id: uuidv4(), name: 'Lavanya', team: 'Day', role: 'HR Executive', monthlySalary: 18000 },
  { id: uuidv4(), name: 'Rohan', team: 'Day', role: 'SEO Intern', monthlySalary: 15000 },
  { id: uuidv4(), name: 'Harsh', team: 'Day', role: 'SEO Executive', monthlySalary: 30000 },
  { id: uuidv4(), name: 'Vikram', team: 'Day', role: 'Graphic + Video', monthlySalary: 27000 },
  { id: uuidv4(), name: 'Riya', team: 'Day', role: 'SEO Intern', monthlySalary: 10000 },
  { id: uuidv4(), name: 'Kartik', team: 'Day', role: 'Developer', monthlySalary: 38000 },
  { id: uuidv4(), name: 'Saumya', team: 'Day', role: 'Content Writer', monthlySalary: 25000 },
  { id: uuidv4(), name: 'Pankaj', team: 'Night', role: 'Project Manager', monthlySalary: 45000 },
  { id: uuidv4(), name: 'Anshika', team: 'Night', role: 'Intern', monthlySalary: 4000 }
];

function loadFromLS(key, defaultData) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultData;
  } catch { return defaultData; }
}

export const AppProvider = ({ children }) => {
  const [dataReady, setDataReady] = useState(false);

  const [exchangeRate, setExchangeRate] = useState(83);
  const [profitGoal, setProfitGoal] = useState(200000);
  const [currencyView, setCurrencyView] = useState('USD');
  const [currentMonth, setCurrentMonth] = useState('04');
  const [currentYear, setCurrentYear] = useState('2026');

  const [monthlyRecords, setMonthlyRecords] = useState(createInitialMonthlyRecords);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [team, setTeam] = useState(preloadedTeam);
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    async function init() {
      if (isSupabaseConfigured()) {
        const [settings, records, exp, tm, logs] = await Promise.all([
          loadSettings(),
          loadMonthlyRecords(),
          loadExpenses(),
          loadTeam(),
          loadSyncLogs()
        ]);

        const hasSupabaseData = settings || (records && Object.keys(records).length > 0);

        if (hasSupabaseData) {
          if (settings) {
            setExchangeRate(settings.exchangeRate);
            setProfitGoal(settings.profitGoal);
            setCurrencyView(settings.currencyView);
          }
          if (records) {
            setMonthlyRecords(cleanupExpiredTrash(records));
          }
          if (exp) setExpenses(exp);
          if (tm) setTeam(tm);
          if (logs) setSyncLogs(logs);
        } else {
          const migrated = await migrateFromLocalStorage();
          if (migrated) {
            const [s2, r2, e2, t2, l2] = await Promise.all([
              loadSettings(), loadMonthlyRecords(), loadExpenses(), loadTeam(), loadSyncLogs()
            ]);
            if (s2) { setExchangeRate(s2.exchangeRate); setProfitGoal(s2.profitGoal); setCurrencyView(s2.currencyView); }
            if (r2) setMonthlyRecords(cleanupExpiredTrash(r2));
            if (e2) setExpenses(e2);
            if (t2) setTeam(t2);
            if (l2) setSyncLogs(l2);
          } else {
            loadFromLocalStorage();
          }
        }
      } else {
        loadFromLocalStorage();
      }
      setDataReady(true);
    }

    function loadFromLocalStorage() {
      setExchangeRate(loadFromLS('profitpilot_exchangeRate', 83));
      setProfitGoal(loadFromLS('profitpilot_profitGoal', 200000));
      setCurrencyView(loadFromLS('profitpilot_currencyView', 'USD'));

      const saved = loadFromLS('profitpilot_monthlyRecords', null);
      if (saved) {
        setMonthlyRecords(cleanupExpiredTrash(saved));
      } else {
        const migrated = migrateFromOldLocalStorageFormat();
        setMonthlyRecords(migrated || createInitialMonthlyRecords());
      }

      setExpenses(loadFromLS('profitpilot_expenses', initialExpenses));
      setTeam(loadFromLS('profitpilot_team', preloadedTeam));
      setSyncLogs(loadFromLS('profitpilot_syncLogs', []));
    }

    init();
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    if (isSupabaseConfigured()) {
      saveSettings(exchangeRate, profitGoal, currencyView);
    } else {
      localStorage.setItem('profitpilot_exchangeRate', JSON.stringify(exchangeRate));
      localStorage.setItem('profitpilot_profitGoal', JSON.stringify(profitGoal));
      localStorage.setItem('profitpilot_currencyView', JSON.stringify(currencyView));
    }
  }, [dataReady, exchangeRate, profitGoal, currencyView]);

  useEffect(() => {
    if (!dataReady) return;
    const timer = setTimeout(() => {
      if (isSupabaseConfigured()) {
        saveMonthlyRecords(monthlyRecords);
      } else {
        localStorage.setItem('profitpilot_monthlyRecords', JSON.stringify(monthlyRecords));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dataReady, monthlyRecords]);

  useEffect(() => {
    if (!dataReady) return;
    if (isSupabaseConfigured()) {
      saveExpenses(expenses);
    } else {
      localStorage.setItem('profitpilot_expenses', JSON.stringify(expenses));
    }
  }, [dataReady, expenses]);

  useEffect(() => {
    if (!dataReady) return;
    if (isSupabaseConfigured()) {
      saveTeam(team);
    } else {
      localStorage.setItem('profitpilot_team', JSON.stringify(team));
    }
  }, [dataReady, team]);

  useEffect(() => {
    if (!dataReady) return;
    if (isSupabaseConfigured()) {
      saveSyncLogs(syncLogs);
    } else {
      localStorage.setItem('profitpilot_syncLogs', JSON.stringify(syncLogs));
    }
  }, [dataReady, syncLogs]);

  const monthKey = `${currentYear}-${currentMonth}`;

  const getMonthlyRecords = useCallback((month = currentMonth, year = currentYear) => {
    const key = `${year}-${month}`;
    return (monthlyRecords[key] || []).filter(r => !r.isDeleted);
  }, [monthlyRecords, currentMonth, currentYear]);

  const getDeletedRecords = useCallback((month = currentMonth, year = currentYear) => {
    const key = `${year}-${month}`;
    return (monthlyRecords[key] || []).filter(r => r.isDeleted);
  }, [monthlyRecords, currentMonth, currentYear]);

  const getAllTrashRecords = useCallback(() => {
    const trash = [];
    for (const [key, records] of Object.entries(monthlyRecords)) {
      const [year, month] = key.split('-');
      for (const r of records) {
        if (r.isDeleted) {
          trash.push({ ...r, _month: month, _year: year });
        }
      }
    }
    return trash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }, [monthlyRecords]);

  const addRecordToMonth = useCallback((recordData, month = currentMonth, year = currentYear) => {
    const key = `${year}-${month}`;
    const newRecord = createMonthlyRecord(recordData, { id: uuidv4() });
    setMonthlyRecords(prev => {
      const existing = prev[key] || [];
      return { ...prev, [key]: [...existing, newRecord] };
    });
    return newRecord;
  }, [currentMonth, currentYear]);

  const updateRecordInMonth = useCallback((recordId, updates, month = currentMonth, year = currentYear) => {
    const key = `${year}-${month}`;
    setMonthlyRecords(prev => {
      const records = prev[key];
      if (!records) return prev;
      return {
        ...prev,
        [key]: records.map(r => r.id === recordId ? { ...r, ...updates } : r)
      };
    });
  }, [currentMonth, currentYear]);

  const softDeleteRecord = useCallback((recordId, reason = '', month = currentMonth, year = currentYear) => {
    const key = `${year}-${month}`;
    setMonthlyRecords(prev => {
      const records = prev[key];
      if (!records) return prev;
      return {
        ...prev,
        [key]: records.map(r => r.id === recordId ? {
          ...r, isDeleted: true, deletedAt: new Date().toISOString(), deletedReason: reason
        } : r)
      };
    });
  }, [currentMonth, currentYear]);

  const softDeleteRecordFromAllMonths = useCallback((businessName) => {
    setMonthlyRecords(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map(r =>
          r.businessName === businessName
            ? { ...r, isDeleted: true, deletedAt: new Date().toISOString(), deletedReason: '' }
            : r
        );
      }
      return next;
    });
  }, []);

  const restoreRecord = useCallback((recordId, newStatus, month, year) => {
    const key = `${year}-${month}`;
    setMonthlyRecords(prev => {
      const records = prev[key];
      if (!records) return prev;
      return {
        ...prev,
        [key]: records.map(r => r.id === recordId ? {
          ...r, isDeleted: false, deletedAt: null, deletedReason: '',
          status: newStatus, statusDate: newStatus === 'Active' ? '' : r.statusDate
        } : r)
      };
    });
  }, []);

  const permanentlyDeleteRecord = useCallback((recordId, month, year) => {
    const key = `${year}-${month}`;
    setMonthlyRecords(prev => {
      const records = prev[key];
      if (!records) return prev;
      return { ...prev, [key]: records.filter(r => r.id !== recordId) };
    });
  }, []);

  const ensureMonthExists = useCallback((month, year) => {
    const key = `${year}-${month}`;
    setMonthlyRecords(prev => {
      if (prev[key] && prev[key].length > 0) return prev;
      const sourceKey = findPreviousMonthKey(prev, month, year);
      if (!sourceKey) return prev;
      const sourceRecords = prev[sourceKey];
      const newRecords = sourceRecords
        .filter(r => !r.isDeleted && r.status !== 'Cancelled')
        .map(r => ({
          ...r,
          id: uuidv4(),
          paymentReceived: 0,
          refundAmount: 0,
          chargebackAmount: 0,
          isDeleted: false,
          deletedAt: null,
          deletedReason: ''
        }));
      return { ...prev, [key]: newRecords };
    });
  }, []);

  useEffect(() => {
    ensureMonthExists(currentMonth, currentYear);
  }, [currentMonth, currentYear, ensureMonthExists]);

  const currentMonthRecords = (monthlyRecords[monthKey] || []).filter(r => !r.isDeleted);
  const currentMonthActive = currentMonthRecords.filter(r => r.status === 'Active');
  const currentMonthCancelled = currentMonthRecords.filter(r => r.status === 'Cancelled');
  const currentMonthTrash = (monthlyRecords[monthKey] || []).filter(r => r.isDeleted);

  const convertToINR = (usd) => usd * exchangeRate;
  const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
  const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(val);

  return (
    <AppContext.Provider value={{
      exchangeRate, setExchangeRate,
      profitGoal, setProfitGoal,
      currencyView, setCurrencyView,
      currentMonth, setCurrentMonth,
      currentYear, setCurrentYear,
      monthlyRecords, setMonthlyRecords,
      currentMonthRecords,
      currentMonthActive,
      currentMonthCancelled,
      currentMonthTrash,
      getMonthlyRecords,
      getDeletedRecords,
      getAllTrashRecords,
      addRecordToMonth,
      updateRecordInMonth,
      softDeleteRecord,
      softDeleteRecordFromAllMonths,
      restoreRecord,
      permanentlyDeleteRecord,
      ensureMonthExists,
      monthKey,
      expenses, setExpenses,
      team, setTeam,
      syncLogs, setSyncLogs,
      convertToINR, formatUSD, formatINR
    }}>
      {children}
    </AppContext.Provider>
  );
};
