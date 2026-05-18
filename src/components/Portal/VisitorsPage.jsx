/**
 * VisitorsPage — visitor log table for the staff portal.
 *
 * Displays check-in records from the visitor_logs Supabase table. Data shown
 * and filtering options differ by role to enforce the principle of least privilege:
 *
 *   receptionist — today's check-ins only, own office, basic columns (no carbon data)
 *   manager      — all dates with date-range filter, own office, all columns + CSV export
 *   admin        — all dates, all offices, all columns + office column + CSV export
 *
 * Row Level Security (RLS) in Supabase is the primary access control mechanism.
 * The client-side office filter (`q.eq('office_name', office)`) is an additional
 * defence-in-depth layer — both must independently restrict data appropriately.
 *
 * Date filtering:
 * A date-range filter is available for managers and admins. The default range
 * is the start of the current month to today. The filter is only applied when
 * the "Filter" button is clicked, not on every date input change.
 *
 * CSV export:
 * All cell values are sanitised against spreadsheet formula injection before
 * being written to the CSV. Values starting with =, +, -, @, tab, or CR
 * are prefixed with a single quote to prevent Excel/Sheets from interpreting
 * them as formulas.
 *
 * Summary statistics above the table are computed client-side from the
 * currently loaded rows (not separate API calls).
 *
 * Props:
 *   sb     — Supabase client instance
 *   role   — authenticated user's role: 'receptionist' | 'manager' | 'admin'
 *   office — user's assigned office name (null for admin = all offices)
 */

import { useState, useEffect } from 'react';

const TODAY = new Date().toISOString().split('T')[0];
const MONTH_START = TODAY.slice(0, 7) + '-01'; // First day of current month

/**
 * co2Class — maps a CO₂ value to a CSS class for colour-coding the badge.
 *   co2-low  → green  (< 1 kg)
 *   co2-med  → amber  (1–5 kg)
 *   co2-high → red    (> 5 kg)
 */
function co2Class(v) {
  return !v ? '' : v < 1 ? 'co2-low' : v < 5 ? 'co2-med' : 'co2-high';
}

/**
 * buildRows — renders table row elements for the visitor log.
 * Conditionally shows/hides columns based on role:
 *   - Carbon columns (transport, distance, CO₂) are hidden for receptionists
 *   - The office column is only shown for admins (who see all offices)
 */
function buildRows(rows, isRecp, isAdmin) {
  if (!rows.length) return <tr><td colSpan={10} className="empty-state">No records found.</td></tr>;
  return rows.map(r => (
    <tr key={r.id}>
      <td>{r.visit_date || '—'}</td>
      <td>{r.arrival_time || '—'}</td>
      <td><strong>{r.visitor_name}</strong></td>
      <td>{r.company || '—'}</td>
      <td>{r.host}</td>
      <td>{r.purpose || '—'}</td>
      {/* Receptionists only need to know who's arriving — not carbon data */}
      {!isRecp && <>
        <td>{r.transport_mode || '—'}</td>
        <td>{r.distance_km ? r.distance_km + 'km' : '—'}</td>
        <td>
          {r.co2_kg
            ? <span className={`co2-pill ${co2Class(r.co2_kg)}`}>{parseFloat(r.co2_kg).toFixed(2)}kg</span>
            : '—'}
        </td>
      </>}
      {/* Only admins see the office column since they're viewing all offices */}
      {isAdmin && <td>{r.office_name}</td>}
    </tr>
  ));
}

