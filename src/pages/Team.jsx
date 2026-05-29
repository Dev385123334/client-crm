import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { Plus, Trash2, Edit3, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { parseINRAmount } from '../utils/helpers';
import './Team.css';

export default function Team() {
  const { user } = useContext(AuthContext);
  const { team, setTeam, formatINR, logAction } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ name: '', team: 'Day', role: '', monthlySalary: '' });

  const totalMonthly = team.reduce((s, m) => s + m.monthlySalary, 0);
  const totalAnnual = totalMonthly * 12;
  const teamGroups = ['Email', 'Day', 'Night'];
  const grouped = {};
  teamGroups.forEach(t => { grouped[t] = team.filter(m => m.team === t); });

  const openAdd = () => { setForm({ name: '', team: 'Day', role: '', monthlySalary: '' }); setEditMember(null); setShowModal(true); };
  const openEdit = (m) => { setForm({ name: m.name, team: m.team, role: m.role, monthlySalary: m.monthlySalary }); setEditMember(m); setShowModal(true); };
  const save = () => {
    if (!form.name || form.monthlySalary === '' || form.monthlySalary === null || form.monthlySalary === undefined) return;
    if (editMember) {
      setTeam(prev => prev.map(m => m.id === editMember.id ? { ...m, ...form, monthlySalary: parseINRAmount(form.monthlySalary) } : m));
      logAction({ user, actionType: 'team.update', entityType: 'team_member', entityId: editMember.id, entityName: form.name });
    } else {
      const newId = uuidv4();
      setTeam(prev => [...prev, { id: newId, ...form, monthlySalary: parseINRAmount(form.monthlySalary) }]);
      logAction({ user, actionType: 'team.create', entityType: 'team_member', entityId: newId, entityName: form.name });
    }
    setShowModal(false);
  };
  const remove = (id) => {
    if (confirm('Remove?')) {
      const member = team.find(m => m.id === id);
      setTeam(prev => prev.filter(m => m.id !== id));
      logAction({ user, actionType: 'team.delete', entityType: 'team_member', entityId: id, entityName: member?.name, details: { record: member } });
    }
  };

  return (
    <div className="team-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">Manage team members and payroll</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Member</button>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="card stat-card"><div className="stat-label">Team Size</div><div className="stat-value">{team.length}</div></div>
        <div className="card stat-card"><div className="stat-label">Monthly Payroll</div><div className="stat-value">{formatINR(totalMonthly)}</div></div>
        <div className="card stat-card"><div className="stat-label">Annual Payroll</div><div className="stat-value">{formatINR(totalAnnual)}</div></div>
      </div>

      {teamGroups.map(group => (
        <div key={group} className="card team-group-card">
          <div className="team-group-header">
            <Users size={16} />
            <span className="font-semibold">{group} Team</span>
            <span className="badge badge-neutral">{grouped[group].length}</span>
          </div>
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Monthly Salary</th><th>Annual CTC</th><th>Actions</th></tr></thead>
            <tbody>
              {grouped[group].map(member => (
                <tr key={member.id}>
                  <td className="font-medium">{member.name}</td>
                  <td className="text-muted">{member.role}</td>
                  <td className="font-semibold">{formatINR(member.monthlySalary)}</td>
                  <td className="text-muted">{formatINR(member.monthlySalary * 12)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" onClick={() => openEdit(member)}><Edit3 size={14} /></button>
                      <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => remove(member.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="subtotal-row">
                <td colSpan={2} className="font-semibold">{group} Team Total</td>
                <td className="font-semibold">{formatINR(grouped[group].reduce((s, m) => s + m.monthlySalary, 0))}</td>
                <td className="font-semibold">{formatINR(grouped[group].reduce((s, m) => s + m.monthlySalary, 0) * 12)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>{editMember ? 'Edit Member' : 'Add Team Member'}</h2>
            <div className="input-group"><label className="input-label">Name *</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">Team</label><select className="input-field" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })}><option value="Email">Email</option><option value="Day">Day</option><option value="Night">Night</option></select></div>
              <div className="input-group"><label className="input-label">Role</label><input className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
            </div>
            <div className="input-group"><label className="input-label">Monthly Salary (₹) *</label><input className="input-field" type="text" inputMode="numeric" value={form.monthlySalary} onChange={e => setForm({ ...form, monthlySalary: e.target.value })} placeholder="e.g. 50000 or 50,000" /></div>
            <div className="flex gap-3" style={{ marginTop: 16, justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
