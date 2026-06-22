import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isSupabaseConfigured } from '../supabase/client';
import { AuthContext } from './AuthContext';
import {
  loadSettings, saveSettings,
  loadMonthlyRecords, saveMonthlyRecords,
  loadExpenses, saveExpenses,
  loadTeam, saveTeam,
  loadSyncLogs, saveSyncLogs,
  migrateFromLocalStorage,
  deleteExpensesFromDB,
  deleteMonthlyRecords,
  loadClientPmAssignments, saveClientPmAssignments, deleteClientPmAssignment,
  insertAuditLog, loadAuditLogs, deleteAuditLogs,
  loadSheetConnections, saveSheetConnection,
  loadBankDeposits, saveBankDeposits, deleteBankDepositFromDB
} from '../supabase/db';

export const AppContext = createContext();

const MONTH_KEYS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function createMonthlyRecord(recordData, overrides = {}) {
  const id = recordData.id || uuidv4();
  return {
    id,
    businessName: (recordData.businessName || '').trim(),
    contactPerson: recordData.contactPerson || '',
    phone: recordData.phone || '',
    email: recordData.email || '',
    website: recordData.website || '',
    onboardingDate: recordData.onboardingDate || '',
    billingStartDate: recordData.billingStartDate || recordData.onboardingDate || '',
    monthlyPrice: recordData.monthlyPrice || 0,
    paymentMethod: recordData.paymentMethod || 'Stripe',
    paymentDueDay: recordData.paymentDueDay || 1,
    contractEndDate: recordData.contractEndDate || '',
    notes: recordData.notes || '',
    status: recordData.status || 'Active',
    statusDate: recordData.statusDate || '',
    statusNote: recordData.statusNote || 'None',
    handledBy: recordData.handledBy || 'Unassigned',
    paymentReceived: recordData.paymentReceived || 0,
    refundAmount: recordData.refundAmount || 0,
    chargebackAmount: recordData.chargebackAmount || 0,
    upsellAmount: recordData.upsellAmount || 0,
    downsellAmount: recordData.downsellAmount || 0,
    isDeleted: recordData.isDeleted || false,
    deletedAt: recordData.deletedAt || null,
    deletedReason: recordData.deletedReason || '',
    ...overrides
  };
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

function dedupRecords(records) {
  for (const key of Object.keys(records)) {
    const seen = new Set();
    const active = [];
    const deleted = [];
    for (const r of records[key]) {
      if (r.isDeleted) { deleted.push(r); continue; }
      const name = (r.businessName || '').trim().toLowerCase();
      if (!name || !seen.has(name)) {
        if (name) seen.add(name);
        active.push(r);
      }
    }
    records[key] = [...active, ...deleted];
    if (records[key].length === 0) delete records[key];
  }
  return records;
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

function filterLogsOlderThan(logs, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const filtered = [];
  const oldIds = [];
  for (const log of logs) {
    if (new Date(log.created_at) < cutoff) {
      oldIds.push(log.id);
    } else {
      filtered.push(log);
    }
  }
  return { filtered, oldIds };
}

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
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = loadFromLS('profitpilot_lastMonth', null);
    return saved || String(new Date().getMonth() + 1).padStart(2, '0');
  });
  const [currentYear, setCurrentYear] = useState(() => {
    const saved = loadFromLS('profitpilot_lastYear', null);
    return saved || String(new Date().getFullYear());
  });

  const [monthlyRecords, setMonthlyRecords] = useState(() => loadFromLS('profitpilot_monthlyRecords', {}));
  const monthlyRecordsRef = useRef(monthlyRecords);
  useEffect(() => { monthlyRecordsRef.current = monthlyRecords; }, [monthlyRecords]);
  const [expenses, setExpenses] = useState(() => loadFromLS('profitpilot_expenses', []));
  const expensesRef = useRef(expenses);
  useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  const [team, setTeam] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [bankDeposits, setBankDeposits] = useState(() => loadFromLS('profitpilot_bankDeposits', []));
  const [pendingWithdrawal, setPendingWithdrawal] = useState(() => loadFromLS('profitpilot_pendingWithdrawal', 0));
  const [assignments, setAssignments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const sheetConnectionDefaults = { url: '', connected: false, status: 'disconnected', lastSync: null, error: '', foundTabs: [] };
  const [clientSheet, setClientSheet] = useState(() => {
    const saved = loadFromLS('profitpilot_clientSheet', null);
    return saved ? { ...sheetConnectionDefaults, ...saved } : { ...sheetConnectionDefaults };
  });
  const [expenseSheet, setExpenseSheet] = useState(() => {
    const saved = loadFromLS('profitpilot_expenseSheet', null);
    return saved ? { ...sheetConnectionDefaults, ...saved } : { ...sheetConnectionDefaults };
  });

  const { user, loading: authLoading } = useContext(AuthContext);

  function loadFromLocalStorage() {
    setExchangeRate(loadFromLS('profitpilot_exchangeRate', 83));
    setProfitGoal(loadFromLS('profitpilot_profitGoal', 200000));
    setCurrencyView(loadFromLS('profitpilot_currencyView', 'USD'));
    setPendingWithdrawal(loadFromLS('profitpilot_pendingWithdrawal', 0));

    const saved = loadFromLS('profitpilot_monthlyRecords', null);
    if (saved) {
      setMonthlyRecords(dedupRecords(cleanupExpiredTrash(saved)));
    } else {
      setMonthlyRecords({});
    }

    setExpenses(loadFromLS('profitpilot_expenses', []));
    setTeam(loadFromLS('profitpilot_team', []));
    setSyncLogs(loadFromLS('profitpilot_syncLogs', []));
    setAssignments(loadFromLS('profitpilot_assignments', []));

    const localAuditLogs = loadFromLS('profitpilot_auditLogs', []);
    const { filtered } = filterLogsOlderThan(localAuditLogs, 15);
    setAuditLogs(filtered);
  }

  useEffect(() => {
    loadFromLocalStorage();
    if (!isSupabaseConfigured()) {
      setDataReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || authLoading) return;
    if (!user) {
      setDataReady(true);
      return;
    }

    async function loadSupabaseData() {
      try {
        const [settings, records, exp, tm, logs, asgn, deposits] = await Promise.all([
          loadSettings(),
          loadMonthlyRecords(),
          loadExpenses(),
          loadTeam(),
          loadSyncLogs(),
          loadClientPmAssignments(),
          loadBankDeposits()
        ]);

        if (settings) {
          setExchangeRate(settings.exchangeRate);
          setProfitGoal(settings.profitGoal);
          setCurrencyView(settings.currencyView);
          if (settings.pendingWithdrawal !== undefined) setPendingWithdrawal(settings.pendingWithdrawal);
        }

        if (deposits) {
          setBankDeposits(deposits);
          localStorage.setItem('profitpilot_bankDeposits', JSON.stringify(deposits));
        }

        const localRecords = loadFromLS('profitpilot_monthlyRecords', null);
        const localHasRecords = localRecords && Object.keys(localRecords).length > 0;

        const supabaseHasRecords = records && Object.keys(records).length > 0;

        if (supabaseHasRecords) {
          setMonthlyRecords(dedupRecords(cleanupExpiredTrash(records)));
        } else if (!localHasRecords) {
          const migrated = await migrateFromLocalStorage();
          if (migrated) {
            const r2 = await loadMonthlyRecords();
            if (r2) setMonthlyRecords(dedupRecords(cleanupExpiredTrash(r2)));
          }
        }

        const localExpenses = loadFromLS('profitpilot_expenses', null);
        if (exp && exp.length > 0) {
          setExpenses(exp);
          localStorage.setItem('profitpilot_expenses', JSON.stringify(exp));
        } else if (localExpenses && localExpenses.length > 0) {
          setExpenses(localExpenses);
        }
        if (tm && tm.length > 0) setTeam(tm);
        if (logs) setSyncLogs(logs);
        if (asgn) setAssignments(asgn);

        const auditData = await loadAuditLogs();
        if (auditData) {
          const { filtered, oldIds } = filterLogsOlderThan(auditData, 15);
          if (oldIds.length > 0) {
            deleteAuditLogs(oldIds).catch(() => {});
          }
          setAuditLogs(filtered);
        }

        const sheets = await loadSheetConnections(user.id);
        if (sheets) {
          if (sheets.client) setClientSheet(prev => ({ ...prev, ...sheets.client }));
          if (sheets.expense) setExpenseSheet(prev => ({ ...prev, ...sheets.expense }));
        }
      } catch (err) {
        console.error('Failed to load data from Supabase:', err.message);
      }

      setDataReady(true);
    }

    loadSupabaseData();
  }, [user, authLoading]);

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem('profitpilot_bankDeposits', JSON.stringify(bankDeposits));
    if (isSupabaseConfigured()) {
      saveBankDeposits(bankDeposits).catch(err => {
        console.error('Supabase save failed (data preserved in localStorage):', err.message);
      });
    }
  }, [dataReady, bankDeposits]);

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem('profitpilot_exchangeRate', JSON.stringify(exchangeRate));
    localStorage.setItem('profitpilot_profitGoal', JSON.stringify(profitGoal));
    localStorage.setItem('profitpilot_currencyView', JSON.stringify(currencyView));
    localStorage.setItem('profitpilot_pendingWithdrawal', JSON.stringify(pendingWithdrawal));
    if (isSupabaseConfigured()) {
      saveSettings(exchangeRate, profitGoal, currencyView, pendingWithdrawal).catch(err => {
        console.error('Supabase save settings failed (data preserved in localStorage):', err.message);
      });
    }
  }, [dataReady, exchangeRate, profitGoal, currencyView, pendingWithdrawal]);

  useEffect(() => {
    if (!dataReady) return;
    const timer = setTimeout(() => {
      localStorage.setItem('profitpilot_monthlyRecords', JSON.stringify(monthlyRecords));
      if (isSupabaseConfigured()) {
        saveMonthlyRecords(monthlyRecords).catch(err => {
          console.error('Supabase save failed (data preserved in localStorage):', err.message);
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dataReady, monthlyRecords]);

  useEffect(() => {
    if (!dataReady) return;
    const timer = setTimeout(() => {
      localStorage.setItem('profitpilot_expenses', JSON.stringify(expenses));
      if (isSupabaseConfigured()) {
        saveExpenses(expenses).catch(err => {
          console.error('Supabase save failed (data preserved in localStorage):', err.message);
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dataReady, expenses]);

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem('profitpilot_team', JSON.stringify(team));
    if (isSupabaseConfigured()) {
      saveTeam(team).catch(err => console.error('Failed to save team to DB:', err.message));
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

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem('profitpilot_assignments', JSON.stringify(assignments));
  }, [dataReady, assignments]);

  useEffect(() => {
    if (!dataReady) return;
    const { filtered } = filterLogsOlderThan(auditLogs, 15);
    if (filtered.length !== auditLogs.length) {
      setAuditLogs(filtered);
    }
    localStorage.setItem('profitpilot_auditLogs', JSON.stringify(filtered));
  }, [dataReady, auditLogs]);

  useEffect(() => {
    if (!dataReady) return;
    const persisted = { ...clientSheet };
    delete persisted.syncing;
    localStorage.setItem('profitpilot_clientSheet', JSON.stringify(persisted));
    if (isSupabaseConfigured() && user) {
      saveSheetConnection(user.id, 'client', persisted).catch(err =>
        console.error('Failed to save client sheet to DB:', err.message)
      );
    }
  }, [dataReady, clientSheet, user]);

  useEffect(() => {
    if (!dataReady) return;
    const persisted = { ...expenseSheet };
    delete persisted.syncing;
    localStorage.setItem('profitpilot_expenseSheet', JSON.stringify(persisted));
    if (isSupabaseConfigured() && user) {
      saveSheetConnection(user.id, 'expense', persisted).catch(err =>
        console.error('Failed to save expense sheet to DB:', err.message)
      );
    }
  }, [dataReady, expenseSheet, user]);

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
    const cleanData = {
      ...recordData,
      businessName: (recordData.businessName || '').trim()
    };
    const newRecord = createMonthlyRecord(cleanData, { id: uuidv4() });
    setMonthlyRecords(prev => {
      const existing = prev[key] || [];
      const dup = existing.findIndex(r =>
        (r.businessName || '').trim().toLowerCase() === cleanData.businessName.toLowerCase() && !r.isDeleted
      );
      if (dup >= 0) {
        const updated = [...existing];
        updated[dup] = { ...updated[dup], ...cleanData };
        return { ...prev, [key]: updated };
      }
      return { ...prev, [key]: [...existing, newRecord] };
    });
    return newRecord;
  }, [currentMonth, currentYear]);

  const updateRecordInMonth = useCallback((recordId, updates, month = currentMonth, year = currentYear) => {
    const currentKey = `${year}-${month}`;
    const propagateFields = ['businessName', 'contactPerson', 'phone', 'email', 'website', 'monthlyPrice', 'status', 'statusDate', 'statusNote', 'handledBy', 'contractEndDate', 'paymentDueDay', 'paymentMethod', 'notes'];
    const toPropagate = {};
    for (const field of propagateFields) {
      if (field in updates) toPropagate[field] = updates[field];
    }

    setMonthlyRecords(prev => {
      const records = prev[currentKey];
      if (!records) return prev;

      const currentRecord = records.find(r => r.id === recordId);
      if (!currentRecord) return { ...prev, [currentKey]: records.map(r => r.id === recordId ? { ...r, ...updates } : r) };

      const bizName = toPropagate.businessName || currentRecord.businessName;
      const onboardDate = currentRecord.onboardingDate;

      const updated = { ...prev };
      updated[currentKey] = records.map(r => r.id === recordId ? { ...r, ...updates } : r);

      const targetVal = parseInt(year) * 12 + parseInt(month);
      for (const key of Object.keys(updated)) {
        const [y, m] = key.split('-').map(Number);
        const keyVal = y * 12 + m;
        if (keyVal > targetVal) {
          updated[key] = (updated[key] || []).map(r =>
            r.businessName === bizName && r.onboardingDate === onboardDate && !r.isDeleted
              ? { ...r, ...toPropagate }
              : r
          );
        }
      }

      return updated;
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

  const permanentlyDeleteRecord = useCallback(async (recordId, month, year) => {
    const key = `${year}-${month}`;
    if (isSupabaseConfigured()) {
      try {
        await deleteMonthlyRecords([recordId]);
      } catch (err) {
        console.error('Failed to delete record from Supabase:', err.message);
      }
    }
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
          upsellAmount: 0,
          downsellAmount: 0,
          isDeleted: false,
          deletedAt: null,
          deletedReason: ''
        }));
      return { ...prev, [key]: newRecords };
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('profitpilot_lastMonth', JSON.stringify(currentMonth));
    localStorage.setItem('profitpilot_lastYear', JSON.stringify(currentYear));
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (!dataReady) return;
    ensureMonthExists(currentMonth, currentYear);
  }, [currentMonth, currentYear, ensureMonthExists, dataReady]);

  const carryOverRecurringExpenses = useCallback((month, year) => {
    setExpenses(prev => {
      const targetVal = parseInt(year) * 12 + parseInt(month);

      const afterRemoval = prev.filter(e => {
        const sameMonth = e.month === month && e.year === year;
        return !(sameMonth && e.carriedOver);
      });

      const monthsMap = {};
      afterRemoval.forEach(e => {
        const k = `${e.year}-${e.month}`;
        if (!monthsMap[k]) monthsMap[k] = [];
        monthsMap[k].push(e);
      });

      const prevKeys = Object.keys(monthsMap)
        .map(k => ({ key: k, val: (([y, m]) => parseInt(y) * 12 + parseInt(m))(k.split('-')) }))
        .filter(({ val }) => val < targetVal)
        .sort((a, b) => b.val - a.val);

      if (prevKeys.length === 0) return afterRemoval;
      const sourceKey = prevKeys[0].key;
      const sourceExpenses = monthsMap[sourceKey];
      const recurring = sourceExpenses.filter(e => e.frequency === 'Monthly Recurring');
      if (recurring.length === 0) return afterRemoval;

      const newExpenses = recurring.map(e => ({
        id: uuidv4(),
        name: e.name,
        amount: e.amount,
        category: e.category,
        frequency: e.frequency,
        date: `${year}-${month}-01`,
        status: e.status || 'Paid',
        notes: e.notes || '',
        carriedOver: true,
        month,
        year
      }));
      return [...afterRemoval, ...newExpenses];
    });
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    carryOverRecurringExpenses(currentMonth, currentYear);
  }, [currentMonth, currentYear, carryOverRecurringExpenses, dataReady]);

  const deleteExpenses = useCallback(async (ids) => {
    setExpenses(prev => prev.filter(e => !ids.includes(e.id)));
    try {
      await deleteExpensesFromDB(ids);
    } catch (err) {
      console.error('Failed to delete expenses from DB:', err.message);
    }
  }, []);

  const saveRecordsNow = useCallback(async () => {
    const records = monthlyRecordsRef.current;
    localStorage.setItem('profitpilot_monthlyRecords', JSON.stringify(records));
    if (isSupabaseConfigured()) {
      await saveMonthlyRecords(records);
    }
  }, []);

  const saveExpensesNow = useCallback(async () => {
    const current = expensesRef.current;
    localStorage.setItem('profitpilot_expenses', JSON.stringify(current));
    if (isSupabaseConfigured()) {
      await saveExpenses(current);
    }
  }, []);

  const saveAssignments = useCallback(async (newAssignments) => {
    setAssignments(newAssignments);
    if (isSupabaseConfigured()) {
      await saveClientPmAssignments(newAssignments);
    }
  }, []);

  const deleteAssignment = useCallback(async (id) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    if (isSupabaseConfigured()) {
      await deleteClientPmAssignment(id);
    }
  }, []);

  const logAction = useCallback(async ({ user, actionType, entityType, entityId, entityName, details }) => {
    if (!user) return;
    const now = new Date().toISOString();
    const tempId = crypto.randomUUID();
    const entry = {
      id: tempId, user_id: user.id, user_email: user.email || '',
      action_type: actionType, entity_type: entityType,
      entity_id: entityId || '', entity_name: entityName || '',
      details: details || {}, created_at: now
    };
    setAuditLogs(prev => [entry, ...prev]);
    if (isSupabaseConfigured()) {
      const saved = await insertAuditLog({
        userId: user.id, userEmail: user.email || '',
        actionType, entityType, entityId, entityName, details
      });
      if (saved) {
        setAuditLogs(prev => prev.map(e => e.id === tempId ? saved : e));
      }
    }
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const logs = await loadAuditLogs();
      if (logs) setAuditLogs(logs);
    }
  }, []);

  const addBankDeposit = useCallback((depositData) => {
    const newDeposit = {
      id: uuidv4(),
      date: depositData.date,
      inrAmount: Number(depositData.inrAmount),
      note: depositData.note || null,
      createdAt: new Date().toISOString()
    };
    setBankDeposits(prev => [newDeposit, ...prev]);
    return newDeposit;
  }, []);

  const updateBankDeposit = useCallback((id, updates) => {
    setBankDeposits(prev => prev.map(d =>
      d.id === id ? { ...d, ...updates } : d
    ));
  }, []);

  const deleteBankDeposit = useCallback(async (id) => {
    setBankDeposits(prev => prev.filter(d => d.id !== id));
    try {
      await deleteBankDepositFromDB(id);
    } catch (err) {
      console.error('Failed to delete bank deposit from DB:', err.message);
    }
  }, []);

  const getBankDepositsForMonth = useCallback((month, year) => {
    const paddedMonth = String(month).padStart(2, '0');
    return bankDeposits.filter(d => {
      const dDate = new Date(d.date);
      const dMonth = String(dDate.getMonth() + 1).padStart(2, '0');
      const dYear = String(dDate.getFullYear());
      return dMonth === paddedMonth && dYear === String(year);
    });
  }, [bankDeposits]);

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
      saveRecordsNow,
      monthKey,
      expenses, setExpenses, deleteExpenses, saveExpensesNow,
      team, setTeam,
      syncLogs, setSyncLogs,
      bankDeposits, setBankDeposits,
      addBankDeposit, updateBankDeposit, deleteBankDeposit,
      getBankDepositsForMonth,
      pendingWithdrawal, setPendingWithdrawal,
      convertToINR, formatUSD, formatINR,
      assignments, saveAssignments, deleteAssignment,
      auditLogs, setAuditLogs, logAction, refreshAuditLogs,
      clientSheet, setClientSheet,
      expenseSheet, setExpenseSheet
    }}>
      {children}
    </AppContext.Provider>
  );
};
