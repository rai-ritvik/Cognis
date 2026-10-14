-- Safe additive migration for the existing student friend-request UI.
-- This creates only the new table and does not delete or rewrite existing rows.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.members(id) on delete cascade,
  recipient_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (requester_id <> recipient_id),
  constraint friend_requests_pair_unique unique (requester_id, recipient_id)
);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_requester_status_idx
  on public.friend_requests (requester_id, status, created_at desc);

alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from public, anon, authenticated;
notify pgrst, 'reload schema';
