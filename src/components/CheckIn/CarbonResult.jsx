import { co2Equivalent } from '../../lib/carbon';

export default function CarbonResult({ co2, distanceKm, transportLabel }) {
  const icon = co2 === 0 ? '🌱' : co2 < 1 ? '🌿' : co2 < 5 ? '🌍' : '⚠️';

  return (
    <div className="carbon-result">
      <div className="carbon-icon">{icon}</div>
      <div className="carbon-info">
        <div className="carbon-value">
          {co2.toFixed(2)}<span> kg CO₂e</span>
        </div>
        <div className="carbon-label">Estimated carbon footprint (one way)</div>
        <div className="carbon-distance">{distanceKm.toFixed(1)} km · {transportLabel}</div>
      </div>
      <div className="carbon-badge">
        <div className="equiv">≈ equivalent to</div>
        <div className="equiv-val">{co2Equivalent(co2)}</div>
      </div>
    </div>
  );
}
