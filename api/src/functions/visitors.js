import { app } from '@azure/functions';
import { getPool } from '../shared/db.js';
import { getClientPrincipal, getUserProfile, requireAuth, jsonResponse } from '../shared/auth.js';

app.http('visitors', {
  methods: ['GET'],
  authLevel: 'anonymous', // SWA route config enforces authentication
  handler: async (request, context) => {
    const principal = getClientPrincipal(request);
    const pool      = getPool();
    const profile   = await getUserProfile(pool, principal);

    const authErr = requireAuth(principal, profile);
    if (authErr) return authErr;

    const params = new URL(request.url).searchParams;
    const date   = params.get('date'); // YYYY-MM-DD filter for receptionist
    const limit  = Math.min(parseInt(params.get('limit') || '500', 10), 1000);

    // Build query with role-based scoping
    const conditions = [];
    const values     = [];
    let   idx        = 1;

    // Receptionists see only today's visits at their office
    // Managers see all dates at their office
    // Admins see all offices and all dates
    if (profile.role === 'receptionist') {
      conditions.push(`office_name = $${idx++}`);
      values.push(profile.office_name);
      conditions.push(`visit_date = $${idx++}`);
      values.push(new Date().toISOString().split('T')[0]);
    } else if (profile.role === 'manager') {
      conditions.push(`office_name = $${idx++}`);
      values.push(profile.office_name);
      if (date) {
        conditions.push(`visit_date = $${idx++}`);
        values.push(date);
      }
    } else if (profile.role === 'admin') {
      const office = params.get('office');
      if (office) {
        conditions.push(`office_name = $${idx++}`);
        values.push(office);
      }
      if (date) {
        conditions.push(`visit_date = $${idx++}`);
        values.push(date);
      }
    }

    values.push(limit);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const { rows } = await pool.query(
        `SELECT id, created_at, visitor_name, company, host, purpose,
                visit_date, arrival_time, office_name, from_postcode,
                transport_mode, distance_km, co2_kg
         FROM visitor_logs
         ${where}
         ORDER BY visit_date DESC, arrival_time DESC
         LIMIT $${idx}`,
        values
      );
      return jsonResponse(rows);
    } catch (e) {
      context.error('visitors query failed:', e.message);
      return jsonResponse({ error: 'Failed to load visitors' }, 500);
    }
  },
});
