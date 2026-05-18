import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const url = localStorage.getItem('srm_sb_url');
  const key = localStorage.getItem('srm_sb_key');
  if (!url || !key) return null;
  try { return createClient(url, key); } catch { return null; }
}
