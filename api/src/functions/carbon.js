import { app } from '@azure/functions';
import { getPool } from '../shared/db.js';
import { getClientPrincipal, getUserProfile, requireAuth, jsonResponse } from '../shared/auth.js';

app.http('carbon', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = getClientPrincipal(request);
    const pool      = getPool();
    const profile   = await getUserProfile(pool, principal);

    const authErr = requireAuth(principal, profile);
    if (authErr) return authErr;

    // Receptionists don't have access to the carbon report
    if (profile.role === 'receptionist') {
      return jsonResponse({ error: 'Insufficient permissions' }, 403);
    }

    const conditions = [];
    const values     = [];
    let   idx        = 1;

    if (profile.role === 'manager') {
      conditions.push(`office_name = $${idx++}`);
      values.push(profile.office_name);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const { rows } = await pool.query(
        `SELECT office_name, transport_mode, co2_kg, visit_date, from_postcode
         FROM visitor_logs
         ${where}
         ORDER BY visit_date DESC`,
        values
      );
      return jsonResponse(rows);
    } catch (e) {
      context.error('carbon query failed:', e.message);
      return jsonResponse({ error: 'Failed to load carbon data' }, 500);
    }
  },
});
