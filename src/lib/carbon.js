/**
 * carbon.js — Emission factor data, distance calculation, and CO₂ utilities.
 *
 * All CO₂ factors are sourced from the UK Government GHG Conversion Factors
 * (DEFRA/BEIS, 2023 edition). Figures represent kg CO₂e per passenger-kilometre
 * for average UK vehicle occupancy / load factors.
 *
 * Distance is calculated via the Haversine great-circle formula using lat/lng
 * coordinates looked up from the free postcodes.io API.
 */

/**
 * EMISSION_FACTORS — map of transport mode key → { factor, label }
 *
 * factor: kg CO₂e emitted per kilometre of travel (one-way)
 * label:  human-readable name shown in the UI and stored in the database
 *
 * Bike/Walk has a factor of 0 because human-powered transport produces
 * negligible lifecycle emissions compared to motorised modes.
 */
export const EMISSION_FACTORS = {
  car:    { factor: 0.170, label: 'Petrol car' },   // Average petrol car, UK fleet average
  diesel: { factor: 0.162, label: 'Diesel car' },   // Average diesel car, UK fleet average
  ev:     { factor: 0.047, label: 'Electric car' }, // Battery EV on UK grid mix (2023)
  train:  { factor: 0.041, label: 'Train' },        // National Rail average
  bus:    { factor: 0.097, label: 'Bus/Coach' },    // Average local bus / coach
  bike:   { factor: 0.000, label: 'Bike/Walk' },    // Zero tailpipe emissions
};

/**
 * getLatLng — looks up the latitude/longitude of a UK postcode via the
 * free postcodes.io public API. Returns null on any failure so callers
 * can silently skip carbon calculation rather than surface an error to the user.
 *
 * Security notes:
 * - AbortController enforces a 5-second timeout so a slow API response
 *   doesn't block the UI indefinitely.
 * - The postcode is stripped of whitespace and uppercased before the request
 *   to match the API's expected format.
 * - The response shape is validated (`status === 200` and numeric lat) before
 *   trusting the data; malformed responses return null.
 * - The entire function is wrapped in try/catch so network errors, JSON parse
 *   failures, and abort errors all result in null rather than an unhandled
 *   promise rejection.
 *
 * @param {string} postcode  UK postcode string, e.g. "SW1A 1AA"
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function getLatLng(postcode) {
  try {
    const controller = new AbortController();
    // Abort the fetch if it hasn't resolved within 5 seconds
    const timer = setTimeout(() => controller.abort(), 5000);

    const r = await fetch(
      `https://api.postcodes.io/postcodes/${postcode.replace(/\s/g, '').toUpperCase()}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    const d = await r.json();

    // postcodes.io returns status 200 in the JSON body for valid postcodes;
    // any other status (404, etc.) means the postcode wasn't found
    if (d.status !== 200 || typeof d.result?.latitude !== 'number') return null;

    return { lat: d.result.latitude, lng: d.result.longitude };
  } catch {
    // Network error, timeout, invalid JSON — silently return null
    return null;
  }
}

/**
 * haversineKm — calculates the great-circle distance in kilometres between
 * two geographic coordinates using the Haversine formula.
 *
 * This gives the straight-line ("as the crow flies") distance, not a
 * road/rail distance. It's used as a consistent proxy for travel distance
 * across all transport modes. Real journey distances would require a routing
 * API (e.g. Google Maps), which would add cost and complexity.
 *
 * R = 6371 is the mean radius of the Earth in kilometres.
 *
 * @param {{lat: number, lng: number}} a  Origin point
 * @param {{lat: number, lng: number}} b  Destination point
 * @returns {number} Distance in kilometres
 */
export function haversineKm(a, b) {
  const R = 6371; // Earth's mean radius in km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
    Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * co2Equivalent — converts a raw kg CO₂ figure into a relatable real-world
 * equivalent string for display in the CarbonResult component.
 *
 * Thresholds and equivalents:
 *   0 kg        → zero emissions message
 *   < 0.1 kg    → expressed in grams (minimal impact)
 *   0.1–0.5 kg  → equivalent smartphone charges (avg 0.233 kWh × UK grid factor)
 *   0.5–5 kg    → equivalent minutes of 4K video streaming
 *   > 5 kg      → equivalent short-haul flight distance (avg 255 g/km per passenger)
 *
 * @param {number} kg  CO₂ in kilograms
 * @returns {string}   Human-readable equivalent string
 */
export function co2Equivalent(kg) {
  if (kg === 0)   return 'Zero emissions 🌱';
  if (kg < 0.1)   return `${(kg * 1000).toFixed(0)}g — minimal`;
  if (kg < 0.5)   return `${(kg / 0.233).toFixed(1)} phone charges`;
  if (kg < 5)     return `${(kg / 0.021).toFixed(0)} mins streaming`;
  return `${(kg / 2.5).toFixed(1)} km flight equiv.`;
}

/**
 * validUKPostcode — validates that a string matches the standard UK postcode
 * format before sending it to the postcodes.io API.
 *
 * Accepted formats: A9 9AA, A99 9AA, AA9 9AA, AA99 9AA, A9A 9AA, AA9A 9AA
 * The space between the outward and inward code is optional.
 *
 * This is a format check only — it doesn't verify the postcode actually
 * exists. The postcodes.io API handles existence checks.
 *
 * @param {string} v  Postcode string to validate
 * @returns {boolean}
 */
export function validUKPostcode(v) {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(v.trim());
}
