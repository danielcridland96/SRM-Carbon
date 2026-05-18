/**
 * supabase.js — Factory function for creating the Supabase client instance.
 *
 * Credential resolution order (first non-empty value wins):
 *   1. localStorage keys: srm_sb_url / srm_sb_key  (legacy — from old DB tab in admin modal)
 *   2. Vite build-time environment variables: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *
 * In production (Netlify), the env vars are set in the Netlify dashboard under
 * Site → Environment Variables, so the client connects automatically without
 * any manual configuration on the device.
 *
 * The function returns null rather than throwing when credentials are absent,
 * so the app degrades gracefully — the check-in form can still display without
 * a database connection, and PortalPage shows a "not configured" screen.
 *
 * The anon key is the public PostgREST key — it is safe to expose in the
 * client bundle. All data access is controlled by Supabase Row Level Security
 * (RLS) policies enforced on the server, not by key secrecy.
 */

import { createClient } from '@supabase/supabase-js';

// Read env vars at module load time (Vite replaces these at build)
const ENV_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * createSupabaseClient — resolves credentials and returns a configured
 * Supabase client, or null if no credentials are available.
 *
 * Called once in CheckInPage and PortalPage via useState initialiser so the
 * client is created once per page load and stored in component state.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function createSupabaseClient() {
  // localStorage values are the fallback from the old DB tab (now removed from
  // the admin UI). They still work if a device has them stored from a previous
  // session, but new deployments rely entirely on the env vars.
  const url = localStorage.getItem('srm_sb_url') || ENV_URL;
  const key = localStorage.getItem('srm_sb_key') || ENV_KEY;

  if (!url || !key) return null;

  try {
    return createClient(url, key);
  } catch {
    // createClient can throw if the URL is malformed
    return null;
  }
}
