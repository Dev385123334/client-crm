import { supabase, isSupabaseConfigured } from './client';

function mapRecordToDB(rec) {
  return {
    id: rec.id,
    year: rec._year,
    month: rec._month,
    business_name: rec.businessName,
    contact_person: rec.contactPerson || '',
    phone: rec.phone || '',
    email: rec.email || '',
    website: rec.website || '',
    onboarding_date: rec.onboardingDate || '',
    monthly_price: rec.monthlyPrice || 0,
    payment_method: rec.paymentMethod || 'Stripe',
    payment_due_day: rec.paymentDueDay || 1,
    contract_end_date: rec.contractEndDate || '',
    notes: rec.notes || '',
    status: rec.status || 'Active',
    status_date: rec.statusDate || '',
    status_note: rec.statusNote || 'None',
    payment_received: rec.paymentReceived || 0,
    refund_amount: rec.refundAmount || 0,
    chargeback_amount: rec.chargebackAmount || 0,
    upsell_amount: rec.upsellAmount || 0,
    downsell_amount: rec.downsellAmount || 0,
    is_deleted: rec.isDeleted || false,
    deleted_at: rec.deletedAt || null,
    deleted_reason: rec.deletedReason || ''
  };
}

function mapDBToRecord(row) {
  return {
    id: row.id,
    businessName: row.business_name,
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || '',
    onboardingDate: row.onboarding_date || '',
    monthlyPrice: Number(row.monthly_price) || 0,
    paymentMethod: row.payment_method || 'Stripe',
    paymentDueDay: row.payment_due_day || 1,
    contractEndDate: row.contract_end_date || '',
    notes: row.notes || '',
    status: row.status || 'Active',
    statusDate: row.status_date || '',
    statusNote: row.status_note || 'None',
    paymentReceived: Number(row.payment_received) || 0,
    refundAmount: Number(row.refund_amount) || 0,
    chargebackAmount: Number(row.chargeback_amount) || 0,
    upsellAmount: Number(row.upsell_amount) || 0,
    downsellAmount: Number(row.downsell_amount) || 0,
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at || null,
    deletedReason: row.deleted_reason || '',
    _month: row.month,
    _year: row.year
  };
}

export async function loadSettings() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
  if (error || !data) return null;
  return {
    exchangeRate: Number(data.exchange_rate) || 83,
    profitGoal: Number(data.profit_goal) || 200000,
    currencyView: data.currency_view || 'USD'
  };
}

