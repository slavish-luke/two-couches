-- Sprint 27, Motion for two: who last changed a list item or a watch night, so a change arriving live on the
-- other screen can say who made it ("Sam marked it watched") and skip your own. Realtime payloads carry the
-- new row, and these two tables had no column for the person behind an update.
--
-- `updated_by` is set only by a trigger from the signed-in user (auth.uid()); nobody can write it (no insert
-- or update grant), so it can't be spoofed. Changes made without a user (the admin client, cron) leave it null,
-- and the peek stays quiet for those. Policies are unchanged.

alter table public.list_items
  add column updated_by uuid references public.profiles (id) on delete set null;
alter table public.watch_nights
  add column updated_by uuid references public.profiles (id) on delete set null;

-- Both tables have column-level grants: members may read the new column, never write it.
grant select (updated_by) on public.list_items to authenticated;
grant select (updated_by) on public.watch_nights to authenticated;

-- On insert the adder (or the planner) is the actor when there's no user; on update only the signed-in user.
-- answer_night_proposal() is security definer but runs for the answerer, so auth.uid() is still them.
create function public.stamp_list_item_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_by := coalesce(auth.uid(), new.added_by);
  else
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create function public.stamp_watch_night_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_by := coalesce(auth.uid(), new.created_by);
  else
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_list_item_actor() from public, anon, authenticated;
revoke execute on function public.stamp_watch_night_actor() from public, anon, authenticated;

create trigger list_items_stamp_actor
  before insert or update on public.list_items
  for each row execute function public.stamp_list_item_actor();

create trigger watch_nights_stamp_actor
  before insert or update on public.watch_nights
  for each row execute function public.stamp_watch_night_actor();

-- Existing rows keep null (no backfill: an update would bump updated_at and fire the nights' triggers);
-- only changes from now on are shown.
