import { app } from '@azure/functions';
import { getPool } from '../shared/db.js';
import { getClientPrincipal, getUserProfile, requireAuth, jsonResponse } from '../shared/auth.js';

// GET /api/users — list all staff profiles (admin only)
app.http('users-list', {
  methods: ['GET'],
  route: 'users',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = getClientPrincipal(request);
    const pool      = getPool();
    const profile   = await getUserProfile(pool, principal);

    const authErr = requireAuth(principal, profile, 'admin');
    if (authErr) return authErr;

    try {
      const { rows } = await pool.query(
        'SELECT id, email, full_name, role, office_name FROM user_profiles ORDER BY role, email'
      );
      return jsonResponse(rows);
    } catch (e) {
      context.error('users list failed:', e.message);
      return jsonResponse({ error: 'Failed to load users' }, 500);
    }
  },
});

// POST /api/users — create a staff profile (admin only)
// Note: does NOT create an Azure AD account — the staff member must already
// have an SRM Microsoft account. This just grants them portal access.
app.http('users-create', {
  methods: ['POST'],
  route: 'users',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = getClientPrincipal(request);
    const pool      = getPool();
    const profile   = await getUserProfile(pool, principal);

    const authErr = requireAuth(principal, profile, 'admin');
    if (authErr) return authErr;

    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const { email, full_name, role, office_name } = body;

    if (!email?.trim())    return jsonResponse({ error: 'email is required' }, 400);
    if (!full_name?.trim()) return jsonResponse({ error: 'full_name is required' }, 400);
    if (!['receptionist', 'manager', 'admin'].includes(role)) {
      return jsonResponse({ error: 'role must be receptionist, manager, or admin' }, 400);
    }
    if (role !== 'admin' && !office_name?.trim()) {
      return jsonResponse({ error: 'office_name is required for non-admin roles' }, 400);
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO user_profiles (email, full_name, role, office_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, full_name, role, office_name`,
        [
          email.trim().toLowerCase(),
          full_name.trim(),
          role,
          role === 'admin' ? null : office_name.trim(),
        ]
      );
      return jsonResponse(rows[0], 201);
    } catch (e) {
      if (e.code === '23505') return jsonResponse({ error: 'A profile for this email already exists' }, 409);
      context.error('users create failed:', e.message);
      return jsonResponse({ error: 'Failed to create user' }, 500);
    }
  },
});

// DELETE /api/users/{id} — remove a staff profile (admin only)
app.http('users-delete', {
  methods: ['DELETE'],
  route: 'users/{id}',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = getClientPrincipal(request);
    const pool      = getPool();
    const profile   = await getUserProfile(pool, principal);

    const authErr = requireAuth(principal, profile, 'admin');
    if (authErr) return authErr;

    const { id } = context.extraInputs ? {} : request.params ?? {};
    const targetId = id ?? new URL(request.url).pathname.split('/').pop();

    // Prevent admins from deleting their own profile
    if (profile.id === targetId) {
      return jsonResponse({ error: 'Cannot delete your own profile' }, 400);
    }

    try {
      const { rowCount } = await pool.query(
        'DELETE FROM user_profiles WHERE id = $1',
        [targetId]
      );
      if (rowCount === 0) return jsonResponse({ error: 'Profile not found' }, 404);
      return jsonResponse({ deleted: true });
    } catch (e) {
      context.error('users delete failed:', e.message);
      return jsonResponse({ error: 'Failed to delete user' }, 500);
    }
  },
});
