import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { loadOffices } from '../../lib/offices';

export default function UsersPage() {
  const [users,     setUsers]   = useState(null);
  const [showForm,  setShow]    = useState(false);
  const [form,      setForm]    = useState({ name: '', email: '', role: '', office: '' });
  const [formErr,   setFormErr] = useState('');
  const [formOk,    setFormOk]  = useState(false);
  const [submitting, setSub]    = useState(false);

  const offices = Object.keys(loadOffices());

  useEffect(() => { load(); }, []);

  async function load() {
    try { setUsers(await api.users.list()); } catch { setUsers([]); }
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function createUser() {
    setFormErr(''); setFormOk(false);
    const { name, email, role, office } = form;

    if (!name || !email || !role) { setFormErr('Please fill in all required fields.'); return; }
    if (!['receptionist','manager','admin'].includes(role)) { setFormErr('Invalid role.'); return; }
    if (role !== 'admin' && !office) { setFormErr('Please select an office (only admins can have all offices).'); return; }

    setSub(true);
    try {
      await api.users.create({ email, full_name: name, role, office_name: office || null });
      setFormOk(true);
      setForm({ name: '', email: '', role: '', office: '' });
      setTimeout(() => { setFormOk(false); setShow(false); load(); }, 2000);
    } catch (e) {
      setFormErr(e.message || 'Failed to create user.');
    }
    setSub(false);
  }

  async function deleteUser(id, email) {
    if (!window.confirm(`Remove portal access for ${email}? They will no longer be able to sign in.`)) return;
    try {
      await api.users.delete(id);
      load();
    } catch (e) {
      alert(e.message || 'Failed to remove user.');
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Manage Users</h2>
        <p>Grant and revoke staff portal access. Users sign in with their SRM Microsoft accounts.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
          {users ? `${users.length} staff account${users.length !== 1 ? 's' : ''}` : ''}
        </span>
        <button className="export-btn" onClick={() => setShow(s => !s)}>
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <div className="create-panel">
          <h3>Grant Portal Access</h3>
          <p>
            Enter the staff member's SRM Microsoft account email. They'll sign in with their
            existing Microsoft account — no password is created here.
          </p>
          {formOk  && <div className="alert alert-success">✅ Access granted successfully!</div>}
          {formErr && <div className="alert alert-error">{formErr}</div>}
          <div className="create-grid">
            <div className="modal-field">
              <label>Full Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="modal-field">
              <label>SRM Email *</label>
              <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="jane.smith@srm.com" />
            </div>
            <div className="modal-field">
              <label>Role *</label>
              <select value={form.role} onChange={e => setF('role', e.target.value)}>
                <option value="">Select role…</option>
                <option value="receptionist">Receptionist — today's visitors, own office</option>
                <option value="manager">Manager — all dates, own office, carbon data</option>
                <option value="admin">Admin — all offices, all data, user management</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Office</label>
              <select value={form.office} onChange={e => setF('office', e.target.value)}>
                <option value="">All offices (admin only)</option>
                {offices.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <button className="modal-btn" style={{ marginTop: 8 }} onClick={createUser} disabled={submitting}>
            {submitting ? 'Granting access…' : 'Grant Access'}
          </button>
        </div>
      )}

      {users === null && <div className="loading-state">Loading users…</div>}
      {users?.map(u => (
        <div className="user-card" key={u.id}>
          <div>
            <div className="user-name">{u.full_name || '—'}</div>
            <div className="user-email-sub">{u.email}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{u.office_name || 'All offices'}</span>
            <span className={`role-pill role-${u.role}`}>{u.role}</span>
            <button className="btn-icon del" onClick={() => deleteUser(u.id, u.email)} title="Remove access">✕</button>
          </div>
        </div>
      ))}

      <div className="info-box">
        <strong>How access works:</strong><br />
        Staff sign in with their SRM Microsoft account — no separate password needed. Add their
        SRM email above to grant access. Remove them to revoke it immediately.<br /><br />
        <span className="role-pill role-receptionist">receptionist</span> Today's visitors · own office only<br />
        <span className="role-pill role-manager">manager</span> All dates · own office · carbon report · CSV export<br />
        <span className="role-pill role-admin">admin</span> All offices · all data · user management
      </div>
    </>
  );
}
