import { useState } from 'react';
import { createSupabaseClient } from '../../lib/supabase';

export default function TabDb({ onDbChange }) {
  const [url, setUrl] = useState(() => localStorage.getItem('srm_sb_url') || '');
  const [key, setKey] = useState(() => localStorage.getItem('srm_sb_key') || '');
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('srm_sb_url', url.trim());
    localStorage.setItem('srm_sb_key', key.trim());
    onDbChange(createSupabaseClient());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const sql = `create table visitor_logs (id uuid default gen_random_uuid() primary key, created_at timestamptz default now(), visitor_name text, company text, host text, purpose text, visit_date date, arrival_time text, office_name text, from_postcode text, transport_mode text, distance_km numeric, co2_kg numeric);

create table user_profiles (id uuid references auth.users primary key, email text, full_name text, role text check (role in ('receptionist','manager','admin')), office_name text);

alter table visitor_logs enable row level security;
alter table user_profiles enable row level security;

create policy "anon_insert" on visitor_logs for insert to anon, authenticated with check (true);
create policy "role_select" on visitor_logs for select to authenticated using (exists (select 1 from user_profiles p where p.id = auth.uid() and (p.role='admin' or p.office_name=visitor_logs.office_name)));
create policy "own_profile" on user_profiles for select to authenticated using (id=auth.uid());
create policy "admin_profiles" on user_profiles for all to authenticated using (exists (select 1 from user_profiles p where p.id=auth.uid() and p.role='admin'));`;

  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Connects to <strong>Supabase</strong> for secure storage and staff access.{' '}
        <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--fern)' }}>Free project →</a>
      </p>
      <div className="modal-field">
        <label>Supabase Project URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
      </div>
      <div className="modal-field">
        <label>Supabase Anon Key</label>
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="eyJhbGci…" />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6, padding: 10, background: 'var(--cream)', borderRadius: 8 }}>
        Run this SQL in your Supabase project to set up the schema:<br /><br />
        <code style={{ fontSize: 10, lineHeight: 1.8, display: 'block', whiteSpace: 'pre-wrap' }}>{sql}</code>
      </div>
      <button className="modal-btn" onClick={save}>Save &amp; Connect</button>
      {saved && <div className="modal-saved">✅ Database connected</div>}
    </>
  );
}
