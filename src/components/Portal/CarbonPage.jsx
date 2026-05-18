/**
 * CarbonPage — carbon emissions report for managers and admins in the staff portal.
 *
 * Displays aggregate CO₂ data from all visitor check-ins, broken down by:
 *   1. Office — total CO₂ emitted by visitors to each office, shown as a bar chart
 *   2. Transport mode — visit count per transport type, shown as a bar chart
 *
 * Access: managers (own office data via RLS) and admins (all offices).
 * The `office` prop is not used for filtering here — Supabase RLS handles
 * the data scoping server-side based on the authenticated user's profile.
 *
 * The tree offset stat uses a figure of ~21 kg CO₂ absorbed per tree per year,
 * which is a commonly cited average for a mature broadleaf tree in the UK.
 * This is approximate and shown for illustrative purposes only.
 *
 * Bar chart widths are calculated relative to the maximum value in each dataset,
 * using inline styles with percentage widths. No charting library is used —
 * the bars are plain divs styled via CSS.
 *
 * Props:
 *   sb     — Supabase client instance
 *   office — user's assigned office (unused here — RLS handles scoping)
 */

import { useState, useEffect } from 'react';

export default function CarbonPage({ sb, office }) {
  const [data, setData] = useState(null); // null = loading, object = loaded

  useEffect(() => {
    // Fetch the columns needed for aggregation only (not the full row)
    sb.from('visitor_logs')
      .select('office_name,transport_mode,co2_kg,visit_date')
      .then(({ data: rows }) => {
        const total  = rows?.length || 0;
        const co2All = (rows || []).reduce((a, r) => a + (r.co2_kg || 0), 0);

        // Aggregate CO₂ and visit count per office
        const byOff = {};
        (rows || []).forEach(r => {
          const k = r.office_name || 'Unknown';
          if (!byOff[k]) byOff[k] = { total: 0, count: 0 };
          byOff[k].total += (r.co2_kg || 0);
          byOff[k].count++;
        });

        // Count visits per transport mode
        const byMode = {};
        (rows || []).forEach(r => {
          const m = r.transport_mode || 'Unknown';
          byMode[m] = (byMode[m] || 0) + 1;
        });

        setData({ total, co2All, byOff, byMode });
      });
  }, []);

  if (!data) return <div className="loading-state">Building report…</div>;

  const { total, co2All, byOff, byMode } = data;

  // Bar width is relative to the highest-emitting office; minimum of 1 avoids divide-by-zero
  const maxOff = Math.max(...Object.values(byOff).map(o => o.total), 1);

  return (
    <>
      <div className="page-header">
        <h2>Carbon Report</h2>
        <p>Travel emissions from visitor check-ins{office ? ` for ${office}` : ''}</p>
      </div>

      {/* Summary stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total CO₂ All Time</div>
          <div className="stat-value">{co2All.toFixed(1)}</div>
          <div className="stat-sub">kg CO₂e</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Visits</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">with travel data</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg CO₂/Visit</div>
          <div className="stat-value">{total ? (co2All / total).toFixed(2) : '—'}</div>
          <div className="stat-sub">kg CO₂e</div>
        </div>
        <div className="stat-card">
          {/* ~21 kg CO₂/tree/year is an approximate UK average for a mature tree */}
          <div className="stat-label">Equivalent Trees</div>
          <div className="stat-value">{(co2All / 21).toFixed(0)}</div>
          <div className="stat-sub">to offset (21kg/tree/yr)</div>
        </div>
      </div>

      {/* CO₂ by office bar chart — sorted highest to lowest */}
      <div className="table-wrap" style={{ padding: '20px 24px 24px' }}>
        <div className="table-title" style={{ marginBottom: 16 }}>CO₂ by Office</div>
        {Object.entries(byOff).sort((a, b) => b[1].total - a[1].total).map(([o, d]) => (
          <div className="report-row" key={o}>
            <span className="report-label">{o}</span>
            <div className="report-track">
              <div className="report-fill" style={{ width: `${(d.total / maxOff * 100).toFixed(0)}%` }} />
            </div>
            <span className="report-val">{d.total.toFixed(1)} kg · {d.count} visits</span>
          </div>
        ))}
        {!Object.keys(byOff).length && <div className="empty-state">No data yet.</div>}
      </div>

      {/* Transport mode breakdown bar chart — sorted by visit count */}
      <div className="table-wrap" style={{ padding: '20px 24px 24px' }}>
        <div className="table-title" style={{ marginBottom: 16 }}>Transport Mode Breakdown</div>
        {Object.entries(byMode).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
          <div className="report-row" key={m}>
            <span className="report-label">{m}</span>
            <div className="report-track">
              {/* Bar width is the percentage of total visits for this mode */}
              <div className="report-fill" style={{ width: `${(n / Math.max(total, 1) * 100).toFixed(0)}%` }} />
            </div>
            <span className="report-val">{n} visits ({(n / Math.max(total, 1) * 100).toFixed(0)}%)</span>
          </div>
        ))}
        {!Object.keys(byMode).length && <div className="empty-state">No data yet.</div>}
      </div>
    </>
  );
}
