-- SRM Carbon Tracker — Azure PostgreSQL schema
-- Run this against a fresh Azure Database for PostgreSQL Flexible Server.
-- psql "postgresql://adminuser:password@YOUR-SERVER.postgres.database.azure.com:5432/srmcarbon?ssl=true" -f schema.sql

-- ── visitor_logs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visitor_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  visitor_name   TEXT        NOT NULL,
  company        TEXT,
  host           TEXT        NOT NULL,
  purpose        TEXT,
  visit_date     DATE        NOT NULL,
  arrival_time   TIME,
  office_name    TEXT        NOT NULL,
  from_postcode  TEXT,
  transport_mode TEXT        CHECK (transport_mode IN (
                               'Petrol car','Diesel car','Electric car',
                               'Train','Bus/Coach','Bike/Walk'
                             )),
  distance_km    NUMERIC(8,2),
  co2_kg         NUMERIC(8,4),

  CONSTRAINT chk_visit_date CHECK (
    visit_date BETWEEN '2020-01-01' AND (CURRENT_DATE + INTERVAL '1 day')
  )
);

CREATE INDEX IF NOT EXISTS idx_vl_visit_date    ON visitor_logs (visit_date);
CREATE INDEX IF NOT EXISTS idx_vl_office_date   ON visitor_logs (office_name, visit_date);
CREATE INDEX IF NOT EXISTS idx_vl_created_at    ON visitor_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_vl_transport     ON visitor_logs (transport_mode);

-- ── user_profiles ─────────────────────────────────────────────────────────────
-- Maps Azure AD identities to portal roles and office assignments.
-- Admins add staff members' SRM email addresses here to grant portal access.
-- azure_oid is populated automatically on first login (no Azure AD admin needed).

CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azure_oid   TEXT UNIQUE,                  -- Azure AD Object ID (populated on first login)
  email       TEXT UNIQUE NOT NULL,         -- SRM Microsoft account email (lowercase)
  full_name   TEXT,
  role        TEXT NOT NULL CHECK (role IN ('receptionist', 'manager', 'admin')),
  office_name TEXT,                         -- NULL for admins (all offices)

  CONSTRAINT chk_office CHECK (
    role = 'admin' OR office_name IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_up_email     ON user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_up_azure_oid ON user_profiles (azure_oid);

-- ── Bootstrap: first admin account ───────────────────────────────────────────
-- Run this once to grant the first admin access. Replace the email with the
-- SRM Microsoft account email of the person who will be the first admin.
-- After they log in via Azure AD, azure_oid will be populated automatically.
--
-- INSERT INTO user_profiles (email, full_name, role, office_name)
-- VALUES ('daniel.cridland@srm.com', 'Daniel Cridland', 'admin', NULL);
