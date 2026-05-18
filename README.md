# SRM Carbon Tracker

Visitor check-in and travel carbon tracking web application for Sir Robert McAlpine offices across the UK.

Built with React + Vite, hosted on Netlify, backed by Supabase (PostgreSQL + Auth).

---

## Quick start

```bash
npm install
cp .env.example .env        # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                 # http://localhost:5173
```

## Deploy

Push to `main` → Netlify auto-deploys. Environment variables must be set in the Netlify dashboard under **Site → Environment Variables**.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — full technical reference: architecture, schema, RLS policies, role system, deployment, security decisions
- **[TODO.md](./TODO.md)** — open action items and recommendations

## Database

Migrations live in `supabase/migrations/`. Apply to a new project with:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Edge Functions

Server-side functions are in `supabase/functions/`. Deploy with:

```bash
supabase functions deploy check-in
supabase functions deploy create-user
```

See each function's source file for wiring instructions.
