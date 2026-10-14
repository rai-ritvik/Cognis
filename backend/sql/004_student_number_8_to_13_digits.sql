-- Safe migration: align the database constraint with the API's 8-13 digit rule.
-- This migration does not delete or rewrite member records. It aborts before
-- changing the constraint if any existing roll number would violate the rule.
do $$
begin
  if exists (
    select 1 from public.members
    where roll_number is null or roll_number !~ '^[0-9]{8,13}$'
  ) then
    raise exception 'Cannot apply 8-13 digit rule: members contains a roll number outside that format. Review those records first.';
  end if;

  alter table public.members drop constraint if exists members_roll_number_format;
  alter table public.members
    add constraint members_roll_number_format
    check (roll_number ~ '^[0-9]{8,13}$');
end;
$$;
