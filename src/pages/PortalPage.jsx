/**
 * PortalPage — authenticated staff portal for managing visitor records (route: "/portal").
 *
 * This page handles its own authentication lifecycle:
 *   1. On mount: checks for an existing Supabase session (e.g. user refreshed the page)
 *   2. If no session: shows a sign-in form
 *   3. After sign-in: loads the user's profile from user_profiles to get role + office
 *   4. If profile missing: signs out and shows an error (prevents broken state)
 *   5. When authenticated: shows the role-appropriate portal navigation
 *
 * Role-based navigation:
 *   receptionist — Visitors tab only
 *   manager      — Visitors + Carbon Report
 *   admin        — Visitors + Carbon Report + Manage Users
 *
 * Error message strategy:
 * Sign-in errors use a generic message ("Sign-in failed. Check your email and password.")
 * rather than echoing the Supabase error, which could reveal whether an email address
 * exists in the system (user enumeration). Raw errors are only logged in DEV mode.
 *
 * If Supabase is not configured (sb === null), the page shows a "Database not configured"
 * screen directing the admin to use Device Settings on the check-in form.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createSupabaseClient } from '../lib/supabase';
import VisitorsPage from '../components/Portal/VisitorsPage';
import CarbonPage   from '../components/Portal/CarbonPage';
import UsersPage    from '../components/Portal/UsersPage';

export default function PortalPage() {
  // Supabase client — created once on mount, null if credentials are missing
  const [sb] = useState(createSupabaseClient);

  // Authenticated user state
  const [user, setUser]     = useState(null);   // Supabase auth user object
  const [role, setRole]     = useState(null);   // 'receptionist' | 'manager' | 'admin'
  const [office, setOffice] = useState(null);   // Assigned office name, or null for admins

  // Portal navigation
  const [page, setPage] = useState('visitors'); // Active section

  // Sign-in form state
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!sb) return;
    // Restore session on page load/refresh — avoids requiring sign-in every time
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) { loadProfile(session.user); }
    });
  }, []);

  /**
   * loadProfile — fetches the user_profiles row for a given auth user.
   * Extracts role and office_name and stores them in state.
   * If no profile row exists (e.g. user was created in Supabase Auth but
   * the user_profiles insert failed), signs out and shows an error.
   * This prevents a broken partial-auth state.
   *
   * @param {object} u  Supabase auth user object
   */
  async function loadProfile(u) {
    const { data: prof, error } = await sb
      .from('user_profiles')
      .select('*')
      .eq('id', u.id)
      .single();

    // Only log the raw error in dev mode (avoids info leakage in production)
    if (import.meta.env.DEV && error) console.error('Profile load:', error);

    if (error || !prof) {
      await sb.auth.signOut();
      setLoginErr('No staff profile found. Contact your admin.');
      return;
    }

    setUser(u);
    setRole(prof.role);
    setOffice(prof.office_name); // null for admins (they see all offices)
  }

  /**
   * login — attempts sign-in with Supabase email/password auth.
   * On success, loads the user profile. On failure, shows a generic error
   * (not the raw Supabase error) to prevent user enumeration.
   */
  async function login() {
    setLoginErr(''); setSigningIn(true);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setSigningIn(false);

    if (error) {
      // Generic message — don't echo Supabase's error which reveals whether
      // the email exists or just the password is wrong
      setLoginErr('Sign-in failed. Check your email and password.');
      return;
    }

    await loadProfile(data.user);
  }

  /**
   * signOut — clears the Supabase session and resets all local auth state.
   * Returns the user to the sign-in screen.
   */
  async function signOut() {
    await sb.auth.signOut();
    setUser(null); setRole(null); setOffice(null);
    setEmail(''); setPass(''); setLoginErr('');
  }

  // Screen 1: Supabase not configured
  if (!sb) {
    return (
      <div className="portal-page">
        <div className="portal-topbar">
          <div className="portal-brand">
            <img src="/srm-logo.png" alt="Sir Robert McAlpine" className="srm-logo-topbar" />
            Staff Portal
          </div>
          <div className="portal-topbar-right">
            <Link to="/" className="portal-back">← Check-in Form</Link>
          </div>
        </div>
        <div className="no-db">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗄️</div>
          <h3>Database not configured</h3>
          <p>Open the check-in form, tap ⚙️ Device Settings, go to the Database tab, and enter your Supabase URL and Anon Key.</p>
          <Link to="/" className="portal-back" style={{ background: 'var(--forest)', borderRadius: 10, padding: '12px 24px', fontSize: 14, display: 'inline-flex' }}>
            ← Go to Check-in Form
          </Link>
        </div>
      </div>
    );
  }

  // Screen 2: Not signed in — show login form
  if (!user) {
    return (
      <div className="portal-page">
        <div className="portal-topbar">
          <div className="portal-brand">
            <img src="/srm-logo.png" alt="Sir Robert McAlpine" className="srm-logo-topbar" />
            Staff Portal
          </div>
          <div className="portal-topbar-right">
            <Link to="/" className="portal-back">← Check-in Form</Link>
          </div>
        </div>
        <div className="portal-login-wrap">
          <h2>Staff Sign In</h2>
          <p>Access your role-based visitor dashboard</p>
          <div className="portal-login-card">
            <div className="modal-field">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@srm.com"
                onKeyDown={e => e.key === 'Enter' && login()}
              />
            </div>
            <div className="modal-field">
              <label>Password</label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Your password"
                onKeyDown={e => e.key === 'Enter' && login()}
              />
            </div>
            {loginErr && <div className="modal-error" style={{ display: 'block' }}>{loginErr}</div>}
            <button className="modal-btn" onClick={login} disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign In'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, textAlign: 'center' }}>
              Staff accounts are created by your system admin in the portal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Screen 3: Authenticated — show the portal with role-based navigation
  return (
    <div className="portal-page">
      <div className="portal-topbar">
        <div className="portal-brand">
          <img src="/srm-logo.png" alt="Sir Robert McAlpine" className="srm-logo-topbar" />
          Staff Portal
          {/* Role badge next to the brand name so the user knows their access level */}
          <span className={`role-pill role-${role}`} style={{ fontSize: 11, marginLeft: 4 }}>{role}</span>
        </div>
        <div className="portal-topbar-right">
          <span className="portal-user-email">{user.email}</span>
          {office && <span style={{ fontSize: 12, color: 'var(--sage)' }}>— {office}</span>}
          <button className="portal-signout" onClick={signOut}>Sign Out</button>
          <Link to="/" className="portal-back">← Check-in Form</Link>
        </div>
      </div>

      <div className="portal-main">
        {/* Sidebar navigation — items shown based on role */}
        <nav className="portal-sidebar">
          <div className="sidebar-section">Dashboard</div>

          {/* Visitors — available to all roles */}
          <button
            className={`nav-item${page === 'visitors' ? ' active' : ''}`}
            onClick={() => setPage('visitors')}
          >
            <span className="nav-icon">📋</span> Visitors
          </button>

          {/* Carbon Report — managers and admins only */}
          {(role === 'manager' || role === 'admin') && (
            <button
              className={`nav-item${page === 'carbon' ? ' active' : ''}`}
              onClick={() => setPage('carbon')}
            >
              <span className="nav-icon">🌍</span> Carbon Report
            </button>
          )}

          {/* Manage Users — admins only */}
          {role === 'admin' && (
            <button
              className={`nav-item${page === 'users' ? ' active' : ''}`}
              onClick={() => setPage('users')}
            >
              <span className="nav-icon">👥</span> Manage Users
            </button>
          )}

          <div className="sidebar-bottom">
            <Link to="/" className="back-link">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Visitor Check-in Form
            </Link>
          </div>
        </nav>

        {/* Main content area — renders the active page component */}
        <div className="portal-content">
          {page === 'visitors' && <VisitorsPage sb={sb} role={role} office={office} />}
          {page === 'carbon'   && <CarbonPage   sb={sb} office={office} />}
          {page === 'users'    && <UsersPage     sb={sb} />}
        </div>
      </div>
    </div>
  );
}
