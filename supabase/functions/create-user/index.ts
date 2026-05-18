/**
 * create-user Edge Function
 *
 * Admin-only server-side user creation. Replaces the client-side
 * sb.auth.signUp() call in UsersPage.jsx.
 *
 * Why this matters:
 *   - sb.auth.signUp() uses the anon key and is callable by anyone if Supabase
 *     email confirmation is disabled. Running it here means only authenticated
 *     admins can create accounts.
 *   - The service role key (which can bypass RLS) stays server-side and is
 *     never exposed in the browser bundle.
 *
 * Deploy:  supabase functions deploy create-user
 * Invoke:  POST https://<project>.supabase.co/functions/v1/create-user
 *          Authorization: Bearer <staff-portal-jwt>
 *
 * Once deployed, update UsersPage.createUser() to call this function instead
 * of sb.auth.signUp() + sb.from('user_profiles').insert() directly.
 *
 * Environment variables (auto-injected by Supabase runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS headers ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = 'https://srm-carbon.netlify.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface CreateUserPayload {
  email:       string;
  password:    string;
  full_name:   string;
  role:        'receptionist' | 'manager' | 'admin';
  office_name: string | null;
}

function validate(body: Partial<CreateUserPayload>): string[] {
  const errors: string[] = [];
  if (!body.email?.trim())                       errors.push('email is required');
  if (!body.password || body.password.length < 8) errors.push('password must be at least 8 characters');
  if (!body.full_name?.trim())                   errors.push('full_name is required');
  if (!['receptionist', 'manager', 'admin'].includes(body.role!)) {
    errors.push('role must be receptionist, manager, or admin');
  }
  if (body.role !== 'admin' && !body.office_name) {
    errors.push('office_name is required for non-admin roles');
  }
  return errors;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Authenticate the caller ─────────────────────────────────────────────────
  // Use the caller's JWT (from the Authorization header) to verify they are
  // a signed-in admin before allowing user creation.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const callerJwt = authHeader.replace('Bearer ', '');

  // Verify the JWT using the anon key client (respects RLS — caller sees only their own profile)
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${callerJwt}` } } }
  );

  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify the caller has the admin role in user_profiles
  const { data: profile } = await callerClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Parse and validate body ─────────────────────────────────────────────────
  let body: Partial<CreateUserPayload>;
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

  // ── Create the user with the service role client ────────────────────────────
  // Service role bypasses RLS — only safe to use here because we've verified
  // the caller is an admin above.
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Step 1: Create auth account
  const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
    email:    body.email!.trim(),
    password: body.password!,
    email_confirm: true, // Skip email confirmation — admin is creating the account directly
    user_metadata: { full_name: body.full_name!.trim() },
  });

  if (signUpError || !newUser.user) {
    return new Response(JSON.stringify({ error: signUpError?.message || 'Failed to create auth account' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Step 2: Insert the user_profiles row
  const { error: profileError } = await adminClient.from('user_profiles').insert({
    id:          newUser.user.id,
    email:       body.email!.trim(),
    full_name:   body.full_name!.trim(),
    role:        body.role!,
    office_name: body.office_name || null,
  });

  if (profileError) {
    // Auth account was created but profile failed — clean up the orphaned auth account
    await adminClient.auth.admin.deleteUser(newUser.user.id);
    return new Response(JSON.stringify({ error: 'Failed to create user profile: ' + profileError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, id: newUser.user.id }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
