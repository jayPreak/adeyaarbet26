-- Allow authenticated users to insert their own profile row.
-- This is needed as a fallback when the on_auth_user_created trigger
-- hasn't run (e.g. existing auth users before the trigger was deployed).
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);
