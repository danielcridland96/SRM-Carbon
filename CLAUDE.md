# SRM Carbon Tracker — Project Reference

Visitor check-in and carbon tracking web application for Sir Robert McAlpine offices across the UK. Built as a React SPA hosted on Netlify, with Supabase as the database and auth backend.

---

## Purpose

When visitors arrive at an SRM office, they complete a digital check-in form on a reception kiosk (tablet/screen running this web app). The form captures:
- Who they are and who they are visiting
- Their travel postcode and mode of transport

The app calculates a CO₂ estimate for the journey and stores it alongside the visit record. The reception team receives an email notification. Staff can view visit logs and carbon reports via a separate authenticated portal.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Routing | React Router v7 (BrowserRouter, two routes) |
| Database + Auth | Supabase (PostgreSQL + PostgREST + GoTrue) |
| Email notifications | EmailJS (browser-side, no backend needed) |
| Postcode lookup | postcodes.io (free UK postcode → lat/lng API) |
| Hosting | Netlify (auto-deploy from GitHub on push to main) |
| Repo | github.com/danielcridland96/SRM-Carbon |

---

## Routes

| Path | Component | Access |
|---|---|---|
| `/` | `CheckInPage` | Public — kiosk-facing check-in form |
| `/portal` | `PortalPage` | Staff only — requires Supabase login |

Netlify is configured with a catch-all redirect (`/* → /index.html, status 200`) so React Router handles routing rather than Netlify returning 404 on direct URL access or page refresh.

---

## Project Structure

```
src/
  App.jsx                          — Root router
  pages/
    CheckInPage.jsx                — Kiosk check-in form (route: /)
    PortalPage.jsx                 — Staff portal (route: /portal)
  components/
    CheckIn/
      OfficeBanner.jsx             — Displays active office at top of form
      TransportGrid.jsx            — 6-option transport mode radio grid
      CarbonResult.jsx             — Live CO₂ estimate display
    AdminModal/
      AdminModal.jsx               — Device settings modal (admin auth)
      TabOffice.jsx                — Switch active office for this terminal
      TabOffices.jsx               — CRUD for office list
      TabEmail.jsx                 — Configure EmailJS credentials
    Portal/
      VisitorsPage.jsx             — Visitor log table with role-based filtering
      CarbonPage.jsx               — Carbon emissions report with bar charts
      UsersPage.jsx                — Admin-only staff account management
  lib/
    carbon.js                      — Emission factors, postcodes.io lookup, Haversine
    supabase.js                    — Supabase client factory
    offices.js                     — Default offices, localStorage persistence
    email.js                       — EmailJS send helper
```

---

## Environment Variables

Set in the **Netlify dashboard** under Site → Environment Variables. Never committed to git.

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to expose — security via RLS) |

The `.env` file exists locally for development but is git-ignored. Both variables must be set in Netlify for production builds to connect to the database.

The Supabase project is: **Daniels Project** (`jdouqwovuqgqkuafrhdo.supabase.co`)

---

## Supabase Database Schema

### `visitor_logs` table

Stores one row per visitor check-in. Writable by anonymous users (RLS policy allows anon inserts). Readable only by authenticated staff.

```sql
create table visitor_logs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  visitor_name   text not null,
  company        text,
  host           text not null,
  purpose        text,
  visit_date     date not null,
  arrival_time   time,
  office_name    text not null,
  from_postcode  text,
  transport_mode text,
  distance_km    numeric(8,2),
  co2_kg         numeric(8,4),

  constraint chk_visit_date check (visit_date >= '2020-01-01') not valid
);
```

The `NOT VALID` flag on `chk_visit_date` means the constraint only applies to new rows, not existing data (added retroactively after old rows were found to violate it).

### `user_profiles` table

One row per staff member. The `id` column is a foreign key to `auth.users.id` in Supabase Auth, linking the authentication identity to the role and office assignment.

```sql
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null check (role in ('receptionist', 'manager', 'admin')),
  office_name text
);
```

`office_name` is null for admins (they see all offices). Non-null for managers and receptionists (they only see records for their assigned office).

---

## Row Level Security (RLS) Policies

RLS is **enabled** on both tables. All access control is enforced server-side.

### `visitor_logs`

| Policy | Role | Operation | Condition |
|---|---|---|---|
| `anon_insert` | anon | INSERT | `true` — anyone on the check-in form can insert |
| `auth_insert` | authenticated | INSERT | `true` — authenticated users can also insert |
| `staff_select` | authenticated | SELECT | Enforced via `user_profiles.office_name` match |

Anon inserts work because the `GRANT INSERT ON visitor_logs TO anon` and `GRANT USAGE ON SCHEMA public TO anon` grants have been applied in the SQL editor.

### `user_profiles`