export async function saveSettings(exchangeRate, profitGoal, currencyView) {
  if (!isSupabaseConfigured()) return;
  const { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();
  const payload = {
    exchange_rate: exchangeRate,
    profit_goal: profitGoal,
    currency_view: currencyView,
    updated_at: new Date().toISOString()
  };
  if (existing) {
    await supabase.from('settings').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('settings').insert(payload);
  }
}

export async function loadMonthlyRecords() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('monthly_client_records').select('*');
  if (error || !data) return null;

  const grouped = {};
  for (const row of data) {
    const key = `${row.year}-${row.month}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(mapDBToRecord(row));
  }
  return grouped;
}

export async function saveMonthlyRecords(records) {
  if (!isSupabaseConfigured()) return;
  const allRows = [];
  for (const [key, recs] of Object.entries(records)) {
    const [year, month] = key.split('-');
    for (const rec of recs) {
      allRows.push(mapRecordToDB({ ...rec, _year: year, _month: month }));
    }
  }
  if (allRows.length === 0) return;
  const { error } = await supabase.from('monthly_client_records').upsert(allRows, {
    onConflict: 'id',
    ignoreDuplicates: false
  });
  if (error) throw new Error(`Failed to save clients to database: ${error.message}`);
}

export async function loadExpenses() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('expenses').select('*');
  if (error || !data) return null;
  return data.map(row => ({
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    category: row.category,
    frequency: row.frequency,
    date: row.date,
    status: row.status,
    month: row.month,
    year: row.year,
    notes: row.notes || '',
    carriedOver: row.carried_over || false
  }));
}

export async function saveExpenses(expenses) {
  if (!isSupabaseConfigured() || expenses.length === 0) return;
  const rows = expenses.map(e => ({
    id: e.id,
    name: e.name,
    amount: e.amount,
    category: e.category,
    frequency: e.frequency,
    date: e.date,
    status: e.status,
    month: e.month,
    year: e.year,
    carried_over: e.carriedOver || false,
    updated_at: new Date().toISOString()
  }));
  const { error } = await supabase.from('expenses').upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
  if (error) console.error('Failed to save expenses to DB:', error);
}

export async function loadTeam() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('team_members').select('*');
  if (error || !data) return null;
  return data.map(row => ({
    id: row.id,
    name: row.name,
    team: row.team,
    role: row.role,
    monthlySalary: Number(row.monthly_salary)
  }));
}

export async function saveTeam(team) {
  if (!isSupabaseConfigured() || team.length === 0) return;
  const rows = team.map(m => ({
    id: m.id,
    name: m.name,
    team: m.team,
    role: m.role,
    monthly_salary: m.monthlySalary,
    updated_at: new Date().toISOString()
  }));
  await supabase.from('team_members').upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
}

export async function loadSyncLogs() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false });
  if (error || !data) return null;
  return data.map(row => ({
    id: row.id,
    type: row.type,
    message: row.message,
    status: row.status,
    createdAt: row.created_at
  }));
}

export async function saveSyncLogs(logs) {
  if (!isSupabaseConfigured() || logs.length === 0) return;
  const rows = logs.map(l => ({
    id: l.id,
    type: l.type,
    message: l.message,
    status: l.status
  }));
  await supabase.from('sync_logs').upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
}

export async function deleteExpensesFromDB(ids) {
  if (!isSupabaseConfigured() || ids.length === 0) return;
  const { error } = await supabase.from('expenses').delete().in('id', ids);
  if (error) console.error('Failed to delete expenses from DB:', error);
}

export async function loadClientPmAssignments() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from('client_pm_assignments').select('*');
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    businessName: row.business_name,
    assignedPm: row.assigned_pm,
  }));
}

export async function saveClientPmAssignments(assignments) {
  if (!isSupabaseConfigured()) return;
  const rows = assignments.map(a => ({
    id: a.id,
    business_name: a.businessName,
    assigned_pm: a.assignedPm,
  }));
  const { error } = await supabase.from('client_pm_assignments').upsert(rows, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(`Failed to save assignments: ${error.message}`);
}

export async function deleteClientPmAssignment(id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('client_pm_assignments').delete().eq('id', id);
}

export async function insertAuditLog({ userId, userEmail, actionType, entityType, entityId, entityName, details }) {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    user_email: userEmail,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId || '',
    entity_name: entityName || '',
    details: details || {}
  }).select().single();
  if (error) { console.error('insertAuditLog error:', error); return null; }
  return data;
}

export async function loadAuditLogs() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadAuditLogs error:', error); return []; }
  return data || [];
}

export async function deleteAuditLog(id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from('audit_logs').delete().eq('id', id);
}

export async function deleteAuditLogs(ids) {
  if (!isSupabaseConfigured() || ids.length === 0) return;
  await supabase.from('audit_logs').delete().in('id', ids);
}

export async function migrateFromLocalStorage() {
  if (!isSupabaseConfigured()) return false;
  const loadLS = (key, def) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : def;
    } catch { return def; }
  };

  const monthlyRecords = loadLS('profitpilot_monthlyRecords', null);
  if (monthlyRecords) {
    const allRows = [];
    for (const [key, recs] of Object.entries(monthlyRecords)) {
      const [year, month] = key.split('-');
      for (const rec of recs) {
        allRows.push(mapRecordToDB({ ...rec, _year: year, _month: month }));
      }
    }
    if (allRows.length > 0) {
      await supabase.from('monthly_client_records').upsert(allRows, { onConflict: 'id', ignoreDuplicates: false });
    }
  }

  const exchangeRate = loadLS('profitpilot_exchangeRate', 83);
  const profitGoal = loadLS('profitpilot_profitGoal', 200000);
  const currencyView = loadLS('profitpilot_currencyView', 'USD');
  await saveSettings(exchangeRate, profitGoal, currencyView);

  const expenses = loadLS('profitpilot_expenses', null);
  if (expenses && expenses.length > 0) await saveExpenses(expenses);

  const team = loadLS('profitpilot_team', null);
  if (team && team.length > 0) await saveTeam(team);

  const syncLogs = loadLS('profitpilot_syncLogs', null);
  if (syncLogs && syncLogs.length > 0) await saveSyncLogs(syncLogs);

  return true;
}
