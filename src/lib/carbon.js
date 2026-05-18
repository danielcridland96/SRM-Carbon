export const EMISSION_FACTORS = {
  car:    { factor: 0.170, label: 'Petrol car' },
  diesel: { factor: 0.162, label: 'Diesel car' },
  ev:     { factor: 0.047, label: 'Electric car' },
  train:  { factor: 0.041, label: 'Train' },
  bus:    { factor: 0.097, label: 'Bus/Coach' },
  bike:   { factor: 0.000, label: 'Bike/Walk' },
};

export async function getLatLng(postcode) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`https://api.postcodes.io/postcodes/${postcode.replace(/\s/g, '').toUpperCase()}`, { signal: controller.signal });
    clearTimeout(timer);
    const d = await r.json();
    if (d.status !== 200 || typeof d.result?.latitude !== 'number') return null;
    return { lat: d.result.latitude, lng: d.result.longitude };
  } catch {
    return null;
  }
}

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function co2Equivalent(kg) {
  if (kg === 0) return 'Zero emissions 🌱';
  if (kg < 0.1) return `${(kg * 1000).toFixed(0)}g — minimal`;
  if (kg < 0.5) return `${(kg / 0.233).toFixed(1)} phone charges`;
  if (kg < 5)   return `${(kg / 0.021).toFixed(0)} mins streaming`;
  return `${(kg / 2.5).toFixed(1)} km flight equiv.`;
}

export function validUKPostcode(v) {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(v.trim());
}