| Policy | Role | Operation | Condition |
|---|---|---|---|
| `self_read` | authenticated | SELECT | `auth.uid() = id` |
| `admin_all` | authenticated | ALL | User has role = 'admin' in their own profile |

---

## Role System

Three roles control what staff can see in the portal:

| Role | Visitor log scope | Date filter | Carbon report | CSV export | User management |
|---|---|---|---|---|---|
| `receptionist` | Own office, today only | No | No | No | No |
| `manager` | Own office, all dates | Yes | Yes | Yes | No |
| `admin` | All offices, all dates | Yes | Yes | Yes | Yes |

Role is assigned in `user_profiles.role` when the staff account is created via the Manage Users page in the portal.

---

## Carbon Calculation

1. Visitor enters their departure postcode → `getLatLng(postcode)` calls `https://api.postcodes.io/postcodes/{postcode}` to resolve coordinates
2. Office postcode is looked up the same way → `getLatLng(office.postcode)`
3. `haversineKm(a, b)` calculates the great-circle ("as the crow flies") distance in km
4. `distanceKm × EMISSION_FACTORS[mode].factor` gives CO₂ in kg

Emission factors (kg CO₂e per km, from DEFRA/BEIS 2023):

| Mode | Factor |
|---|---|
| Petrol car | 0.170 |
| Diesel car | 0.162 |
| Electric car | 0.047 |
| Train | 0.041 |
| Bus/Coach | 0.097 |
| Bike/Walk | 0.000 |

The calculation uses a 600ms debounce — it fires 600ms after the user stops typing their postcode, to avoid a postcodes.io request per keystroke.

---

## LocalStorage Keys

The app stores device-specific configuration in localStorage (no server required for configuration):

| Key | Value | Set by |
|---|---|---|
| `srm_office` | Active office name string | TabOffice admin tab |
| `srm_offices` | JSON object of offices map | TabOffices admin tab |
| `srm_ejs_key` | EmailJS public key | TabEmail admin tab |
| `srm_ejs_service` | EmailJS service ID | TabEmail admin tab |
| `srm_ejs_template` | EmailJS template ID | TabEmail admin tab |
| `srm_reception_emails` | JSON `{officeName: email}` | TabEmail admin tab |
| `srm_sb_url` | Supabase URL (legacy — env var preferred) | Old DB tab (removed) |
| `srm_sb_key` | Supabase anon key (legacy — env var preferred) | Old DB tab (removed) |

---

## Email Notifications (EmailJS)

When a visitor submits the check-in form, an email is sent to the receptionist for the active office.

**Setup required per device:**
1. Create a free account at emailjs.com
2. Add an email service (Gmail, Outlook, etc.)
3. Create a template using the variable names listed below
4. Enter the Public Key, Service ID, Template ID, and receptionist email in ⚙️ Device Settings → Email tab

**Template variables** (available in the EmailJS template):
`{{visitor_name}}`, `{{company}}`, `{{host}}`, `{{purpose}}`, `{{visit_date}}`, `{{arrival_time}}`, `{{office_name}}`, `{{from_postcode}}`, `{{transport_mode}}`, `{{distance_km}}`, `{{co2_kg}}`, `{{to_email}}`

If any of the credentials are missing, the email step is silently skipped and the check-in still succeeds.

---

## Admin Modal (Device Settings)

Accessed via the ⚙️ button at the bottom-right of the check-in form. Protected by Supabase admin authentication — must sign in with a `role = 'admin'` account.

**Important:** The admin session is explicitly signed out when the modal closes. This is critical for kiosk security — the check-in screen is shared/public and must never leave an authenticated session running.

Three tabs:
- **Office** — switch which office this terminal is configured for
- **Offices** — add, edit, or remove offices from the global list
- **Email** — configure EmailJS credentials and receptionist email

The Database tab was removed. Supabase credentials are now hardcoded via Netlify environment variables and cannot be changed at runtime.

---

## Deployment

**Auto-deploy pipeline:**
1. Push to `main` branch on GitHub → Netlify detects the push
2. Netlify runs `npm audit --audit-level=critical; npm run build`
3. If `npm audit` finds critical vulnerabilities, the build fails
4. If the build succeeds, `dist/` is published to the Netlify CDN

**To deploy:**
```bash
git add -A
git commit -m "your message"
git push origin main
```

**Netlify dashboard:** netlify.com → SRM Carbon site → Deploys

**Environment variables in Netlify:** Site → Environment Variables → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

---

## Security Headers (netlify.toml)

Applied to all responses via `[[headers]]` in `netlify.toml`:

| Header | Value / Purpose |
|---|---|
| `Strict-Transport-Security` | Force HTTPS, 1-year max-age, preload |
| `X-Frame-Options` | `DENY` — prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` — prevent MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disables camera, microphone, geolocation, payment, USB |
| `Content-Security-Policy` | Whitelists only known origins (postcodes.io, Supabase, EmailJS, Google Fonts) |

The CSP `unsafe-inline` is currently present for scripts and styles. Removing it would require moving all inline styles to CSS classes and implementing CSP nonces — noted as a future hardening task.

---

## Security Decisions Made During Development

### Admin password → Supabase Auth
The original admin modal used a hardcoded password (`SRM-Admin1`). This was replaced with full Supabase Auth — admins must sign in with their email/password and have `role = 'admin'` in `user_profiles`. A non-admin account with valid credentials is rejected and immediately signed out.

### Anon inserts via RLS
Check-in form submissions use the Supabase anon role. Two RLS policies (`anon_insert` + `auth_insert`) plus explicit `GRANT` statements allow this. The anon key cannot read data — only insert visitor logs.

### Client-side office scoping (defence-in-depth)
`VisitorsPage` applies `q.eq('office_name', office)` for non-admins even though Supabase RLS enforces the same restriction server-side. This is redundant by design — two independent layers of access control.

### CSV injection prevention
All values written to CSV are passed through `csvCell()` which prefixes any value starting with `=`, `+`, `-`, `@`, tab, or CR with a single quote. This prevents Excel/Google Sheets from executing values as formulas.

### localStorage input validation
`loadOffices()` validates the shape and sanitises values from localStorage before using them (strips non-alphanumeric chars from postcodes, caps string lengths). This prevents malicious localStorage content from being injected into API requests.

### No raw error messages in production
All `console.error` calls in the application are gated behind `import.meta.env.DEV`. Production builds produce no console output that could leak internal details.

### postcodes.io timeout
`getLatLng()` uses an `AbortController` with a 5-second timeout so a slow or unresponsive API doesn't freeze the UI.

### Generic sign-in errors
`PortalPage.login()` shows "Sign-in failed. Check your email and password." regardless of whether the failure was a wrong password or unknown email — this prevents user enumeration attacks.

---

## Remaining Security Hardening (Future Work)

1. **Rate limiting on anon inserts** — Supabase does not currently rate-limit anonymous inserts to `visitor_logs`. A bad actor could spam the table. Mitigation options: Supabase Edge Function wrapper, Cloudflare Rate Limiting, or a check-in token.

2. **User creation via Edge Function** — `UsersPage` calls `sb.auth.signUp` client-side using the anon key. In Supabase, signUp is open to all by default. If email confirmation is disabled, anyone with the anon key could create accounts. Proper solution: move user creation to a Supabase Edge Function callable only by admins.

3. **CSP nonce / remove unsafe-inline** — The current CSP includes `unsafe-inline` for scripts and styles. This weakens XSS protection. Future fix requires moving inline styles to CSS and implementing nonce-based CSP.

---

## Adding a New Staff User

1. Sign in to the staff portal at `/portal` as an admin
2. Go to Manage Users → Add User
3. Enter name, email, password (8+ chars), role, and office
4. Click Create Account
5. If email confirmation is enabled in Supabase, the user receives a confirmation email

To create the **first admin account** (bootstrap), run this SQL in the Supabase SQL Editor after creating the auth user manually in Authentication → Users:

```sql
insert into user_profiles (id, email, full_name, role, office_name)
values (
  '<auth-user-uuid-from-supabase-dashboard>',
  'admin@srm.com',
  'Admin Name',
  'admin',
  null
);
```

---

## Local Development

```bash
cd SRM-Carbon
npm install
cp .env.example .env   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev            # starts Vite dev server at http://localhost:5173
```

Build for production:
```bash
npm run build          # outputs to dist/
```

---

## Known Constraints / Design Decisions

- **Straight-line distance only** — Haversine calculates crow-flies distance, not road/rail distance. A routing API would give more accurate figures but adds cost and complexity. The current approach is consistent and transparent.

- **No real-time updates** — The visitors table in the portal doesn't auto-refresh. Staff must reload or re-apply the filter to see new check-ins.

- **Kiosk auto-reset** — After a successful check-in, the success screen counts down from 15 seconds and automatically resets the form. The visitor can also tap "← Log another visitor" to reset immediately. The countdown is implemented with `setInterval` in a `useEffect` that fires when `submitted` becomes true, and is cleaned up on unmount or manual reset.

- **LocalStorage for device config** — Office settings, EmailJS credentials, and receptionist emails are stored in the browser's localStorage on each device/terminal. If the browser data is cleared, these must be re-entered via Device Settings. This is intentional — it keeps the configuration on-device for kiosk use.

- **No data deletion UI** — Visitor records cannot be deleted from the portal. This is by design for audit trail purposes. Records can be deleted directly in the Supabase dashboard if required (e.g. for a GDPR erasure request).
