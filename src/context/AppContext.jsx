import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isSupabaseConfigured } from '../supabase/client';
import {
  loadSettings, saveSettings,
  loadMonthlyRecords, saveMonthlyRecords,
  loadExpenses, saveExpenses,
  loadTeam, saveTeam,
  loadSyncLogs, saveSyncLogs,
  migrateFromLocalStorage,
  deleteExpensesFromDB,
  loadClientPmAssignments, saveClientPmAssignments, deleteClientPmAssignment,
  insertAuditLog, loadAuditLogs
} from '../supabase/db';

export const AppContext = createContext();

const MONTH_KEYS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function createMonthlyRecord(recordData, overrides = {}) {
  const id = recordData.id || uuidv4();
  return {
    id,
    businessName: recordData.businessName || '',
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
  const [team, setTeam] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [taxRate, setTaxRate] = useState(() => loadFromLS('profitpilot_taxRate', 0));
  const [assignments, setAssignments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    async function init() {
      loadFromLocalStorage();

      if (isSupabaseConfigured()) {
        const [settings, records, exp, tm, logs, asgn] = await Promise.all([
          loadSettings(),
          loadMonthlyRecords(),
          loadExpenses(),
          loadTeam(),
          loadSyncLogs(),
          loadClientPmAssignments()
        ]);

        if (settings) {
          setExchangeRate(settings.exchangeRate);
          setProfitGoal(settings.profitGoal);
          setCurrencyView(settings.currencyView);
          if (settings.taxRate !== undefined) setTaxRate(settings.taxRate);
        }

        const localRecords = loadFromLS('profitpilot_monthlyRecords', null);
        const localHasRecords = localRecords && Object.keys(localRecords).length > 0;

        const supabaseHasRecords = records && Object.keys(records).length > 0;

        if (supabaseHasRecords) {
          setMonthlyRecords(cleanupExpiredTrash(records));
        } else if (!localHasRecords) {
          const migrated = await migrateFromLocalStorage();
          if (migrated) {
            const r2 = await loadMonthlyRecords();
            if (r2) setMonthlyRecords(cleanupExpiredTrash(r2));
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
        if (auditData) setAuditLogs(auditData);
      }

      setDataReady(true);
    }

    function loadFromLocalStorage() {
      setExchangeRate(loadFromLS('profitpilot_exchangeRate', 83));
      setProfitGoal(loadFromLS('profitpilot_profitGoal', 200000));
      setCurrencyView(loadFromLS('profitpilot_currencyView', 'USD'));
      setTaxRate(loadFromLS('profitpilot_taxRate', 0));

      const saved = loadFromLS('profitpilot_monthlyRecords', null);
      if (saved) {
        setMonthlyRecords(cleanupExpiredTrash(saved));
      } else {
        setMonthlyRecords({});
      }

      setExpenses(loadFromLS('profitpilot_expenses', []));
      setTeam(loadFromLS('profitpilot_team', []));
      setSyncLogs(loadFromLS('profitpilot_syncLogs', []));
      setAssignments(loadFromLS('profitpilot_assignments', []));
    }

    init();
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem('profitpilot_taxRate', JSON.stringify(taxRate));
    if (isSupabaseConfigured()) {
      saveSettings(exchangeRate, profitGoal, currencyView, taxRate);
    } else {
      localStorage.setItem('profitpilot_exchangeRate', JSON.stringify(exchangeRate));
      localStorage.setItem('profitpilot_profitGoal', JSON.stringify(profitGoal));
      localStorage.setItem('profitpilot_currencyView', JSON.stringify(currencyView));
    }
  }, [dataReady, exchangeRate, profitGoal, currencyView, taxRate]);

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
    if (isSupabaseConfigured()) {
      saveExpenses(expenses);
    }
    localStorage.setItem('profitpilot_expenses', JSON.stringify(expenses));
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

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem('profitpilot_assignments', JSON.stringify(assignments));
  }, [dataReady, assignments]);

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
      const dup = existing.findIndex(r =>
        r.businessName === recordData.businessName && !r.isDeleted
      );
      if (dup >= 0) {
        const updated = [...existing];
        updated[dup] = { ...updated[dup], ...recordData };
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
    ensureMonthExists(currentMonth, currentYear);
  }, [currentMonth, currentYear, ensureMonthExists]);

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
    carryOverRecurringExpenses(currentMonth, currentYear);
  }, [currentMonth, currentYear, carryOverRecurringExpenses]);

  const deleteExpenses = useCallback(async (ids) => {
    setExpenses(prev => prev.filter(e => !ids.includes(e.id)));
    await deleteExpensesFromDB(ids);
  }, []);

  const saveRecordsNow = useCallback(async () => {
    const records = monthlyRecordsRef.current;
    localStorage.setItem('profitpilot_monthlyRecords', JSON.stringify(records));
    if (isSupabaseConfigured()) {
      await saveMonthlyRecords(records);
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
      expenses, setExpenses, deleteExpenses,
      team, setTeam,
      syncLogs, setSyncLogs,
      taxRate, setTaxRate,
      convertToINR, formatUSD, formatINR,
      assignments, saveAssignments, deleteAssignment,
      auditLogs, setAuditLogs, logAction, refreshAuditLogs
    }}>
      {children}
    </AppContext.Provider>
  );
};
