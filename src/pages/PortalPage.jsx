import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAuthUser, loginUrl, logout } from '../lib/auth';
import { api } from '../lib/api';
import VisitorsPage from '../components/Portal/VisitorsPage';
import CarbonPage   from '../components/Portal/CarbonPage';
import UsersPage    from '../components/Portal/UsersPage';

export default function PortalPage() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading
  const [profile,  setProfile]  = useState(null);
  const [page,     setPage]     = useState('visitors');
  const [authErr,  setAuthErr]  = useState('');

  useEffect(() => {
    async function init() {
      const user = await getAuthUser();
      setAuthUser(user);
      if (!user) return;

      try {
        const prof = await api.profile();
        setProfile(prof);
      } catch (e) {
        setAuthErr(e.status === 403
          ? 'No portal access. Ask your admin to add your account.'
          : 'Failed to load your profile. Please try again.');
        await logout();
      }
    }
    init();
  }, []);

  // Loading
  if (authUser === undefined) {
    return (
      <div className="portal-page">
        <TopBar />
        <div className="loading-state" style={{ marginTop: 60 }}>Loading…</div>
      </div>
    );
  }

  // Not signed in
  if (!authUser) {
    return (
      <div className="portal-page">
        <TopBar />
        <div className="portal-login-wrap">
          <h2>Staff Sign In</h2>
          <p>Use your SRM Microsoft account to access the portal</p>
          <div className="portal-login-card">
            {authErr && <div className="alert alert-error">{authErr}</div>}
            <a className="modal-btn" href={loginUrl('/portal')} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Sign in with Microsoft
            </a>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, textAlign: 'center' }}>
              You must have an SRM Microsoft account and have been granted portal access by an admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { role, office_name: office } = profile;

  return (
    <div className="portal-page">
      <div className="portal-topbar">
        <div className="portal-brand">
          <img src="/srm-logo.png" alt="Sir Robert McAlpine" className="srm-logo-topbar" />
          Staff Portal
          <span className={`role-pill role-${role}`} style={{ fontSize: 11, marginLeft: 4 }}>{role}</span>
        </div>
        <div className="portal-topbar-right">
          <span className="portal-user-email">{authUser.userDetails}</span>
          {office && <span style={{ fontSize: 12, color: 'var(--sage)' }}>— {office}</span>}
          <button className="portal-signout" onClick={logout}>Sign Out</button>
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
          {page === 'visitors' && <VisitorsPage role={role} office={office} />}
          {page === 'carbon'   && <CarbonPage   office={office} />}
          {page === 'users'    && <UsersPage />}
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="portal-topbar">
      <div className="portal-brand">
        <img src="/srm-logo.png" alt="Sir Robert McAlpine" className="srm-logo-topbar" />
        Staff Portal
      </div>
      <div className="portal-topbar-right">
        <Link to="/" className="portal-back">← Check-in Form</Link>
      </div>
    </div>
  );
}
