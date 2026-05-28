import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { loadOffices } from '../../lib/offices';

const MODE_COLORS = {
  'Petrol car':   '#dc2626',
  'Diesel car':   '#ea580c',
  'Electric car': '#16a34a',
  'Train':        '#2563eb',
  'Bus/Coach':    '#7c3aed',
  'Bike/Walk':    '#059669',
};

function co2Color(kg) {
  if (!kg || kg <= 0) return '#059669';
  if (kg < 2)  return '#6dcc8f';
  if (kg < 10) return '#f59e0b';
  if (kg < 30) return '#f97316';
  return '#dc2626';
}

function normalisePostcode(p) {
  return p?.toUpperCase().replace(/\s+/g, ' ').trim() || '';
}

function arcPoints(a, b, steps = 50) {
  const midLat = (a.lat + b.lat) / 2;
  const midLng = (a.lng + b.lng) / 2;
  const dist   = Math.hypot(b.lat - a.lat, b.lng - a.lng);
  const ctrlLat = midLat + dist * 0.35;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [
      (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * ctrlLat + t ** 2 * b.lat,
      (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * midLng  + t ** 2 * b.lng,
    ];
  });
}

async function bulkGeocode(postcodes) {
  const unique = [...new Set(postcodes.map(normalisePostcode).filter(Boolean))];
  const out = {};
  for (let i = 0; i < unique.length; i += 100) {
    try {
      const r = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: unique.slice(i, i + 100) }),
      });
      const d = await r.json();
      if (d.status === 200) {
        for (const { query, result } of d.result) {
          if (result) out[normalisePostcode(query)] = { lat: result.latitude, lng: result.longitude };
        }
      }
    } catch { /* skip failed batch */ }
  }
  return out;
}

