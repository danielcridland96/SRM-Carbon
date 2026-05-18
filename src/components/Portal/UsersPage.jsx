import { useState, useEffect } from 'react';
import { loadOffices } from '../../lib/offices';

export default function UsersPage({ sb }) {
  const [users, setUsers]     = useState(null);
  const [showCreate, setShow] = useState(false);
  const [form, setForm]       = useState({ name: '', email: '', pass: '', role: '', office: '' });
  const [createErr, setErr]   = useState('');
  const [createOk, setOk]     = useState(false);
  const [submitting, setSub]  = useState(false);
  const offices = Object.keys(loadOffices());

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await sb.from('user_profiles').select('*').order('role');
    setUsers(data || []);
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function createUser() {
    setErr(''); setOk(false);
    const { name, email, pass, role, office } = form;
    if (!name || !email || !pass || !role) { setErr('Please fill in all required fields.'); return; }
    if (pass.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (role !== 'admin' && !office) { setErr('Please select an office (only admins can have all offices).'); return; }

    setSub(true);
    const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
      email, password: pass, options: { data: { full_name: name } }
    });
    if (signUpErr) { setErr(signUpErr.message); setSub(false); return; }

    const uid = signUpData.user?.id;
    if (!uid) { setErr('Could not retrieve user ID. Email may already be in use.'); setSub(false); return; }

    const { error: profileErr } = await sb.from('user_profiles').insert({
      id: uid, email, full_name: name, role, office_name: office || null
    });
    setSub(false);
    if (profileErr) { setErr('Account created but profile save failed: ' + profileErr.message); return; }

    setOk(true);
    setForm({ name: '', email: '', pass: '', role: '', office: '' });
    setTimeout(() => { setOk(false); setShow(false); load(); }, 2000);
  }

  return (
    <>
      <div className="page-header">
        <h2>Manage Users</h2>
        <p>Create staff accounts and assign roles.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
          {users ? `${users.length} staff account${users.length !== 1 ? 's' : ''}` : ''}
        </span>
        <button className="export-btn" onClick={() => setShow(s => !s)}>
          {showCreate ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showCreate && (
        <div className="create-panel">
          <h3>Add New Staff Member</h3>
          <p>They'll receive a confirmation email if email verification is enabled in your Supabase project.</p>
          {createOk && <div className="alert alert-success">✅ User created successfully!</div>}
          {createErr && <div className="alert alert-error">{createErr}</div>}
          <div className="create-grid">
            <div className="modal-field">
              <label>Full Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="modal-field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="jane@srm.com" />
            </div>
            <div className="modal-field">
              <label>Password *</label>
              <input type="password" value={form.pass} onChange={e => setF('pass', e.target.value)} placeholder="Min 8 characters" />
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
                <option value="">All offices (admin)</option>
                {offices.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <button className="modal-btn" style={{ marginTop: 8 }} onClick={createUser} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Account'}
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
          </div>
        </div>
      ))}

      <div className="info-box">
        <strong>Role permissions:</strong><br />
        <span className="role-pill role-receptionist">receptionist</span> Today's visitors · own office · basic columns only<br />
        <span className="role-pill role-manager">manager</span> All dates · own office · full columns + carbon + CSV export<br />
        <span className="role-pill role-admin">admin</span> All offices · all data · carbon report · user management
      </div>
    </>
  );
}
