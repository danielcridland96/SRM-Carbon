import { useState, useEffect } from 'react';
import MapView from './MapView';

export default function CarbonPage({ sb, office }) {
  const [data, setData]     = useState(null);
  const [visits, setVisits] = useState([]);
  const [view, setView]     = useState('charts');

  useEffect(() => {
    sb.from('visitor_logs')
      .select('office_name,transport_mode,co2_kg,visit_date,from_postcode')
      .then(({ data: rows }) => {
        const r = rows || [];
        setVisits(r);

        const total  = r.length;
        const co2All = r.reduce((a, v) => a + (v.co2_kg || 0), 0);

        const byOff = {};
        r.forEach(v => {
          const k = v.office_name || 'Unknown';
          if (!byOff[k]) byOff[k] = { total: 0, count: 0 };
          byOff[k].total += v.co2_kg || 0;
          byOff[k].count++;
        });

        const byMode = {};
        r.forEach(v => {
          const m = v.transport_mode || 'Unknown';
          byMode[m] = (byMode[m] || 0) + 1;
        });

        setData({ total, co2All, byOff, byMode });
      });
  }, []);

  if (!data) return <div className="loading-state">Building report…</div>;

  const { total, co2All, byOff, byMode } = data;
  const maxOff = Math.max(...Object.values(byOff).map(o => o.total), 1);

  return (
    <>
      <div className="page-header">
        <h2>Carbon Report</h2>
        <p>Travel emissions from visitor check-ins{office ? ` for ${office}` : ''}</p>
      </div>

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
          <div className="stat-label">Equivalent Trees</div>
          <div className="stat-value">{(co2All / 21).toFixed(0)}</div>
          <div className="stat-sub">to offset (21kg/tree/yr)</div>
        </div>
      </div>

      <div className="view-tabs">
        <button className={`view-tab${view === 'charts' ? ' active' : ''}`} onClick={() => setView('charts')}>
          📊 Charts
        </button>
        <button className={`view-tab${view === 'map' ? ' active' : ''}`} onClick={() => setView('map')}>
          🗺 Map
        </button>
      </div>

      {view === 'charts' && (
        <>
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

          <div className="table-wrap" style={{ padding: '20px 24px 24px' }}>
            <div className="table-title" style={{ marginBottom: 16 }}>Transport Mode Breakdown</div>
            {Object.entries(byMode).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
              <div className="report-row" key={m}>
                <span className="report-label">{m}</span>
                <div className="report-track">
                  <div className="report-fill" style={{ width: `${(n / Math.max(total, 1) * 100).toFixed(0)}%` }} />
                </div>
                <span className="report-val">{n} visits ({(n / Math.max(total, 1) * 100).toFixed(0)}%)</span>
              </div>
            ))}
            {!Object.keys(byMode).length && <div className="empty-state">No data yet.</div>}
          </div>
        </>
      )}

      {view === 'map' && <MapView visits={visits} />}
    </>
  );
}
