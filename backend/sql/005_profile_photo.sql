-- Safe additive migration for the existing profile photo editor.
-- Only the signed-in member profile endpoint selects this field; admin list
-- endpoints do not select it. Consider moving photos to private object storage
-- if image volume grows.
alter table public.members
  add column if not exists profile_photo_base64 text;
notify pgrst, 'reload schema';