// Mounted inside MapContainer — fits the view to all markers once geocoding is done
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding: [48, 48] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapView({ visits }) {
  const [geo, setGeo]       = useState(null);
  const [offGeo, setOffGeo] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visits?.length) { setLoading(false); return; }

    async function geocode() {
      const offices    = loadOffices();
      const visitorPcs = visits.map(v => v.from_postcode).filter(Boolean);
      const officePcs  = Object.values(offices).map(o => o.postcode);
      const results    = await bulkGeocode([...visitorPcs, ...officePcs]);

      const og = {};
      for (const [name, { postcode }] of Object.entries(offices)) {
        const key = normalisePostcode(postcode);
        if (results[key]) og[name] = results[key];
      }

      setGeo(results);
      setOffGeo(og);
      setLoading(false);
    }

    geocode();
  }, [visits]);

  if (loading) return <div className="loading-state">Geocoding postcodes…</div>;
  if (!visits?.length) return <div className="empty-state">No travel data to map.</div>;

  // Aggregate arcs: (from_postcode → office_name) → { co2, count, modes }
  const arcMap = {};
  for (const v of visits) {
    if (!v.from_postcode || !v.office_name) continue;
    const key = `${normalisePostcode(v.from_postcode)}|${v.office_name}`;
    if (!arcMap[key]) arcMap[key] = { from: v.from_postcode, to: v.office_name, co2: 0, count: 0, modes: {} };
    arcMap[key].co2 += v.co2_kg || 0;
    arcMap[key].count++;
    const m = v.transport_mode || 'Unknown';
    arcMap[key].modes[m] = (arcMap[key].modes[m] || 0) + 1;
  }

  // Unique origin points keyed by normalised postcode
  const originMap = {};
  for (const v of visits) {
    if (!v.from_postcode) continue;
    const key = normalisePostcode(v.from_postcode);
    if (!originMap[key]) originMap[key] = { postcode: v.from_postcode, co2: 0, count: 0 };
    originMap[key].co2   += v.co2_kg || 0;
    originMap[key].count++;
  }

  // Office totals for popups
  const offTotals = {};
  for (const v of visits) {
    if (!v.office_name) continue;
    if (!offTotals[v.office_name]) offTotals[v.office_name] = { co2: 0, count: 0 };
    offTotals[v.office_name].co2   += v.co2_kg || 0;
    offTotals[v.office_name].count++;
  }

  const allPositions = [
    ...Object.values(offGeo).map(c => [c.lat, c.lng]),
    ...Object.keys(originMap).map(k => geo?.[k]).filter(Boolean).map(c => [c.lat, c.lng]),
  ];

  return (
    <div className="map-wrap">
      <MapContainer
        center={[54.5, -2]}
        zoom={6}
        style={{ height: 520, borderRadius: 12 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {allPositions.length > 1 && <FitBounds positions={allPositions} />}

        {/* Arc lines from visitor origin to office */}
        {Object.values(arcMap).map(arc => {
          const fromCoord = geo?.[normalisePostcode(arc.from)];
          const toCoord   = offGeo[arc.to];
          if (!fromCoord || !toCoord) return null;
          const topMode = Object.entries(arc.modes).sort((a, b) => b[1] - a[1])[0]?.[0];
          return (
            <Polyline
              key={`${arc.from}|${arc.to}`}
              positions={arcPoints(fromCoord, toCoord)}
              pathOptions={{
                color:   MODE_COLORS[topMode] || '#94a3b8',
                weight:  Math.min(1 + arc.count * 0.4, 4.5),
                opacity: 0.55,
              }}
            >
              <Popup>
                <strong>{arc.from} → {arc.to}</strong><br />
                {arc.count} visit{arc.count !== 1 ? 's' : ''} · {arc.co2.toFixed(1)} kg CO₂<br />
                Main mode: {topMode}
              </Popup>
            </Polyline>
          );
        })}

        {/* Origin circle markers — size by visit count, colour by avg CO₂ */}
        {Object.entries(originMap).map(([key, o]) => {
          const coord = geo?.[key];
          if (!coord) return null;
          const avgCo2 = o.co2 / o.count;
          const color  = co2Color(avgCo2);
          return (
            <CircleMarker
              key={key}
              center={[coord.lat, coord.lng]}
              radius={Math.min(5 + o.count * 1.2, 16)}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 1.5 }}
            >
              <Popup>
                <strong>{o.postcode}</strong><br />
                {o.count} visit{o.count !== 1 ? 's' : ''} · {o.co2.toFixed(1)} kg CO₂ total<br />
                Avg {avgCo2.toFixed(2)} kg/visit
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Office markers */}
        {Object.entries(offGeo).map(([name, coord]) => {
          const tot = offTotals[name] || { co2: 0, count: 0 };
          return (
            <CircleMarker
              key={name}
              center={[coord.lat, coord.lng]}
              radius={14}
              pathOptions={{ color: '#0d6b2f', fillColor: '#0d6b2f', fillOpacity: 0.92, weight: 2 }}
            >
              <Popup>
                <strong>{name}</strong><br />
                {tot.count} visit{tot.count !== 1 ? 's' : ''} · {tot.co2.toFixed(1)} kg CO₂
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="map-legend">
        <div className="legend-group">
          <div className="legend-title">Origin (avg CO₂/visit)</div>
          {[['< 2 kg', '#6dcc8f'], ['2–10 kg', '#f59e0b'], ['10–30 kg', '#f97316'], ['> 30 kg', '#dc2626']].map(([label, color]) => (
            <div key={label} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
        <div className="legend-group">
          <div className="legend-title">Arc (transport mode)</div>
          {Object.entries(MODE_COLORS).map(([mode, color]) => (
            <div key={mode} className="legend-item">
              <span className="legend-line" style={{ background: color }} />
              {mode}
            </div>
          ))}
        </div>
        <div className="legend-group">
          <div className="legend-title">Office</div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#0d6b2f' }} />
            SRM office
          </div>
        </div>
      </div>
    </div>
  );
}
