/**
 * AdminModal — device settings modal for configuring a reception terminal.
 *
 * Accessible via the ⚙️ button at the bottom-right of the check-in form.
 * Intended for an admin to configure the device (set active office, manage
 * offices, configure EmailJS) without needing to access the full staff portal.
 *
 * Authentication:
 * The modal is protected by Supabase email/password authentication. The user
 * must sign in with an account that has `role = 'admin'` in user_profiles.
 * This replaced a previous hardcoded password ("SRM-Admin1") which was a
 * security vulnerability.
 *
 * Important kiosk behaviour:
 * When the modal closes (either via ✕ or the "Close & Sign Out" button),
 * the authenticated Supabase session is explicitly signed out. This is critical
 * because the check-in screen is a shared kiosk — leaving an authenticated
 * admin session in memory would allow any visitor to access privileged routes.
 *
 * Three tabs (DB tab was removed when Supabase credentials moved to env vars):
 *   Office  — select which office this terminal is currently configured for
 *   Offices — add / edit / remove the global list of offices
 *   Email   — configure EmailJS credentials and per-office receptionist email
 *
 * Props:
 *   sb              — Supabase client instance (passed from CheckInPage)
 *   offices         — current offices map (from CheckInPage state)
 *   activeName      — currently selected office name (from CheckInPage state)
 *   onOfficeChange  — callback when admin saves a new active office selection
 *   onOfficesChange — callback when admin adds/edits/removes offices
 *   onClose         — callback to unmount the modal from CheckInPage
 */

import { useState } from 'react';
import TabOffice from './TabOffice';
import TabOffices from './TabOffices';
import TabEmail from './TabEmail';

const TABS = ['office', 'offices', 'email'];
const TAB_LABELS = { office: '🏢 Office', offices: '📍 Offices', email: '✉️ Email' };

export default function AdminModal({ sb, offices, activeName, onOfficeChange, onOfficesChange, onClose }) {
  const [authed, setAuthed]   = useState(false);  // True once admin sign-in succeeds
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab]         = useState('office'); // Active tab within the authenticated view

  /**
   * checkAuth — signs in with Supabase and verifies the account has admin role.
   * Two-step check: valid credentials + admin role in user_profiles.
   * If the role check fails, we immediately sign out to avoid leaving an
   * authenticated session for a non-admin user.
   */
  async function checkAuth() {
    setErr(''); setLoading(true);

    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { setErr('Sign-in failed.'); setLoading(false); return; }

    // Verify the signed-in user has the 'admin' role — non-admins must not
    // access device settings even if they have valid portal credentials
    const { data: prof } = await sb.from('user_profiles').select('role').eq('id', data.user.id).single();
    if (!prof || prof.role !== 'admin') {
      await sb.auth.signOut(); // Clean up the session immediately
      setErr('Admin access required.');
      setLoading(false);
      return;
    }

    setLoading(false);
    setAuthed(true);
  }

  /**
   * handleClose — signs out of Supabase and resets all local state before
   * calling the parent's onClose. The sign-out is unconditional when authed
   * because this is a kiosk device — we must not leave an admin session alive.
   */
  async function handleClose() {
    if (authed) await sb.auth.signOut();
    setAuthed(false); setEmail(''); setPw(''); setErr('');
    onClose();
  }

  return (
    // Clicking the dark overlay behind the modal also closes it
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div><h3>Device Settings</h3><p>Configure this reception terminal</p></div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          {!authed ? (
            // Sign-in form — shown before authentication
            <>
              <div className="modal-field">
                <label>Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkAuth()}
                  placeholder="admin@srm.com"
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label>Password</label>
                <input
                  type="password"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkAuth()}
                  placeholder="Your password"
                />
              </div>
              {err && <div className="modal-error">{err}</div>}
              <button className="modal-btn" onClick={checkAuth} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </>
          ) : (
            // Tab panel — shown after successful admin authentication
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
