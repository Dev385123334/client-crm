import React, { useContext, useState, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { getBaseRole } from '../utils/helpers';
import { RotateCcw, Trash2, Search, Filter, Clock, ArrowUpDown } from 'lucide-react';
import './Settings.css';

const ACTION_LABELS = {
  'client.create': 'Created Client',
  'client.update': 'Updated Client',
  'client.delete': 'Deleted Client',
  'client.restore': 'Restored Client',
  'client.permanent_delete': 'Permanently Deleted Client',
  'client.mark_paid': 'Marked Client Paid',
  'client.mark_unpaid': 'Marked Client Unpaid',
  'client.bulk_delete': 'Bulk Deleted Clients',
  'client.bulk_import': 'Imported Clients',
  'expense.create': 'Created Expense',
  'expense.update': 'Updated Expense',
  'expense.delete': 'Deleted Expense',
  'expense.restore': 'Restored Expense',
  'expense.permanent_delete': 'Permanently Deleted Expense',
  'expense.bulk_delete': 'Bulk Deleted Expenses',
  'expense.bulk_import': 'Imported Expenses',
  'expense.undo_import': 'Undid Expense Import',
  'team.create': 'Created Team Member',
  'team.update': 'Updated Team Member',
  'team.delete': 'Deleted Team Member',
  'assignment.create': 'Assigned PM to Client',
  'assignment.delete': 'Removed PM Assignment',
  'config.update': 'Changed Configuration'
};

export default function AuditLog() {
  const { user } = useContext(AuthContext);
  const { auditLogs, refreshAuditLogs, monthlyRecords, restoreRecord, setExpenses, setTeam, assignments, saveAssignments } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const actions = useMemo(() => [...new Set(auditLogs.map(l => l.action_type))].sort(), [auditLogs]);

  const filtered = useMemo(() => {
    let list = [...auditLogs];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.user_email || '').toLowerCase().includes(q) ||
        (l.entity_name || '').toLowerCase().includes(q) ||
        (ACTION_LABELS[l.action_type] || l.action_type).toLowerCase().includes(q)
      );
    }
    if (actionFilter) list = list.filter(l => l.action_type === actionFilter);
    list.sort((a, b) => {
      const d = new Date(a.created_at) - new Date(b.created_at);
      return sortAsc ? d : -d;
    });
    return list;
  }, [auditLogs, search, actionFilter, sortAsc]);

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

  const isRestorable = (log) => {
    return ['client.delete', 'expense.delete', 'team.delete', 'assignment.delete'].includes(log.action_type);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Audit Log</h1>
        <button className="btn btn-secondary" onClick={refreshAuditLogs} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RotateCcw size={16} /> Refresh
        </button>
      </div>

      <div className="settings-card">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="input-label">Search</label>
            <input className="input-field" placeholder="User, entity, action..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="input-group" style={{ width: 200 }}>
            <label className="input-label">Action Type</label>
            <select className="input-field" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
              <option value="">All</option>
              {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ width: 140 }}>
            <label className="input-label">Sort</label>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSortAsc(!sortAsc)}>
              <ArrowUpDown size={14} /> {sortAsc ? 'Oldest' : 'Newest'}
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No audit log entries yet.</p>
        ) : (
          <div className="assignments-table">
            <div className="assignments-header" style={{ gridTemplateColumns: '1fr 1.5fr 1fr 80px' }}>
              <span>Time</span>
              <span>User</span>
              <span>Action</span>
              <span></span>
            </div>
            {filtered.map(log => (
              <div key={log.id} className="assignments-row" style={{ gridTemplateColumns: '1fr 1.5fr 1fr 80px', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleString()}
                </span>
                <span style={{ fontSize: 13 }}>
                  <strong>{log.user_email}</strong>
                </span>
                <span style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{ACTION_LABELS[log.action_type] || log.action_type}</span>
                  {log.entity_name && <span style={{ color: 'var(--text-muted)' }}> — {log.entity_name}</span>}
                </span>
                <span>
                  {isRestorable(log) && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => handleRestore(log)}
                      disabled={restoring === log.id}
                      title="Restore"
                    >
                      {restoring === log.id ? '...' : <RotateCcw size={14} />}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