export default function VisitorsPage({ sb, role, office }) {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]     = useState(MONTH_START);
  const [to, setTo]         = useState(TODAY);

  const isRecp  = role === 'receptionist';
  const isAdmin = role === 'admin';

  // Load with no date filter on initial mount — filters are applied via the button
  useEffect(() => { load(); }, []);

  /**
   * load — fetches visitor_logs from Supabase with role-appropriate filters.
   *
   * The query is built up conditionally:
   * 1. Receptionists: fixed to today's date only (no date-range filter shown in UI)
   * 2. Non-admins with an assigned office: filter to that office
   *    (defence-in-depth alongside RLS — Supabase RLS also enforces this)
   * 3. Date range: only applied when explicitly passed (i.e. when Filter is clicked)
   *
   * Results are ordered newest-first (created_at DESC).
   */
  async function load(dateFrom, dateTo) {
    setLoading(true);
    let q = sb.from('visitor_logs').select('*').order('created_at', { ascending: false });

    if (isRecp) q = q.eq('visit_date', TODAY); // Receptionists see today only

    // Client-side office scoping — Supabase RLS provides the same restriction
    // server-side, so this is a redundant safety layer
    if (!isAdmin && office) q = q.eq('office_name', office);

    if (dateFrom) q = q.gte('visit_date', dateFrom);
    if (dateTo)   q = q.lte('visit_date', dateTo);

    const { data, error } = await q;
    if (!error) setRows(data || []);
    setLoading(false);
  }

  /** applyFilter — triggers a filtered load using the current from/to state. */
  function applyFilter() { load(from, to); }

  /**
   * csvCell — sanitises a single value for safe inclusion in a CSV file.
   *
   * Prevents CSV formula injection (a.k.a. CSV injection): if a cell value
   * begins with =, +, -, @, tab, or carriage return, Excel and Google Sheets
   * will try to execute it as a formula. Prefixing with a single quote
   * prevents this while preserving the original text.
   *
   * All values are wrapped in double quotes, and any embedded double quotes
   * are escaped by doubling them (RFC 4180 standard).
   *
   * @param {*} value  Any raw value from a database row
   * @returns {string} Safely quoted and escaped CSV cell string
   */
  function csvCell(value) {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  /**
   * exportCsv — generates and triggers a CSV file download of the currently
   * loaded rows. Uses a Blob + object URL to avoid any server round-trip.
   * All 10 columns are included regardless of which columns are visible in the table.
   */
  function exportCsv() {
    if (!rows.length) return;
    const cols = ['Date', 'Time', 'Visitor', 'Company', 'Host', 'Purpose', 'Office', 'Transport', 'Distance (km)', 'CO2 (kg)'];
    const lines = [
      cols.join(','),
      ...rows.map(r => [
        csvCell(r.visit_date), csvCell(r.arrival_time), csvCell(r.visitor_name),
        csvCell(r.company),    csvCell(r.host),         csvCell(r.purpose),
        csvCell(r.office_name), csvCell(r.transport_mode),
        csvCell(r.distance_km), csvCell(r.co2_kg),
      ].join(',')),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `srm-visitors-${TODAY}.csv`;
    a.click();
  }

  // Summary statistics computed from currently loaded rows
  const todayCount = rows.filter(r => r.visit_date === TODAY).length;
  const monthCount = rows.filter(r => r.visit_date?.startsWith(TODAY.slice(0, 7))).length;
  const co2s       = rows.map(r => r.co2_kg).filter(Boolean);
  const avgCo2     = co2s.length ? (co2s.reduce((a, b) => a + b, 0) / co2s.length).toFixed(2) : '—';
  const totCo2     = co2s.length ? co2s.reduce((a, b) => a + b, 0).toFixed(2) : '—';

  // Access scope badge — reminds the user of which data they're seeing
  const badge = isRecp
    ? `👁 Today's check-ins · ${office || 'your office'} only`
    : role === 'manager'
      ? `👁 All dates · ${office || 'your office'}`
      : `👁 All dates · All offices`;

  return (
    <>
      <div className="page-header">
        <h2>Visitor Log</h2>
        <p>Check-in records{office ? ` for ${office}` : isAdmin ? ' across all offices' : ''}</p>
      </div>

      {/* Summary stat cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value">{todayCount}</div>
          <div className="stat-sub">check-ins</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value">{monthCount}</div>
          <div className="stat-sub">visitors</div>
        </div>
        {/* Carbon stats hidden for receptionists who don't have access to that data */}
        {!isRecp && <>
          <div className="stat-card">
            <div className="stat-label">Avg CO₂</div>
            <div className="stat-value">{avgCo2}</div>
            <div className="stat-sub">kg per visit</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total CO₂ MTD</div>
            <div className="stat-value">{totCo2}</div>
            <div className="stat-sub">kg CO₂e</div>
          </div>
        </>}
      </div>

      <div className="access-badge">{badge}</div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-title">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
          {/* Date filter and CSV export — managers and admins only */}
          {!isRecp && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="tbl-filter" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>to</span>
              <input className="tbl-filter" type="date" value={to} onChange={e => setTo(e.target.value)} />
              <button className="export-btn" onClick={applyFilter}>Filter</button>
              <button className="export-btn" onClick={exportCsv}>⬇ CSV</button>
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Visitor</th><th>Company</th><th>Visiting</th><th>Purpose</th>
                {!isRecp && <><th>Transport</th><th>Distance</th><th>CO₂</th></>}
                {isAdmin && <th>Office</th>}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={10} className="loading-state">Loading…</td></tr>
                : buildRows(rows, isRecp, isAdmin)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
