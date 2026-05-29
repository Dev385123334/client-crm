import React, { useContext, useState, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { X, UserPlus } from 'lucide-react';
import './Settings.css';

export default function ClientPM() {
  const { user } = useContext(AuthContext);
  const { monthlyRecords, assignments, saveAssignments, deleteAssignment, logAction } = useContext(AppContext);
  const [saved, setSaved] = useState(false);
  const [selectedPM, setSelectedPM] = useState({});

  const allClients = useMemo(() => {
    const seen = new Set();
    const clients = [];
    for (const recs of Object.values(monthlyRecords)) {
      for (const r of recs) {
        if (r.isDeleted) continue;
        const key = r.businessName + '|' + (r.onboardingDate || '');
        if (!seen.has(key)) {
          seen.add(key);
          clients.push({ businessName: r.businessName, onboardingDate: r.onboardingDate || '' });
        }
      }
    }
    return clients.sort((a, b) => a.businessName.localeCompare(b.businessName));
  }, [monthlyRecords]);

  const getAssignmentsFor = (businessName) =>
    assignments.filter(a => a.businessName === businessName);

  const handleAdd = async (businessName) => {
    const pm = selectedPM[businessName];
    if (!pm || !pm.trim()) return;
    const exists = assignments.some(a => a.businessName === businessName && a.assignedPm === pm.trim());
    if (exists) return;
    const newAssign = { id: crypto.randomUUID(), businessName, assignedPm: pm.trim() };
    await saveAssignments([...assignments, newAssign]);
    logAction({ user, actionType: 'assignment.create', entityType: 'assignment', entityId: newAssign.id, entityName: businessName, details: { assignedPm: pm.trim() } });
    setSelectedPM(prev => ({ ...prev, [businessName]: '' }));
  };

  const handleDelete = async (id) => {
    const assign = assignments.find(a => a.id === id);
    await deleteAssignment(id);
    logAction({ user, actionType: 'assignment.delete', entityType: 'assignment', entityId: id, entityName: assign?.businessName, details: { assignedPm: assign?.assignedPm } });
  };

  const handleSave = async () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (allClients.length === 0) {
    return (
      <div className="settings-page">
        <div className="settings-header"><h1>Client-PM Assignments</h1></div>
        <div className="settings-card"><p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No clients found. Add clients first.</p></div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Client-PM Assignments</h1>
        {saved && <span className="save-badge">Saved</span>}
      </div>

      <div className="settings-card">
        <p className="settings-description">Assign which PM editors can see each client. Admin always sees everything.</p>
        <div className="assignments-table">
          <div className="assignments-header">
            <span className="assignments-col-client">Client</span>
            <span className="assignments-col-pms">Assigned PMs</span>
            <span className="assignments-col-action">Add PM</span>
          </div>
          {allClients.map(client => {
            const clientAssigns = getAssignmentsFor(client.businessName);
            return (
              <div key={client.businessName + client.onboardingDate} className="assignments-row">
                <div className="assignments-col-client">
                  <strong>{client.businessName}</strong>
                  {client.onboardingDate && <span className="text-muted" style={{ fontSize: 12, display: 'block' }}>{client.onboardingDate}</span>}
                </div>
                <div className="assignments-col-pms">
                  {clientAssigns.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: 13 }}>Not assigned</span>
                  ) : (
                    <div className="pm-tags">
                      {clientAssigns.map(a => (
                        <span key={a.id} className="pm-tag">
                          {a.assignedPm}
                          <button className="pm-tag-remove" onClick={() => handleDelete(a.id)}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="assignments-col-action">
                  <div className="pm-add-row">
                    <input
                      className="input-field"
                      style={{ width: 140 }}
                      placeholder="e.g. pm1_editor"
                      value={selectedPM[client.businessName] || ''}
                      onChange={e => setSelectedPM(prev => ({ ...prev, [client.businessName]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd(client.businessName); }}
                    />
                    <button className="btn-icon" onClick={() => handleAdd(client.businessName)} title="Add PM">
                      <UserPlus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
