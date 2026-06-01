import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { AppContext } from '../../context/AppContext';
import { getBaseRole } from '../../utils/helpers';
import { Bell, X, ChevronRight } from 'lucide-react';
import './NotificationPanel.css';

const ACTION_META = {
  'client.create':  { label: 'Created Client',  color: '#22c55e' },
  'client.update':  { label: 'Updated Client',  color: '#3b82f6' },
  'client.delete':  { label: 'Deleted Client',  color: '#ef4444' },
  'client.restore': { label: 'Restored Client',  color: '#f59e0b' },
  'client.mark_paid':   { label: 'Marked Paid',    color: '#22c55e' },
  'client.mark_unpaid': { label: 'Marked Unpaid',  color: '#64748b' },
  'client.bulk_delete': { label: 'Bulk Deleted',   color: '#ef4444' },
  'client.bulk_import': { label: 'Imported Clients', color: '#8b5cf6' },
  'expense.create':  { label: 'Created Expense', color: '#22c55e' },
  'expense.update':  { label: 'Updated Expense', color: '#3b82f6' },
  'expense.delete':  { label: 'Deleted Expense', color: '#ef4444' },
  'expense.restore': { label: 'Restored Expense', color: '#f59e0b' },
  'expense.bulk_delete': { label: 'Bulk Deleted',  color: '#ef4444' },
  'expense.bulk_import': { label: 'Imported Exp.',  color: '#8b5cf6' },
  'expense.undo_import': { label: 'Undid Import',   color: '#f59e0b' },
  'team.create': { label: 'Added Member', color: '#22c55e' },
  'team.update': { label: 'Updated Member', color: '#3b82f6' },
  'team.delete': { label: 'Deleted Member', color: '#ef4444' },
  'assignment.create': { label: 'Assigned PM',  color: '#8b5cf6' },
  'assignment.delete': { label: 'Removed PM',   color: '#ef4444' },
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

export default function NotificationPanel() {
  const { user, userRole } = useContext(AuthContext);
  const { auditLogs } = useContext(AppContext);
  const [dismissed, setDismissed] = useState(new Set());
  const navigate = useNavigate();

  if (getBaseRole(userRole) !== 'admin') return null;

  const recent = auditLogs
    .filter(l => !dismissed.has(l.id))
    .slice(0, 4);

  if (recent.length === 0) {
    return (
      <div className="notif-panel notif-empty">
        <div className="notif-header">
          <Bell size={16} />
          <span>Recent Activity</span>
        </div>
        <div className="notif-body-empty">
          <span className="notif-empty-icon">✓</span>
          <span>No recent activity</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notif-panel">
      <div className="notif-header">
        <Bell size={16} />
        <span>Recent Activity</span>
        <span className="notif-count">{auditLogs.length}</span>
        <button className="notif-dismiss-all" onClick={() => setDismissed(new Set(auditLogs.map(l => l.id)))} title="Dismiss all">
          <X size={14} />
        </button>
      </div>
      <div className="notif-body">
        {recent.map(log => {
          const meta = ACTION_META[log.action_type] || { label: log.action_type, color: '#64748b' };
          return (
            <div key={log.id} className="notif-item">
              <div className="notif-avatar" style={{ background: `${meta.color}18`, color: meta.color }}>
                {(log.user_email || 'U')[0].toUpperCase()}
              </div>
              <div className="notif-content">
                <div className="notif-text">
                  <span className="notif-user">{log.user_email}</span>
                  <span className="notif-action" style={{ color: meta.color }}>{meta.label.toLowerCase()}</span>
                  {log.entity_name && <span className="notif-entity">{log.entity_name}</span>}
                </div>
                <span className="notif-time">{timeAgo(log.created_at)}</span>
              </div>
              <button className="notif-dismiss" onClick={() => setDismissed(prev => new Set([...prev, log.id]))}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="notif-footer" onClick={() => navigate('/audit-log')}>
        View all activity <ChevronRight size={14} />
      </div>
    </div>
  );
}
