-- Local development only (`supabase db reset`). Never pushed to the hosted project.
-- On the hosted project, add your two real emails from the SQL editor instead:
--   insert into public.signup_allowlist (email) values ('you@example.com'), ('partner@example.com');
insert into public.signup_allowlist (email) values
  ('one@example.com'),
  ('two@example.com');
