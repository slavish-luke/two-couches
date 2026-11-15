-- Keep warm (2026-11-15): every 5 minutes, ask the app to start the server functions behind its main pages,
-- so the first tap after a quiet spell doesn't wait for a cold start (0.8–1 s measured on the live site).
-- pg_cron → pg_net → POST /api/cron/keep-warm with the same Vault secrets as the daily check (app_url,
-- cron_secret); without them it does nothing. The route asks for each page without a session, so the pages
-- only render signed out and redirect to /login: nothing of the couple's is sent anywhere.

create function public.request_keep_warm()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if app_url is null or secret is null then
    return null;
  end if;

  return net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/keep-warm',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.request_keep_warm() from public, anon, authenticated;

select cron.schedule('keep-warm', '*/5 * * * *', 'select public.request_keep_warm()');
