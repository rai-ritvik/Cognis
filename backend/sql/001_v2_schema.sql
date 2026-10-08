-- =====================================================================
-- OmniScan v2 schema upgrade  (run ONCE in Supabase -> SQL Editor)
-- Safe to re-run: every statement is "if not exists" / "drop if exists".
-- =====================================================================

-- STEP A: wipe old TEST data (dummy embeddings, 7-digit roll numbers, old sessions).
-- Order matters because of foreign keys.
delete from spoof_alerts;
delete from attendance;
delete from attendance_logs;
delete from projects;
delete from sessions;
delete from members;

-- STEP B: members -> login + profile columns
alter table members add column if not exists email text;
alter table members add column if not exists password_hash text;
alter table members add column if not exists year text;
alter table members add column if not exists bio text;
alter table members add column if not exists skills text[] not null default '{}';
alter table members add column if not exists linkedin_url text;
alter table members add column if not exists instagram_url text;
alter table members add column if not exists is_removed boolean not null default false;
alter table members alter column email set not null;
alter table members alter column password_hash set not null;
create unique index if not exists members_email_key on members (lower(email));
alter table members drop constraint if exists members_roll_number_format;
alter table members add constraint members_roll_number_format check (roll_number ~ '^[0-9]{13}$');
alter table members drop constraint if exists members_role_check;
alter table members add constraint members_role_check check (role in ('member','admin'));

-- STEP C: sessions -> room-code expiry + one active session at a time
alter table sessions add column if not exists created_at timestamptz not null default now();
alter table sessions add column if not exists current_room_token text;
alter table sessions add column if not exists token_expires_at timestamptz;
alter table sessions add column if not exists previous_room_token text;
alter table sessions add column if not exists previous_valid_until timestamptz;
alter table sessions alter column status set default 'SCHEDULED';
alter table sessions drop constraint if exists sessions_status_check;
alter table sessions add constraint sessions_status_check check (status in ('SCHEDULED','ACTIVE','CLOSED'));
drop index if exists one_active_session;
create unique index one_active_session on sessions ((true)) where status = 'ACTIVE';
create index if not exists sessions_location_gix on sessions using gist (lab_location);

-- STEP D: attendance -> no double check-in, store face score
alter table attendance add column if not exists match_score numeric(5,4);
alter table attendance drop constraint if exists attendance_session_member_key;
alter table attendance add constraint attendance_session_member_key unique (session_id, member_id);
alter table attendance drop constraint if exists attendance_status_check;
alter table attendance add constraint attendance_status_check check (status in ('PRESENT','PENDING_REVIEW','REJECTED'));
create index if not exists attendance_member_idx on attendance (member_id);

-- STEP E: spoof_alerts -> failed / low-confidence attempts with photo
alter table spoof_alerts add column if not exists image_base64 text;
alter table spoof_alerts add column if not exists match_score numeric(5,4);
alter table spoof_alerts add column if not exists details text;
alter table spoof_alerts add column if not exists attendance_id uuid references attendance(id) on delete set null;

-- STEP F: new tables
create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  reason text,
  flagged_by uuid references members(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists flags_member_active on flags (member_id) where active;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  created_by uuid references members(id),
  created_at timestamptz not null default now()
);

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- STEP G: geofence function now uses the session's own radius_m (default 15)
create or replace function verify_location(
  session_id_param uuid,
  student_lat double precision,
  student_lon double precision,
  out is_within_radius boolean,
  out distance_meters double precision
)
language plpgsql as $$
declare
  lab_geog geography;
  allowed integer;
begin
  select lab_location, radius_m into lab_geog, allowed from sessions where id = session_id_param;
  if lab_geog is null then
    is_within_radius := false;
    distance_meters := null;
    return;
  end if;
  distance_meters := ST_Distance(lab_geog, ST_SetSRID(ST_MakePoint(student_lon, student_lat), 4326)::geography);
  is_within_radius := distance_meters <= coalesce(allowed, 15);
end;
$$;

-- STEP H: lock the database. RLS ON + no policies = the public/anon key can read NOTHING.
-- Our backend uses the service key, which bypasses RLS.
alter table members enable row level security;
alter table sessions enable row level security;
alter table attendance enable row level security;
alter table attendance_logs enable row level security;
alter table spoof_alerts enable row level security;
alter table projects enable row level security;
alter table flags enable row level security;
alter table events enable row level security;
alter table password_resets enable row level security;
revoke execute on function verify_location(uuid, double precision, double precision) from public, anon, authenticated;
notify pgrst, 'reload schema'; -- makes Supabase notice the new columns/tables immediately
