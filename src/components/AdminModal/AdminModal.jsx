import { useState } from 'react';
import TabOffice from './TabOffice';
import TabOffices from './TabOffices';
import TabEmail from './TabEmail';
const ADMIN_PASSWORD = 'SRM-Admin1';
const TABS = ['office', 'offices', 'email'];
const TAB_LABELS = { office: '🏢 Office', offices: '📍 Offices', email: '✉️ Email' };

export default function AdminModal({ offices, activeName, onOfficeChange, onOfficesChange, onClose }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('srm_admin_auth') === '1');
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState(false);
  const [tab, setTab] = useState('office');

  function checkPw() {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('srm_admin_auth', '1');
      setPwErr(false);
      setAuthed(true);
    } else {
      setPwErr(true);
    }
  }

  function signOut() {
    sessionStorage.removeItem('srm_admin_auth');
    setAuthed(false);
    setPw('');
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Device Settings</h3>
            <p>Configure this reception terminal</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!authed ? (
            <>
              <div className="modal-field">
                <label>Admin Password</label>
                <input
                  type="password"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkPw()}
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              {pwErr && <div className="modal-error">Incorrect password.</div>}
              <button className="modal-btn" onClick={checkPw}>Sign In</button>
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
              {tab === 'office'   && <TabOffice offices={offices} activeName={activeName} onOfficeChange={onOfficeChange} onClose={onClose} />}
              {tab === 'offices'  && <TabOffices onOfficesChange={onOfficesChange} />}
              {tab === 'email'    && <TabEmail activeName={activeName} />}
              <button className="modal-btn secondary" onClick={signOut}>Sign Out</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
