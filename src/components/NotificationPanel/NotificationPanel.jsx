import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { AppContext } from '../../context/AppContext';
import { getBaseRole } from '../../utils/helpers';
import { Bell, RotateCcw, X } from 'lucide-react';
import './NotificationPanel.css';

const ACTION_LABELS = {
  'client.create': 'created client',
  'client.update': 'updated client',
  'client.delete': 'deleted client',
  'client.restore': 'restored client',
  'client.mark_paid': 'marked client paid',
  'client.bulk_delete': 'bulk deleted clients',
  'client.bulk_import': 'imported clients',
  'expense.create': 'created expense',
  'expense.update': 'updated expense',
  'expense.delete': 'deleted expense',
  'expense.restore': 'restored expense',
  'expense.bulk_delete': 'bulk deleted expenses',
  'expense.bulk_import': 'imported expenses',
  'team.create': 'added team member',
  'team.update': 'updated team member',
  'team.delete': 'deleted team member',
  'assignment.create': 'assigned PM',
  'assignment.delete': 'removed PM'
};

export default function NotificationPanel() {
  const { user, userRole } = useContext(AuthContext);
  const { auditLogs } = useContext(AppContext);
  const [dismissed, setDismissed] = useState(new Set());

  if (getBaseRole(userRole) !== 'admin') return null;

  const recent = auditLogs
    .filter(l => !dismissed.has(l.id))
    .slice(0, 5);

  if (recent.length === 0) return null;

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="notification-panel">
      <div className="notification-header">
        <Bell size={16} />
        <span>Recent Activity</span>
        <button className="notification-dismiss-all" onClick={() => setDismissed(new Set(auditLogs.map(l => l.id)))}>
          <X size={14} /> Dismiss all
        </button>
      </div>
      <div className="notification-list">
        {recent.map(log => (
          <div key={log.id} className="notification-item">
            <div className="notification-content">
              <strong>{log.user_email}</strong>
              <span> {ACTION_LABELS[log.action_type] || log.action_type}</span>
              {log.entity_name && <span className="notification-entity"> &quot;{log.entity_name}&quot;</span>}
            </div>
            <div className="notification-meta">
              <span className="notification-time">{timeAgo(log.created_at)}</span>
              <button className="notification-dismiss" onClick={() => setDismissed(prev => new Set([...prev, log.id]))}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
