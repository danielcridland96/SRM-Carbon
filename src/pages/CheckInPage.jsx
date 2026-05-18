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

const TODAY = new Date().toISOString().split('T')[0];
const now = new Date();
const NOW_TIME = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

export default function CheckInPage() {
  const [offices, setOffices]       = useState(loadOffices);
  const [officeName, setOfficeName] = useState(loadActiveOfficeName);
  const [sb, setSb]                 = useState(createSupabaseClient);
  const [showAdmin, setShowAdmin]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [summary, setSummary]       = useState(null);
  const [errors, setErrors]         = useState({});

  // Form fields
  const [visitorName, setVisitorName] = useState('');
  const [company, setCompany]         = useState('');
  const [host, setHost]               = useState('');
  const [purpose, setPurpose]         = useState('');
  const [visitDate, setVisitDate]     = useState(TODAY);
  const [arrivalTime, setArrivalTime] = useState(NOW_TIME);
  const [fromPostcode, setFromPostcode] = useState('');
  const [transport, setTransport]     = useState('');
  const [carbon, setCarbon]           = useState(null); // { co2, distanceKm }

  const calcTimer = useRef(null);
  const office = offices[officeName] || offices['London'];

  const calcCarbon = useCallback(async (postcode, mode) => {
    if (!postcode || !mode || postcode.length < 5) { setCarbon(null); return; }
    if (calcTimer.current) clearTimeout(calcTimer.current);
    calcTimer.current = setTimeout(async () => {
      const [a, b] = await Promise.all([getLatLng(postcode), getLatLng(office.postcode)]);
      if (!a || !b) { setCarbon(null); return; }
      const distanceKm = haversineKm(a, b);
      const co2 = distanceKm * EMISSION_FACTORS[mode].factor;
      setCarbon({ co2, distanceKm });
    }, 600);
  }, [office.postcode]);

  useEffect(() => { calcCarbon(fromPostcode, transport); }, [fromPostcode, transport, calcCarbon]);

  function validate() {
    const errs = {};
    if (!visitorName.trim()) errs.name = 'Please enter your name';
    if (!host.trim())        errs.host = 'Please enter your host\'s name';
    if (!validUKPostcode(fromPostcode)) errs.postcode = 'Enter a valid UK postcode';
    if (!transport)          errs.transport = 'Please select a transport mode';
    return errs;
  }

  async function submit() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    const rec = {
      visitor_name:   visitorName.trim(),
      company:        company.trim() || null,
      host:           host.trim(),
      purpose:        purpose || null,
      visit_date:     visitDate,
      arrival_time:   arrivalTime,
      office_name:    officeName,
      from_postcode:  fromPostcode.toUpperCase(),
      transport_mode: EMISSION_FACTORS[transport].label,
      distance_km:    carbon?.distanceKm ?? null,
      co2_kg:         carbon?.co2 ?? null,
    };

    if (sb) { try { await sb.from('visitor_logs').insert(rec); } catch (e) { if (import.meta.env.DEV) console.error('DB:', e); } }
    await sendCheckinEmail({
      ...rec,
      distance_km: rec.distance_km?.toFixed(1),
      co2_kg:      rec.co2_kg?.toFixed(3),
    }, officeName);

    setSummary({ name: visitorName.trim(), office: officeName, co2: carbon?.co2 ?? 0, dist: carbon?.distanceKm ?? 0, label: EMISSION_FACTORS[transport].label });
    setLoading(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setVisitorName(''); setCompany(''); setHost(''); setPurpose('');
    setVisitDate(TODAY); setArrivalTime(NOW_TIME);
    setFromPostcode(''); setTransport(''); setCarbon(null);
    setErrors({}); setSubmitted(false); setSummary(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page-wrapper">
      <div className="header">
        <div className="logo-badge"><span className="dot" />Visitor Check-In</div>
        <h1>Welcome. <em>Let&apos;s log</em><br />your journey.</h1>
        <p className="subtitle">Please complete this form on arrival. We track travel carbon<br />footprints as part of our sustainability commitment.</p>
      </div>

      <OfficeBanner name={officeName} address={office.address} postcode={office.postcode} />

      {submitted && summary ? (
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
          <button className="new-entry-btn" onClick={reset}>← Log another visitor</button>
        </div>
      ) : (
        <div className="card">
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
                {['Meeting','Interview','Delivery','Training','Event','Other'].map(o => <option key={o}>{o}</option>)}
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
          <div className="section-label">🌍 Journey Details</div>
          <div className={`field${errors.postcode ? ' has-error' : ''}`}>
            <label>Your Departure Postcode *</label>
            <input
              value={fromPostcode}
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

          {carbon && transport && (
            <CarbonResult
              co2={carbon.co2}
              distanceKm={carbon.distanceKm}
              transportLabel={EMISSION_FACTORS[transport].label}
            />
          )}

          <div className="submit-area">
            <p className="gdpr-note">🔒 Data stored securely in Supabase with RBAC controls, processed in accordance with GDPR. Retained for 12 months.</p>
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

      <button className="admin-trigger" onClick={() => setShowAdmin(true)} title="Device settings">⚙️</button>
      <Link to="/portal" className="portal-trigger">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="8" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Staff Portal
      </Link>

      {showAdmin && (
        <AdminModal
          sb={sb}
          offices={offices}
          activeName={officeName}
          onOfficeChange={name => { setOfficeName(name); setCarbon(null); }}
          onOfficesChange={updated => setOffices(updated)}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
