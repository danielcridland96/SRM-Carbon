/**
 * App.jsx — root component. Sets up client-side routing with React Router v7.
 *
 * Two routes:
 *   /        → CheckInPage  — public kiosk-facing visitor check-in form
 *   /portal  → PortalPage   — authenticated staff portal (login required)
 *
 * Netlify is configured (netlify.toml [[redirects]]) to serve index.html for
 * all paths so that React Router handles routing rather than Netlify returning
 * a 404 on direct URL access or page refresh.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CheckInPage from './pages/CheckInPage';
import PortalPage  from './pages/PortalPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"       element={<CheckInPage />} />
        <Route path="/portal" element={<PortalPage />} />
      </Routes>
    </BrowserRouter>
  );
}
