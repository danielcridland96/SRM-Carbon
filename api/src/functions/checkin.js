import { app } from '@azure/functions';
import { getPool } from '../shared/db.js';
import { jsonResponse } from '../shared/auth.js';

const VALID_MODES = ['Petrol car', 'Diesel car', 'Electric car', 'Train', 'Bus/Coach', 'Bike/Walk'];
const POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

function validate(body) {
  if (!body.visitor_name?.trim()) return 'visitor_name is required';
  if (!body.host?.trim())         return 'host is required';
  if (!body.office_name?.trim())  return 'office_name is required';
  if (!body.visit_date)           return 'visit_date is required';
  if (body.transport_mode && !VALID_MODES.includes(body.transport_mode)) return 'Invalid transport_mode';
  if (body.from_postcode && !POSTCODE_RE.test(body.from_postcode.trim())) return 'Invalid from_postcode format';
  const d = new Date(body.visit_date);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const min   = new Date('2020-01-01');
  if (isNaN(d) || d > today || d < min) return 'visit_date out of valid range';
  return null;
}

app.http('checkin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const err = validate(body);
    if (err) return jsonResponse({ error: err }, 400);

    const pool = getPool();
    try {
      const { rows } = await pool.query(
        `INSERT INTO visitor_logs
           (visitor_name, company, host, purpose, visit_date, arrival_time,
            office_name, from_postcode, transport_mode, distance_km, co2_kg)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, created_at`,
        [
          body.visitor_name.trim().slice(0, 200),
          body.company?.trim().slice(0, 200) || null,
          body.host.trim().slice(0, 200),
          body.purpose?.trim().slice(0, 500) || null,
          body.visit_date,
          body.arrival_time || null,
          body.office_name.trim().slice(0, 100),
          body.from_postcode?.toUpperCase().trim().slice(0, 10) || null,
          body.transport_mode || null,
          body.distance_km ?? null,
          body.co2_kg ?? null,
        ]
      );
      return jsonResponse({ id: rows[0].id, created_at: rows[0].created_at });
    } catch (e) {
      context.error('checkin insert failed:', e.message);
      return jsonResponse({ error: 'Failed to save check-in' }, 500);
    }
  },
});
