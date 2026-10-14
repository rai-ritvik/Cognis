-- Safe additive migration: the admin review queue needs a durable reviewed flag.
alter table public.spoof_alerts
  add column if not exists reviewed boolean not null default false;
notify pgrst, 'reload schema';
