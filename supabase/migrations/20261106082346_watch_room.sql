-- Watch room: a watch night can be watched "here", in the app. Each person opens their own copy of the
-- file in the browser (it never leaves their device); play, pause and positions go between the two
-- screens over a private Realtime channel, `night-room:<watch night id>` (roomTopic() in
-- src/lib/room-rules.ts). Nothing about the room is stored.

alter table public.watch_nights drop constraint watch_nights_method_check;
alter table public.watch_nights
  add constraint watch_nights_method_check check (method in ('here', 'teleparty', 'syncplay', 'other'));

-- Whether a Realtime topic is the watch room of one of your couple's nights. Runs as the caller, so
-- watch_nights' own RLS applies too; the couple check is spelled out anyway.
create function public.is_my_night_room(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.watch_nights w
    where topic = 'night-room:' || w.id::text
      and w.couple_id = (select public.my_couple_id())
  );
$$;

revoke execute on function public.is_my_night_room(text) from public, anon;
grant execute on function public.is_my_night_room(text) to authenticated;

-- Realtime Authorization: a private channel's broadcasts and presence are checked against
-- realtime.messages. Only the members of a night's couple may join (read) or send in its room.
create policy "members join their night's watch room"
on realtime.messages for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select public.is_my_night_room(realtime.topic()))
);

create policy "members send in their night's watch room"
on realtime.messages for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select public.is_my_night_room(realtime.topic()))
);
