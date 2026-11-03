-- Phase 3, block 3: same couch mode. While someone is visiting another country (or travelling with their
-- partner), their availability, Browse region and Coming soon use the visited country until a date.
-- Language, locale, time zone, services and the daily check keep using their home settings (`country`).
--
-- The app applies the visit in getCurrentProfile() / getPartner(): "until" is inclusive, judged in the
-- visitor's own time zone, so nothing here expires it. A visit ends when both columns are cleared.

alter table public.profiles
  add column visiting_country text check (visiting_country ~ '^[A-Z]{2}$'),
  add column visiting_until date,
  add constraint profiles_visit_complete check ((visiting_country is null) = (visiting_until is null));

comment on column public.profiles.visiting_country is
  'ISO 3166-1 code of the country this person is visiting, used instead of country until visiting_until.';
comment on column public.profiles.visiting_until is
  'Last day of the visit (inclusive, in the person''s own time zone).';

-- People set and clear their own visit. The existing "update own profile" policy covers the rows.
grant update (visiting_country, visiting_until) on public.profiles to authenticated;
