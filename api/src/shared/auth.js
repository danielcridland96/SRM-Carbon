/**
 * Parses the x-ms-client-principal header injected by Azure Static Web Apps
 * after a successful Azure AD authentication. Returns null for anonymous requests.
 *
 * Header value is a base64-encoded JSON object with shape:
 *   { identityProvider, userId, userDetails (email), userRoles, claims }
 */
export function getClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Looks up the user_profiles row for the authenticated principal.
 * Returns null if the user has no portal profile (access denied).
 * On first login, updates azure_oid if it was not previously recorded.
 */
export async function getUserProfile(pool, principal) {
  if (!principal?.userDetails) return null;

  const email = principal.userDetails.toLowerCase();
  const { rows } = await pool.query(
    'SELECT * FROM user_profiles WHERE email = $1',
    [email]
  );
  const profile = rows[0];
  if (!profile) return null;

  // Record the Azure AD object ID on first login
  if (!profile.azure_oid && principal.userId) {
    await pool.query(
      'UPDATE user_profiles SET azure_oid = $1 WHERE email = $2',
      [principal.userId, email]
    );
    profile.azure_oid = principal.userId;
  }

  return profile;
}

export function requireAuth(principal, profile, requiredRole = null) {
  if (!principal) return { status: 401, body: JSON.stringify({ error: 'Authentication required' }) };
  if (!profile)   return { status: 403, body: JSON.stringify({ error: 'No portal access. Contact your admin.' }) };
  if (requiredRole && profile.role !== requiredRole) {
    return { status: 403, body: JSON.stringify({ error: 'Insufficient permissions' }) };
  }
  return null;
}

export function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
