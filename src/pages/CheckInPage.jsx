/**
 * CheckInPage — the main visitor check-in form (route: "/").
 *
 * This is the primary kiosk-facing screen. Visitors see this page on arrival
 * and fill in their details to log their visit and record their travel carbon footprint.
 *
 * Form fields:
 *   - Full Name (required)
 *   - Company / Organisation (optional)
 *   - Host — who they are visiting (required)
 *   - Purpose of Visit (optional dropdown)
 *   - Date of Visit (defaults to today)
 *   - Arrival Time (defaults to current time)
 *   - Departure Postcode (required — used for carbon calculation)
 *   - Mode of Transport (required — radio grid)
 *
 * Carbon calculation:
 * The carbon estimate is computed in real time as the visitor types their
 * postcode and selects a transport mode. A 600ms debounce avoids making an
 * API request on every keystroke. The flow is:
 *   1. getLatLng(fromPostcode) — calls postcodes.io for visitor's origin coords
 *   2. getLatLng(office.postcode) — calls postcodes.io for office destination coords
 *   3. haversineKm(a, b) — straight-line distance between the two points
 *   4. distanceKm × EMISSION_FACTORS[mode].factor — CO₂ in kg
 *
 * On submit:
 *   1. Validate required fields
 *   2. Write a row to Supabase visitor_logs
 *   3. Send check-in notification email via EmailJS (if configured)
 *   4. Show the success screen with a summary
 *
 * The ⚙️ button (admin-trigger) opens the AdminModal for device configuration.
 * The "Staff Portal" link navigates to /portal.
 *
 * Carbon calculation is memoised with useCallback so it doesn't recreate
 * when unrelated state changes — only when the office postcode changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import OfficeBanner from '../components/CheckIn/OfficeBanner';
import TransportGrid from '../components/CheckIn/TransportGrid';
import CarbonResult from '../components/CheckIn/CarbonResult';
import AdminModal from '../components/AdminModal/AdminModal';
import { loadOffices, loadActiveOfficeName } from '../lib/offices';
import { EMISSION_FACTORS, getLatLng, haversineKm, validUKPostcode } from '../lib/carbon';
import { createSupabaseClient } from '../lib/supabase';
import { sendCheckinEmail } from '../lib/email';

// Computed once when the module loads — remains constant for the lifetime of the page
const TODAY = new Date().toISOString().split('T')[0];
const now = new Date();
const NOW_TIME = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

export default function CheckInPage() {
  // Office state — loaded from localStorage on mount
  const [offices, setOffices]       = useState(loadOffices);         // Full offices map
  const [officeName, setOfficeName] = useState(loadActiveOfficeName); // Currently active office key

  // Supabase client — created once from env vars (or localStorage fallback)
  const [sb, setSb] = useState(createSupabaseClient);

  // Modal and submission state
  const [showAdmin, setShowAdmin] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [summary, setSummary]     = useState(null);  // Holds data for the success screen
  const [errors, setErrors]       = useState({});    // Field-level validation errors

  // Form field state
  const [visitorName, setVisitorName]   = useState('');
  const [company, setCompany]           = useState('');
  const [host, setHost]                 = useState('');
  const [purpose, setPurpose]           = useState('');
  const [visitDate, setVisitDate]       = useState(TODAY);
  const [arrivalTime, setArrivalTime]   = useState(NOW_TIME);
  const [fromPostcode, setFromPostcode] = useState('');
  const [transport, setTransport]       = useState('');

  // Carbon calculation result — null until both postcode and transport are set and
  // the postcodes.io lookup has resolved
  const [carbon, setCarbon] = useState(null); // { co2: number, distanceKm: number }

  // Countdown state for the success screen auto-reset (15 → 0 then calls reset)
  const [countdown, setCountdown] = useState(15);

  // Debounce timer ref for postcode lookups — avoids an API call per keystroke
  const calcTimer = useRef(null);

  // Derive the active office object — fall back to London if the stored name is stale
  const office = offices[officeName] || offices['London'];

  /**
   * calcCarbon — looks up coordinates for both postcodes and computes CO₂.
   * Wrapped in useCallback so the function reference is stable and the
   * useEffect below doesn't re-register on every render.
   *
   * Skips early if either postcode or mode is missing, or the postcode is
   * too short to be valid (< 5 chars). The 600ms debounce prevents API spam
   * while the user is still typing their postcode.
   */
  const calcCarbon = useCallback(async (postcode, mode) => {
    if (!postcode || !mode || postcode.length < 5) { setCarbon(null); return; }
    if (calcTimer.current) clearTimeout(calcTimer.current);

    calcTimer.current = setTimeout(async () => {
      // Resolve both postcodes in parallel for efficiency
      const [a, b] = await Promise.all([getLatLng(postcode), getLatLng(office.postcode)]);
      if (!a || !b) { setCarbon(null); return; }

      const distanceKm = haversineKm(a, b);
      const co2        = distanceKm * EMISSION_FACTORS[mode].factor;
      setCarbon({ co2, distanceKm });
    }, 600);
  }, [office.postcode]); // Re-creates only when the active office changes

  // Trigger carbon recalculation whenever postcode, transport, or the active office changes
  useEffect(() => { calcCarbon(fromPostcode, transport); }, [fromPostcode, transport, calcCarbon]);

  // Auto-reset after 15 seconds on the success screen
  useEffect(() => {
    if (!submitted) { setCountdown(15); return; }
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); reset(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * validate — checks required fields and returns an errors object.
   * The form won't submit if this returns any keys.
   */
  function validate() {
    const errs = {};
    if (!visitorName.trim()) errs.name      = 'Please enter your name';
    if (!host.trim())        errs.host      = 'Please enter your host\'s name';
    if (!validUKPostcode(fromPostcode)) errs.postcode = 'Enter a valid UK postcode';
    if (!transport)          errs.transport = 'Please select a transport mode';
    return errs;
  }

  /**
   * submit — validates, writes to Supabase, sends email, and shows success screen.
   *
   * The Supabase insert uses the anon role — this is permitted by the RLS policy
   * `visitor_logs_anon_insert` which allows anonymous inserts without authentication.
   * The anon key is safe to expose in the client (all security is enforced by RLS).
   *
   * EmailJS fields use pre-formatted strings (toFixed) because the email template
   * displays them directly without further processing.
   *
   * If the Supabase insert fails (network error, RLS rejection), the error is
   * silently swallowed in production so the visitor isn't shown a confusing
   * database error. The email is still attempted.
   */
  async function submit() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);

    const rec = {
      visitor_name:   visitorName.trim(),
      company:        company.trim() || null,   // null stored as NULL in DB
      host:           host.trim(),
      purpose:        purpose || null,
      visit_date:     visitDate,
      arrival_time:   arrivalTime,
      office_name:    officeName,
      from_postcode:  fromPostcode.toUpperCase(),
      transport_mode: EMISSION_FACTORS[transport].label, // Store human label, not key
      distance_km:    carbon?.distanceKm ?? null,
      co2_kg:         carbon?.co2 ?? null,
    };

    // Write to database — errors are suppressed in production (dev only logging)
    if (sb) {
      try {
        await sb.from('visitor_logs').insert(rec);
      } catch (e) {
        if (import.meta.env.DEV) console.error('DB:', e);
      }
    }

    // Send reception notification email with display-formatted values
    await sendCheckinEmail({
      ...rec,
      distance_km: rec.distance_km?.toFixed(1),
      co2_kg:      rec.co2_kg?.toFixed(3),
    }, officeName);

    // Populate the success screen summary
    setSummary({
      name:   visitorName.trim(),
      office: officeName,
      co2:    carbon?.co2 ?? 0,
      dist:   carbon?.distanceKm ?? 0,
      label:  EMISSION_FACTORS[transport].label,
    });
    setLoading(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * reset — clears all form state to allow logging another visitor.
   * Called from the "Log another visitor" button on the success screen.
   */
  function reset() {
    setVisitorName(''); setCompany(''); setHost(''); setPurpose('');
    setVisitDate(TODAY); setArrivalTime(NOW_TIME);
    setFromPostcode(''); setTransport(''); setCarbon(null);
    setErrors({}); setSubmitted(false); setSummary(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page-wrapper">
      {/* Header section */}
      <div className="header">
        <div className="logo-badge"><span className="dot" />Visitor Check-In</div>
        <h1>Welcome. <em>Let&apos;s log</em><br />your journey.</h1>
        <p className="subtitle">
          Please complete this form on arrival. We track travel carbon<br />
          footprints as part of our sustainability commitment.
        </p>
      </div>

      {/* Displays which office the visitor is checking in to */}
      <OfficeBanner name={officeName} address={office.address} postcode={office.postcode} />

      {submitted && summary ? (
        // Success screen — shown after a successful submission
        <div className="success-screen">
          <div className="success-icon">✓</div>
          <h2>You&apos;re checked in!</h2>
          <p>Your visit has been logged securely and the reception team has been notified.</p>
          <div>
            <span className="summary-chip">👤 {summary.name}</span>
            <span className="summary-chip">🏢 {summary.office}</span>
            <span className="summary-chip">🌍 {summary.co2.toFixed(2)} kg CO₂e</span>
            <span className="summary-chip">{summary.dist.toFixed(1)} km · {summary.label}</span>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, opacity: 0.55 }}>
            Returning to the form in {countdown}s…
          </p>
          <button className="new-entry-btn" onClick={reset}>← Log another visitor</button>
        </div>
      ) : (
        // Main check-in form
        <div className="card">
          {/* Visitor details section */}
          <div className="section-label">👤 Visitor Details</div>
          <div className="field-grid">
            <div className={`field${errors.name ? ' has-error' : ''}`}>
              <label>Full Name *</label>
              <input value={visitorName} onChange={e => setVisitorName(e.target.value)} placeholder="Jane Smith" />
              {errors.name && <span className="error-msg">{errors.name}</span>}
            </div>
            <div className="field">
              <label>Company / Organisation</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Ltd" />
            </div>
            <div className={`field${errors.host ? ' has-error' : ''}`}>
              <label>Host / Who are you visiting? *</label>
              <input value={host} onChange={e => setHost(e.target.value)} placeholder="John Doe" />
              {errors.host && <span className="error-msg">{errors.host}</span>}
            </div>
            <div className="field">
              <label>Purpose of Visit</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)}>
                <option value="">Select…</option>
                {['Meeting', 'Interview', 'Delivery', 'Training', 'Event', 'Other'].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date of Visit</label>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Arrival Time</label>
              <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} />
            </div>
          </div>

          <br />

          {/* Journey details section */}
          <div className="section-label">🌍 Journey Details</div>
          <div className={`field${errors.postcode ? ' has-error' : ''}`}>
            <label>Your Departure Postcode *</label>
            <input
              value={fromPostcode}
              // Strip non-alphanumeric (except space) and force uppercase on every keystroke
              onChange={e => setFromPostcode(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''))}
              placeholder="SW1A 1AA"
              maxLength={8}
              style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 17, letterSpacing: '.05em' }}
            />
            <span className="hint">Your home or usual departure postcode</span>
            {errors.postcode && <span className="error-msg">{errors.postcode}</span>}
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label>Mode of Transport *</label>
            <TransportGrid value={transport} onChange={setTransport} />
            {errors.transport && <span className="error-msg">{errors.transport}</span>}
          </div>

          {/* CarbonResult appears once both postcode and transport are selected and resolved */}
          {carbon && transport && (
            <CarbonResult
              co2={carbon.co2}
              distanceKm={carbon.distanceKm}
              transportLabel={EMISSION_FACTORS[transport].label}
            />
          )}

          {/* Submit area */}
          <div className="submit-area">
            <p className="gdpr-note">
              🔒 Data stored securely in Supabase with RBAC controls, processed in accordance with GDPR.
              Retained for 12 months.
            </p>
            <button className="submit-btn" onClick={submit} disabled={loading}>
              <span>{loading ? 'Logging visit…' : 'Check In'}</span>
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Admin device settings button — bottom-right corner, subtle positioning */}
      <button className="admin-trigger" onClick={() => setShowAdmin(true)} title="Device settings">⚙️</button>

      {/* Staff portal link — bottom-left, also subtle */}
      <Link to="/portal" className="portal-trigger">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Staff Portal
      </Link>

      {/* Admin modal — mounted only when open to avoid persistent auth state */}
      {showAdmin && (
        <AdminModal
          sb={sb}
          offices={offices}
          activeName={officeName}
          onOfficeChange={name => {
            setOfficeName(name);
            setCarbon(null); // Clear stale carbon result when office changes
          }}
          onOfficesChange={updated => setOffices(updated)}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
