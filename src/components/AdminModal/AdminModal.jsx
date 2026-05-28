/**
 * AdminModal — device settings for a reception kiosk terminal.
 *
 * Authentication uses Azure AD via Azure Static Web Apps built-in auth.
 * The admin clicks "Sign in with Microsoft", is redirected to the SRM
 * Microsoft login page, and returns to the check-in form with a session
 * cookie active. The modal verifies the session has admin role via /api/profile.
 *
 * On close, the SWA session is signed out to prevent an admin session
 * persisting on a shared kiosk device.
 *
 * The URL param ?openAdmin=1 is used to auto-open the modal after the
 * Azure AD redirect returns the user to the check-in page.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAuthUser, loginUrl, logout } from '../../lib/auth';
import { api } from '../../lib/api';
import TabOffice  from './TabOffice';
import TabOffices from './TabOffices';
import TabEmail   from './TabEmail';

const TABS       = ['office', 'offices', 'email'];
const TAB_LABELS = { office: '🏢 Office', offices: '📍 Offices', email: '✉️ Email' };

export default function AdminModal({ offices, activeName, onOfficeChange, onOfficesChange, onClose }) {
  const [authed,  setAuthed]  = useState(false);
  const [checking, setChecking] = useState(true);
  const [err,     setErr]     = useState('');
  const [tab,     setTab]     = useState('office');
  const [, setSearchParams]   = useSearchParams();

  // On mount: check if there is already an active Azure AD session with admin role
  useEffect(() => {
    async function checkSession() {
      const user = await getAuthUser();
      if (!user) { setChecking(false); return; }

      try {
        const profile = await api.profile();
        if (profile.role === 'admin') {
          setAuthed(true);
        } else {
          setErr('Admin access required. Your account does not have the admin role.');
          await logout();
        }
      } catch {
        setErr('');
      }
      setChecking(false);
    }
    checkSession();
  }, []);

  async function handleClose() {
    if (authed) {
      // Sign out of Azure AD session so the kiosk is clean for the next visitor
      await fetch('/.auth/logout');
    }
    // Remove the ?openAdmin param from the URL
    setSearchParams({});
    setAuthed(false);
    onClose();
  }

  function handleSignIn() {
    // Redirect to Azure AD login; on return, ?openAdmin=1 auto-reopens this modal
    window.location.href = loginUrl('/?openAdmin=1');
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div><h3>Device Settings</h3><p>Configure this reception terminal</p></div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          {checking ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>Checking session…</div>
          ) : !authed ? (
            <>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Sign in with your SRM Microsoft admin account to configure this terminal.
              </p>
              {err && <div className="modal-error" style={{ display: 'block', marginBottom: 16 }}>{err}</div>}
              <button className="modal-btn" onClick={handleSignIn}>
                Sign in with Microsoft
              </button>
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

              {tab === 'office'  && <TabOffice  offices={offices} activeName={activeName} onOfficeChange={onOfficeChange} onClose={handleClose} />}
              {tab === 'offices' && <TabOffices onOfficesChange={onOfficesChange} />}
              {tab === 'email'   && <TabEmail   activeName={activeName} />}

              <button className="modal-btn secondary" onClick={handleClose}>Close &amp; Sign Out</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
