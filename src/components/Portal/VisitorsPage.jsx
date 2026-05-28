import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

const RECEPTIONIST_COLS = ['visitor_name','company','host','purpose','arrival_time'];
const MANAGER_COLS      = ['visitor_name','company','host','purpose','visit_date','arrival_time','from_postcode','transport_mode','distance_km','co2_kg'];

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export default function VisitorsPage({ role, office }) {
  const [rows,       setRows]  = useState(null);
  const [dateFilter, setDate]  = useState('');
  const [offFilter,  setOff]   = useState('');
  const [err,        setErr]   = useState('');

  const cols = role === 'receptionist' ? RECEPTIONIST_COLS : MANAGER_COLS;

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = {};
      if (dateFilter) params.date   = dateFilter;
      if (offFilter)  params.office = offFilter;
      setRows(await api.visitors(params));
    } catch (e) {
      setErr(e.message || 'Failed to load visitors');
    }
  }, [dateFilter, offFilter]);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    const header = cols.join(',');
    const body   = (rows || []).map(r => cols.map(c => `"${csvCell(r[c])}"`).join(',')).join('\n');
    const blob   = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const a      = document.createElement('a');
    a.href       = URL.createObjectURL(blob);
    a.download   = `visitors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const colLabel = c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <>
      <div className="page-header">
        <h2>Visitor Log</h2>
        <p>{role === 'receptionist' ? "Today's visitors at your office" : `All visits${office ? ` — ${office}` : ''}`}</p>
      </div>

      {role !== 'receptionist' && (
        <div className="access-badge">
          🔒 Showing {office ? `${office} only` : 'all offices'} · Role: {role}
        </div>
      )}

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-title">{rows ? `${rows.length} record${rows.length !== 1 ? 's' : ''}` : ''}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {role !== 'receptionist' && (
              <input type="date" className="tbl-filter" value={dateFilter}
                onChange={e => setDate(e.target.value)} title="Filter by date" />
            )}
            {role === 'admin' && (
              <input className="tbl-filter" value={offFilter} placeholder="Filter office…"
                onChange={e => setOff(e.target.value)} style={{ width: 140 }} />
            )}
            <button className="export-btn" onClick={load}>Refresh</button>
            {role !== 'receptionist' && (
              <button className="export-btn" onClick={exportCsv} disabled={!rows?.length}>Export CSV</button>
            )}
          </div>
        </div>

        {err && <div className="alert alert-error" style={{ margin: '12px 16px' }}>{err}</div>}
        {rows === null && <div className="loading-state">Loading visitors…</div>}
        {rows?.length === 0 && <div className="empty-state">No records found.</div>}

        {rows?.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>{cols.map(c => <th key={c}>{colLabel(c)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    {cols.map(c => (
                      <td key={c}>
                        {c === 'co2_kg' && r[c] != null ? (
                          <span className={`co2-pill ${r[c] < 2 ? 'co2-low' : r[c] < 10 ? 'co2-med' : 'co2-high'}`}>
                            {Number(r[c]).toFixed(2)} kg
                          </span>
                        ) : r[c] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
