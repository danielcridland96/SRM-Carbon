import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createSupabaseClient } from '../lib/supabase';
import VisitorsPage from '../components/Portal/VisitorsPage';
import CarbonPage from '../components/Portal/CarbonPage';
import UsersPage from '../components/Portal/UsersPage';

export default function PortalPage() {
  const [sb]     = useState(createSupabaseClient);
  const [user, setUser]   = useState(null);
  const [role, setRole]   = useState(null);
  const [office, setOffice] = useState(null);
  const [page, setPage]   = useState('visitors');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) { loadProfile(session.user); }
    });
  }, []);

  async function loadProfile(u) {
    const { data: prof, error } = await sb.from('user_profiles').select('*').eq('id', u.id).single();
    if (error || !prof) { await sb.auth.signOut(); return; }
    setUser(u); setRole(prof.role); setOffice(prof.office_name);
  }

  async function login() {
    setLoginErr(''); setSigningIn(true);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setSigningIn(false);
    if (error) { setLoginErr('Sign-in failed. Check your email and password.'); return; }
    await loadProfile(data.user);
  }

  async function signOut() {
    await sb.auth.signOut();
    setUser(null); setRole(null); setOffice(null);
    setEmail(''); setPass(''); setLoginErr('');
  }

  if (!sb) {
    return (
      <div className="portal-page">
        <div className="portal-topbar">
          <div className="portal-brand">SRM Staff Portal</div>
          <div className="portal-topbar-right">
            <Link to="/" className="portal-back">← Check-in Form</Link>
          </div>
        </div>
        <div className="no-db">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗄️</div>
          <h3>Database not configured</h3>
          <p>Open the check-in form, tap ⚙️ Device Settings, go to the Database tab, and enter your Supabase URL and Anon Key.</p>
          <Link to="/" className="portal-back" style={{ background: 'var(--forest)', borderRadius: 10, padding: '12px 24px', fontSize: 14, display: 'inline-flex' }}>← Go to Check-in Form</Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="portal-page">
        <div className="portal-topbar">
          <div className="portal-brand">SRM Staff Portal</div>
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
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@srm.com" onKeyDown={e => e.key === 'Enter' && login()} />
            </div>
            <div className="modal-field">
              <label>Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Your password" onKeyDown={e => e.key === 'Enter' && login()} />
            </div>
            {loginErr && <div className="modal-error" style={{ display: 'block' }}>{loginErr}</div>}
            <button className="modal-btn" onClick={login} disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign In'}</button>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, textAlign: 'center' }}>Staff accounts are created by your system admin in the portal.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-topbar">
        <div className="portal-brand">
          SRM Staff Portal
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
        <nav className="portal-sidebar">
          <div className="sidebar-section">Dashboard</div>
          <button className={`nav-item${page === 'visitors' ? ' active' : ''}`} onClick={() => setPage('visitors')}>
            <span className="nav-icon">📋</span> Visitors
          </button>
          {(role === 'manager' || role === 'admin') && (
            <button className={`nav-item${page === 'carbon' ? ' active' : ''}`} onClick={() => setPage('carbon')}>
              <span className="nav-icon">🌍</span> Carbon Report
            </button>
          )}
          {role === 'admin' && (
            <button className={`nav-item${page === 'users' ? ' active' : ''}`} onClick={() => setPage('users')}>
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

        <div className="portal-content">
          {page === 'visitors' && <VisitorsPage sb={sb} role={role} office={office} />}
          {page === 'carbon'   && <CarbonPage   sb={sb} office={office} />}
          {page === 'users'    && <UsersPage     sb={sb} />}
        </div>
      </div>
    </div>
  );
}
