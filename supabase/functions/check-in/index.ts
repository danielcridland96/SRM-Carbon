/**
 * check-in Edge Function
 *
 * Server-side replacement for the client-side Supabase insert in CheckInPage.
 * Running the insert here rather than directly from the browser gives us:
 *   1. Rate limiting — prevents spam/denial-of-service against the DB
 *   2. Server-side validation — input cannot be bypassed by a modified client
 *   3. Service role key stays server-side — anon key no longer needs INSERT grant
 *
 * Deploy:  supabase functions deploy check-in
 * Invoke:  POST https://<project>.supabase.co/functions/v1/check-in
 *
 * Once deployed, update CheckInPage.submit() to POST here instead of calling
 * sb.from('visitor_logs').insert(rec) directly.
 *
 * Environment variables (set in Supabase dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL              — automatically injected by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — automatically injected by Supabase runtime
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Simple in-process store: IP → [timestamp, ...] of recent submissions.
// Resets when the function instance is recycled. Not perfectly accurate across
// concurrent instances, but effective against casual abuse.
// For stricter limiting, replace with an Upstash Redis store.
const RATE_LIMIT_MAX    = 5;   // maximum submissions allowed per window
const RATE_LIMIT_WINDOW = 60;  // window duration in seconds
const rateStore = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW * 1000;
  const hits = (rateStore.get(ip) || []).filter(t => t > cutoff);
  hits.push(now);
  rateStore.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

// ─── CORS headers ─────────────────────────────────────────────────────────────
// Allow requests from the Netlify-hosted frontend only.
// Update ALLOWED_ORIGIN when the production domain is finalised.
const ALLOWED_ORIGIN = 'https://srm-carbon.netlify.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Validation ───────────────────────────────────────────────────────────────
interface CheckInPayload {
  visitor_name:   string;
  company?:       string | null;
  host:           string;
  purpose?:       string | null;
  visit_date:     string;
  arrival_time?:  string | null;
  office_name:    string;
  from_postcode?: string | null;
  transport_mode?: string | null;
  distance_km?:   number | null;
  co2_kg?:        number | null;
}

function validate(body: Partial<CheckInPayload>): string[] {
  const errors: string[] = [];
  if (!body.visitor_name?.trim()) errors.push('visitor_name is required');
  if (!body.host?.trim())         errors.push('host is required');
  if (!body.visit_date)           errors.push('visit_date is required');
  if (!body.office_name?.trim())  errors.push('office_name is required');

  // Prevent oversized strings reaching the DB
  if (body.visitor_name && body.visitor_name.length > 200) errors.push('visitor_name too long');
  if (body.host && body.host.length > 200)                 errors.push('host too long');
  if (body.office_name && body.office_name.length > 100)   errors.push('office_name too long');

  // visit_date must be a valid ISO date string
  if (body.visit_date && isNaN(Date.parse(body.visit_date))) errors.push('visit_date is not a valid date');

  // Numeric sanity checks — distance and CO₂ must be non-negative if present
  if (body.distance_km != null && (typeof body.distance_km !== 'number' || body.distance_km < 0)) {
    errors.push('distance_km must be a non-negative number');
  }
  if (body.co2_kg != null && (typeof body.co2_kg !== 'number' || body.co2_kg < 0)) {
    errors.push('co2_kg must be a non-negative number');
  }

  return errors;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  // Prefer CF-Connecting-IP (set by Cloudflare) then x-forwarded-for (set by Netlify/CDN)
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown';

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many submissions. Please try again shortly.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(RATE_LIMIT_WINDOW) },
    });
  }

  // ── Parse and validate body ─────────────────────────────────────────────────
  let body: Partial<CheckInPayload>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const errors = validate(body);
  if (errors.length > 0) {
    return new Response(JSON.stringify({ error: 'Validation failed', details: errors }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Insert using service role (bypasses RLS — validation already done above) ──
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const record = {
    visitor_name:   body.visitor_name!.trim(),
    company:        body.company?.trim() || null,
    host:           body.host!.trim(),
    purpose:        body.purpose || null,
    visit_date:     body.visit_date!,
    arrival_time:   body.arrival_time || null,
    office_name:    body.office_name!.trim(),
    from_postcode:  body.from_postcode?.toUpperCase() || null,
    transport_mode: body.transport_mode || null,
    distance_km:    body.distance_km ?? null,
    co2_kg:         body.co2_kg ?? null,
  };

  const { error } = await sb.from('visitor_logs').insert(record);

  if (error) {
    console.error('DB insert error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save check-in' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
