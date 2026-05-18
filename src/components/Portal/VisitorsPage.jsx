import { useState, useEffect } from 'react';

const TODAY = new Date().toISOString().split('T')[0];
const MONTH_START = TODAY.slice(0, 7) + '-01';

function co2Class(v) {
  return !v ? '' : v < 1 ? 'co2-low' : v < 5 ? 'co2-med' : 'co2-high';
}

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
      {!isRecp && <>
        <td>{r.transport_mode || '—'}</td>
        <td>{r.distance_km ? r.distance_km + 'km' : '—'}</td>
        <td>{r.co2_kg ? <span className={`co2-pill ${co2Class(r.co2_kg)}`}>{parseFloat(r.co2_kg).toFixed(2)}kg</span> : '—'}</td>
      </>}
      {isAdmin && <td>{r.office_name}</td>}
    </tr>
  ));
}

export default function VisitorsPage({ sb, role, office }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(MONTH_START);
  const [to, setTo]   = useState(TODAY);
  const isRecp  = role === 'receptionist';
  const isAdmin = role === 'admin';

  useEffect(() => { load(); }, []);

  async function load(dateFrom, dateTo) {
    setLoading(true);
    let q = sb.from('visitor_logs').select('*').order('created_at', { ascending: false });
    if (isRecp) q = q.eq('visit_date', TODAY);
    if (dateFrom) q = q.gte('visit_date', dateFrom);
    if (dateTo)   q = q.lte('visit_date', dateTo);
    const { data, error } = await q;
    if (!error) setRows(data || []);
    setLoading(false);
  }

  function applyFilter() { load(from, to); }

  function exportCsv() {
    if (!rows.length) return;
    const cols = ['Date','Time','Visitor','Company','Host','Purpose','Office','Transport','Distance (km)','CO2 (kg)'];
    const lines = [cols.join(','), ...rows.map(r => [
      r.visit_date, r.arrival_time, `"${r.visitor_name}"`, `"${r.company||''}"`,
      `"${r.host}"`, r.purpose||'', r.office_name, r.transport_mode||'',
      r.distance_km||'', r.co2_kg||''
    ].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `srm-visitors-${TODAY}.csv`;
    a.click();
  }

  const todayCount = rows.filter(r => r.visit_date === TODAY).length;
  const monthCount = rows.filter(r => r.visit_date?.startsWith(TODAY.slice(0, 7))).length;
  const co2s = rows.map(r => r.co2_kg).filter(Boolean);
  const avgCo2 = co2s.length ? (co2s.reduce((a, b) => a + b, 0) / co2s.length).toFixed(2) : '—';
  const totCo2 = co2s.length ? co2s.reduce((a, b) => a + b, 0).toFixed(2) : '—';

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

      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Today</div><div className="stat-value">{todayCount}</div><div className="stat-sub">check-ins</div></div>
        <div className="stat-card"><div className="stat-label">This Month</div><div className="stat-value">{monthCount}</div><div className="stat-sub">visitors</div></div>
        {!isRecp && <>
          <div className="stat-card"><div className="stat-label">Avg CO₂</div><div className="stat-value">{avgCo2}</div><div className="stat-sub">kg per visit</div></div>
          <div className="stat-card"><div className="stat-label">Total CO₂ MTD</div><div className="stat-value">{totCo2}</div><div className="stat-sub">kg CO₂e</div></div>
        </>}
      </div>

      <div className="access-badge">{badge}</div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-title">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
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
              {loading ? <tr><td colSpan={10} className="loading-state">Loading…</td></tr> : buildRows(rows, isRecp, isAdmin)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
