import { createClient } from '@supabase/supabase-js';

const ENV_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function createSupabaseClient() {
  const url = localStorage.getItem('srm_sb_url') || ENV_URL;
  const key = localStorage.getItem('srm_sb_key') || ENV_KEY;
  if (!url || !key) return null;
  try { return createClient(url, key); } catch { return null; }
}
