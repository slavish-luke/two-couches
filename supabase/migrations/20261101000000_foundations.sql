-- Sprint 0: profiles, couples, invite codes, sign-up allowlist and the streaming-service catalogue.
--
-- Access model:
--   * Every table has RLS. A user sees their own profile, their partner's profile and their own couple.
--   * Users can edit only the "settings" columns of their own profile. couple_id changes only through
--     create_couple() / join_couple(), which enforce a two-person limit.
--   * Sign-ups are limited to emails in signup_allowlist (managed from the SQL editor, never from the app).

-- True when Postgres recognises tz as a time zone name, e.g. 'Europe/Paris'.
create function public.is_time_zone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{8}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid references public.couples (id) on delete set null,
  display_name text not null default '' check (char_length(display_name) <= 50),
  -- ISO 3166-1 alpha-2 code, e.g. 'GB'. Also the TMDB watch region.
  country text check (country ~ '^[A-Z]{2}$'),
  language text not null default 'en' check (language ~ '^[a-z]{2}$'),
  time_zone text not null default 'UTC' check (public.is_time_zone(time_zone)),
  -- TMDB watch-provider IDs this person pays for, in their own country.
  services integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_couple_id_idx on public.profiles (couple_id);

-- Streaming services per country, cached from TMDB /watch/providers (refreshed about daily).
create table public.services (
  country text not null check (country ~ '^[A-Z]{2}$'),
  provider_id integer not null,
  name text not null,
  logo_path text,
  display_priority integer not null default 999,
  refreshed_at timestamptz not null default now(),
  primary key (country, provider_id)
);

create table public.signup_allowlist (
  email text primary key check (email = lower(email))
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Rejects any new auth user whose email is not on the allowlist. Fails closed: an empty allowlist
-- means nobody can sign up.
create function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from public.signup_allowlist a where a.email = lower(new.email)) then
    raise exception 'signup_not_allowed';
  end if;
  return new;
end;
$$;

create trigger enforce_signup_allowlist
before insert on auth.users
for each row execute function public.enforce_signup_allowlist();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''), 50)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Couple helpers
-- ---------------------------------------------------------------------------

-- The caller's couple. Security definer so RLS policies can use it without recursing into profiles.
create function public.my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id from public.profiles where id = (select auth.uid());
$$;

create function public.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- 32 symbols without 0/O/1/I, so byte % 32 is unbiased and codes are easy to read aloud.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- Starts a new couple with the caller as its first member and returns the invite code.
create function public.create_couple()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text;
  new_id uuid;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  perform 1 from public.profiles where id = me and couple_id is null for update;
  if not found then
    raise exception 'already_in_couple';
  end if;

  loop
    code := public.new_invite_code();
    begin
      insert into public.couples (invite_code, created_by) values (code, me) returning id into new_id;
      exit;
    exception when unique_violation then
      -- Astronomically unlikely; try another code.
    end;
  end loop;

  update public.profiles set couple_id = new_id where id = me;
  return code;
end;
$$;

-- Adds the caller to the couple with this invite code. A couple holds at most two people.
create function public.join_couple(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  current_couple uuid;
  members integer;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  select id into target
  from public.couples
  where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;
  if target is null then
    raise exception 'invite_not_found';
  end if;

  select couple_id into current_couple from public.profiles where id = me for update;
  if current_couple = target then
    return target;
  elsif current_couple is not null then
    raise exception 'already_in_couple';
  end if;

  select count(*) into members from public.profiles where couple_id = target;
  if members >= 2 then
    raise exception 'couple_full';
  end if;

  update public.profiles set couple_id = target where id = me;
  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.signup_allowlist enable row level security;

revoke all on public.couples, public.profiles, public.services, public.signup_allowlist from anon, authenticated;

grant select on public.couples to authenticated;
grant select on public.services to authenticated;
grant select on public.profiles to authenticated;
-- Only settings columns are writable; couple_id, id and timestamps are not.
grant update (display_name, country, language, time_zone, services) on public.profiles to authenticated;

create policy "members read their couple"
on public.couples for select
to authenticated
using (id = (select public.my_couple_id()));

create policy "read own and partner profile"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (couple_id is not null and couple_id = (select public.my_couple_id()))
);

create policy "update own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "signed-in users read services"
on public.services for select
to authenticated
using (true);

-- signup_allowlist has no policies: only the SQL editor / service role can read or change it.

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_couple_id() to authenticated;
grant execute on function public.is_time_zone(text) to authenticated;
grant execute on function public.create_couple() to authenticated;
grant execute on function public.join_couple(text) to authenticated;

-- Functions created later in public should not be callable by API roles unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
