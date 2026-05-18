import { useState } from 'react';
import TabOffice from './TabOffice';
import TabOffices from './TabOffices';
import TabEmail from './TabEmail';

const TABS = ['office', 'offices', 'email'];
const TAB_LABELS = { office: '🏢 Office', offices: '📍 Offices', email: '✉️ Email' };

export default function AdminModal({ sb, offices, activeName, onOfficeChange, onOfficesChange, onClose }) {
  const [authed, setAuthed]   = useState(false);
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab]         = useState('office');

  async function checkAuth() {
    setErr(''); setLoading(true);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { setErr('Sign-in failed.'); setLoading(false); return; }

    const { data: prof } = await sb.from('user_profiles').select('role').eq('id', data.user.id).single();
    if (!prof || prof.role !== 'admin') {
      await sb.auth.signOut();
      setErr('Admin access required.');
      setLoading(false);
      return;
    }
    setLoading(false);
    setAuthed(true);
  }

  async function handleClose() {
    if (authed) await sb.auth.signOut();
    setAuthed(false); setEmail(''); setPw(''); setErr('');
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div><h3>Device Settings</h3><p>Configure this reception terminal</p></div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>
        <div className="modal-body">
          {!authed ? (
            <>
              <div className="modal-field">
                <label>Admin Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkAuth()} placeholder="admin@srm.com" autoFocus />
              </div>
              <div className="modal-field">
                <label>Password</label>
                <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkAuth()} placeholder="Your password" />
              </div>
              {err && <div className="modal-error">{err}</div>}
              <button className="modal-btn" onClick={checkAuth} disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--cream)', borderRadius: 10, padding: 4 }}>
                {TABS.map(t => (
                  <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
              {tab === 'office'  && <TabOffice offices={offices} activeName={activeName} onOfficeChange={onOfficeChange} onClose={handleClose} />}
              {tab === 'offices' && <TabOffices onOfficesChange={onOfficesChange} />}
              {tab === 'email'   && <TabEmail activeName={activeName} />}
              <button className="modal-btn secondary" onClick={handleClose}>Close &amp; Sign Out</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
