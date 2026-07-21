import React, { useContext, useState, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { deleteAuditLogs } from '../supabase/db';
import { RotateCcw, Trash2, Search, ArrowUpDown, RefreshCw, Check, X, Circle, Clock, User, Shield } from 'lucide-react';
import './Settings.css';

const ACTION_META = {
  'client.create':        { label: 'Created Client',        icon: '➕', color: '#22c55e' },
  'client.update':        { label: 'Updated Client',        icon: '✏️', color: '#3b82f6' },
  'client.delete':        { label: 'Deleted Client',        icon: '🗑️', color: '#ef4444', restorable: true },
  'client.restore':       { label: 'Restored Client',       icon: '↩️', color: '#f59e0b' },
  'client.permanent_delete': { label: 'Permanently Deleted', icon: '🔥', color: '#dc2626' },
  'client.mark_paid':     { label: 'Marked Paid',           icon: '💰', color: '#22c55e' },
  'client.mark_unpaid':   { label: 'Marked Unpaid',         icon: '💸', color: '#64748b' },
  'client.bulk_delete':   { label: 'Bulk Deleted Clients',  icon: '📦', color: '#ef4444' },
  'client.bulk_import':   { label: 'Imported Clients',      icon: '📥', color: '#8b5cf6' },
  'expense.create':       { label: 'Created Expense',       icon: '➕', color: '#22c55e' },
  'expense.update':       { label: 'Updated Expense',       icon: '✏️', color: '#3b82f6' },
  'expense.delete':       { label: 'Deleted Expense',       icon: '🗑️', color: '#ef4444', restorable: true },
  'expense.restore':      { label: 'Restored Expense',      icon: '↩️', color: '#f59e0b' },
  'expense.permanent_delete': { label: 'Permanently Deleted', icon: '🔥', color: '#dc2626' },
  'expense.bulk_delete':  { label: 'Bulk Deleted Expenses', icon: '📦', color: '#ef4444' },
  'expense.bulk_import':  { label: 'Imported Expenses',     icon: '📥', color: '#8b5cf6' },
  'expense.undo_import':  { label: 'Undid Import',          icon: '↩️', color: '#f59e0b' },
  'team.create':          { label: 'Added Team Member',     icon: '➕', color: '#22c55e' },
  'team.update':          { label: 'Updated Team Member',   icon: '✏️', color: '#3b82f6' },
  'team.delete':          { label: 'Deleted Team Member',   icon: '🗑️', color: '#ef4444', restorable: true },
  'assignment.create':    { label: 'Assigned PM',           icon: '🔗', color: '#8b5cf6' },
  'assignment.delete':    { label: 'Removed PM',            icon: '🔗', color: '#ef4444', restorable: true },
  'config.update':        { label: 'Changed Config',        icon: '⚙️', color: '#64748b' }
};

const ACTION_GROUPS = {
  All: [],
  Create: ['client.create', 'expense.create', 'team.create', 'assignment.create'],
  Update: ['client.update', 'expense.update', 'team.update', 'config.update'],
  Delete: ['client.delete', 'client.bulk_delete', 'client.permanent_delete', 'expense.delete', 'expense.bulk_delete', 'expense.permanent_delete', 'team.delete', 'assignment.delete'],
  Restore: ['client.restore', 'expense.restore', 'expense.undo_import'],
  Payment: ['client.mark_paid', 'client.mark_unpaid'],
  Import: ['client.bulk_import', 'expense.bulk_import']
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AuditLog() {
  const { user } = useContext(AuthContext);
  const { auditLogs, setAuditLogs, refreshAuditLogs, monthlyRecords, restoreRecord, setExpenses, setTeam, assignments, saveAssignments } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [sortAsc, setSortAsc] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = [...auditLogs];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.user_email || '').toLowerCase().includes(q) ||
        (l.entity_name || '').toLowerCase().includes(q) ||
        (ACTION_META[l.action_type]?.label || l.action_type).toLowerCase().includes(q)
      );
    }
    if (groupFilter !== 'All') {
      const allowed = ACTION_GROUPS[groupFilter] || [];
      list = list.filter(l => allowed.includes(l.action_type));
    }
    list.sort((a, b) => {
      const d = new Date(a.created_at) - new Date(b.created_at);
      return sortAsc ? d : -d;
    });
    return list;
  }, [auditLogs, search, groupFilter, sortAsc]);

  const handleRestore = async (log) => {
    setRestoring(log.id);
    const details = log.details || {};
    try {
      if (log.action_type === 'client.delete') {
        const entityId = log.entity_id;
        for (const [key, recs] of Object.entries(monthlyRecords)) {
          const match = recs.find(r => r.id === entityId && r.isDeleted);
          if (match) {
            const [year, month] = key.split('-');
            restoreRecord(entityId, match.status || 'Active', month, year);
            break;
          }
        }
      } else if (log.action_type === 'expense.delete') {
        const restored = (details.record || details);
        if (restored) {
          setExpenses(prev => {
            if (prev.some(e => e.id === restored.id)) return prev;
            return [{ ...restored, deletedAt: undefined }, ...prev];
          });
        }
      } else if (log.action_type === 'team.delete') {
        const restored = (details.record || details);
        if (restored) {
          setTeam(prev => {
            if (prev.some(t => t.id === restored.id)) return prev;
            return [...prev, restored];
          });
        }
      } else if (log.action_type === 'assignment.delete') {
        const newAssign = {
          id: crypto.randomUUID(),
          businessName: log.entity_name,
          assignedPm: details.assignedPm || ''
        };
        await saveAssignments([...assignments, newAssign]);
      }
    } catch (err) {
      console.error('Restore failed:', err);
    }
    setRestoring(null);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(l => l.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} audit log entr${selected.size === 1 ? 'y' : 'ies'}?`)) return;
    setDeleting(true);
    const ids = [...selected];
    await deleteAuditLogs(ids);
    setAuditLogs(prev => prev.filter(l => !ids.includes(l.id)));
    setSelected(new Set());
    setDeleting(false);
  };

  const handleDeleteSingle = async (id) => {
    if (!confirm('Delete this audit log entry?')) return;
    await deleteAuditLogs([id]);
    setAuditLogs(prev => prev.filter(l => l.id !== id));
  };

  const stats = useMemo(() => {
    const total = auditLogs.length;
    const uniqueUsers = new Set(auditLogs.map(l => l.user_email)).size;
    const restorable = auditLogs.filter(l => ACTION_META[l.action_type]?.restorable).length;
    const today = auditLogs.filter(l => {
      const d = new Date(l.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, uniqueUsers, restorable, today };
  }, [auditLogs]);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 style={{ margin: 0 }}>Audit Log</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Track every change made across the system
          </p>
        </div>
        <button className="btn btn-secondary" onClick={refreshAuditLogs} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="breakdown-row" style={{ marginBottom: 0 }}>
        {[
          { label: 'Total Entries', value: stats.total, color: '#3b82f6' },
          { label: 'Unique Users', value: stats.uniqueUsers, color: '#8b5cf6' },
          { label: 'Restorable', value: stats.restorable, color: '#22c55e' },
          { label: 'Today', value: stats.today, color: '#f59e0b' }
        ].map(stat => (
          <div key={stat.label} className="card stat-card" style={{ flex: 1, minWidth: 120 }}>
            <div className="stat-label" style={{ color: stat.color }}>{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="settings-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="input-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input-field" style={{ paddingLeft: 32 }} placeholder="User, entity, action..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="input-group" style={{ width: 160, marginBottom: 0 }}>
            <label className="input-label">Category</label>
            <select className="input-field" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              {Object.keys(ACTION_GROUPS).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ width: 120, marginBottom: 0 }}>
            <label className="input-label">Order</label>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSortAsc(!sortAsc)}>
              <ArrowUpDown size={14} /> {sortAsc ? 'Oldest' : 'Newest'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={refreshAuditLogs}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selected.size > 0 && (
          <div style={{
            marginTop: 12, padding: '8px 12px', background: 'var(--danger-bg, #fef2f2)',
            border: '1px solid var(--danger, #ef4444)', borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 13
          }}>
            <Check size={16} style={{ color: 'var(--danger, #ef4444)' }} />
            <span><strong>{selected.size}</strong> entr{selected.size === 1 ? 'y' : 'ies'} selected</span>
            <button className="btn btn-danger" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px' }}
              onClick={handleBulkDelete} disabled={deleting}>
              <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
            <button className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setSelected(new Set())}>
              Deselect
            </button>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Shield size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>No audit log entries match your filters.</p>
          </div>
        ) : (
          <div className="assignments-table" style={{ marginTop: 12 }}>
            <div className="assignments-header" style={{ gridTemplateColumns: '36px 1.2fr 1.5fr 1fr 44px', gap: 8 }}>
              <span>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </span>
              <span>Time</span>
              <span>User</span>
              <span>Action</span>
              <span></span>
            </div>
            {filtered.map(log => {
              const meta = ACTION_META[log.action_type] || { label: log.action_type, color: '#64748b', icon: '•' };
              return (
                <div key={log.id} className="assignments-row"
                  style={{
                    gridTemplateColumns: '36px 1.2fr 1.5fr 1fr 44px', gap: 8, alignItems: 'center',
                    background: selected.has(log.id) ? 'var(--accent-light, #f0f9ff)' : undefined
                  }}>
                  <span>
                    <input type="checkbox" checked={selected.has(log.id)} onChange={() => toggleSelect(log.id)} style={{ cursor: 'pointer' }} />
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column' }}>
                    <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    <span style={{ fontSize: 11 }}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                      color: 'var(--text-muted)', flexShrink: 0
                    }}>
                      {(log.user_email || 'U')[0].toUpperCase()}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user_email}</span>
                  </span>
                  <span style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
                      background: `${meta.color}18`, color: meta.color, width: 'fit-content'
                    }}>
                      {meta.icon} {meta.label}
                    </span>
                    {log.entity_name && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.entity_name}</span>
                    )}
                    {log.action_type === 'client.update' && log.details?.fields && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Fields: {log.details.fields.join(', ')}
                        {log.details?.statusChange && (
                          <span style={{ marginLeft: 8 }}>Status: {log.details.statusChange.from} → {log.details.statusChange.to}</span>
                        )}
                        {log.details?.paymentChange && (
                          <span style={{ marginLeft: 8 }}>Payment: {log.details.paymentChange.from} → {log.details.paymentChange.to}</span>
                        )}
                      </span>
                    )}
                    {(log.action_type === 'client.mark_paid' || log.action_type === 'client.mark_unpaid') && log.details?.trigger && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {log.details.trigger === 'sheets_sync' ? 'Trigger: Google Sheets Sync' : 'Trigger: Manual'} | Month: {log.details.month}/{log.details.year}
                        {log.details?.previousPaymentReceived !== undefined && (
                          <span style={{ marginLeft: 8 }}>Prev: ${log.details.previousPaymentReceived}</span>
                        )}
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {meta.restorable && (
                      <button className="btn-icon" onClick={() => handleRestore(log)} disabled={restoring === log.id}
                        title="Restore" style={{ color: '#22c55e' }}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => handleDeleteSingle(log.id)}
                      title="Delete entry" style={{ color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Showing {filtered.length} of {auditLogs.length} entries
          </div>
        )}
      </div>
    </div>
  );
}
