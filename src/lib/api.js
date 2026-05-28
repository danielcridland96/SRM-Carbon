/**
 * api.js — typed fetch helpers for the Azure Functions API layer.
 *
 * Replaces all direct Supabase client calls. Each function maps to one
 * Azure Function endpoint. Authentication is handled automatically by
 * the Azure SWA session cookie — no token management needed here.
 */

async function call(path, options = {}) {
  const r = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Parse the JSON body regardless of status so error messages are available
  let body;
  try { body = await r.json(); } catch { body = {}; }

  if (!r.ok) {
    const message = body?.error || `Request failed (${r.status})`;
    throw Object.assign(new Error(message), { status: r.status });
  }

  return body;
}

export const api = {
  /** Returns the current user's role and office_name from user_profiles. */
  profile: () => call('/profile'),

  /**
   * Submits a visitor check-in. Called from CheckInPage on form submit.
   * No authentication required — this is the public kiosk endpoint.
   */
  checkin: (data) => call('/checkin', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * Returns visitor log rows scoped by the authenticated user's role/office.
   * @param {object} params  Optional query filters: { date, office, limit }
   */
  visitors: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return call(`/visitors${qs ? `?${qs}` : ''}`);
  },

  /** Returns raw visitor_logs rows for carbon report aggregation and map. */
  carbon: () => call('/carbon'),

  users: {
    /** Returns all user_profiles rows (admin only). */
    list: () => call('/users'),

    /**
     * Creates a user_profiles entry granting portal access.
     * The staff member must already have an SRM Microsoft account.
     * @param {{ email, full_name, role, office_name }} data
     */
    create: (data) => call('/users', { method: 'POST', body: JSON.stringify(data) }),

    /** Removes a user_profiles entry, revoking portal access. */
    delete: (id) => call(`/users/${id}`, { method: 'DELETE' }),
  },
};
