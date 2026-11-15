-- The keep-warm job (20261115024858_keep_warm.sql). Run with `npm run db:test`.
begin;
select plan(3);

select ok(
  exists (select 1 from cron.job where jobname = 'keep-warm' and schedule = '*/5 * * * *'),
  'the keep-warm job runs every 5 minutes'
);
select is(public.request_keep_warm(), null::bigint, 'without Vault secrets the keep-warm job does nothing');

set local role authenticated;
select throws_ok($$ select public.request_keep_warm() $$, '42501', null, 'signed-in users cannot call the keep-warm job');

select * from finish();
rollback;
