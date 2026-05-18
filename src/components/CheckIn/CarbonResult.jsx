/**
 * CarbonResult — real-time carbon footprint display shown beneath the journey
 * details section of the check-in form.
 *
 * Rendered only when both a postcode and transport mode have been selected, and
 * the postcodes.io lookup has resolved. The values are recalculated automatically
 * via the debounced useEffect in CheckInPage whenever postcode or transport changes.
 *
 * The icon colour-codes the severity of the emission:
 *   🌱  0 kg      — zero (bike/walk)
 *   🌿  < 1 kg    — low (electric car, short train trip)
 *   🌍  1–5 kg    — medium (typical train journey)
 *   ⚠️  > 5 kg    — high (long car journey)
 *
 * Props:
 *   co2            — calculated CO₂ in kg (number)
 *   distanceKm     — calculated distance in km (number)
 *   transportLabel — human-readable transport name from EMISSION_FACTORS
 */

import { co2Equivalent } from '../../lib/carbon';

export default function CarbonResult({ co2, distanceKm, transportLabel }) {
  // Icon reflects CO₂ severity so visitors get immediate visual feedback
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
      {/* Right-hand badge shows a relatable real-world equivalent via co2Equivalent() */}
      <div className="carbon-badge">
        <div className="equiv">≈ equivalent to</div>
        <div className="equiv-val">{co2Equivalent(co2)}</div>
      </div>
    </div>
  );
}
