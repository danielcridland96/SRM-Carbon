import { app } from '@azure/functions';
import { getPool } from '../shared/db.js';
import { getClientPrincipal, getUserProfile, jsonResponse } from '../shared/auth.js';

// GET /api/profile — returns the current user's role and office assignment.
// Used by PortalPage and AdminModal after Azure AD sign-in to establish
// what the user is allowed to see and do.
app.http('profile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = getClientPrincipal(request);
    if (!principal) return jsonResponse({ error: 'Authentication required' }, 401);

    const pool    = getPool();
    const profile = await getUserProfile(pool, principal);

    if (!profile) {
      return jsonResponse({ error: 'No portal access. Contact your admin.' }, 403);
    }

    return jsonResponse({
      id:          profile.id,
      email:       profile.email,
      full_name:   profile.full_name,
      role:        profile.role,
      office_name: profile.office_name,
    });
  },
});
