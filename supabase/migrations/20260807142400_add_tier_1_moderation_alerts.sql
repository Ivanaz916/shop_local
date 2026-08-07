create extension if not exists pg_net with schema extensions;

create or replace function public.notify_tier_1_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alert_url text;
  webhook_secret text;
  event_name text;
  record_id uuid;
begin
  select decrypted_secret
    into alert_url
    from vault.decrypted_secrets
   where name = 'moderation_alert_url';

  select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
   where name = 'moderation_webhook_secret';

  if alert_url is null or webhook_secret is null then
    raise warning 'Tier 1 moderation alert skipped: Vault secrets are not configured';
    return new;
  end if;

  if tg_table_name = 'requests' and tg_op = 'INSERT' then
    event_name := 'request_created';
    record_id := new.id;
  elsif tg_table_name = 'request_replies' and tg_op = 'INSERT' then
    event_name := 'reply_created';
    record_id := new.id;
  elsif tg_table_name = 'requests'
      and tg_op = 'UPDATE'
      and new.flag_count > old.flag_count then
    event_name := 'request_flagged';
    record_id := new.id;
  else
    return new;
  end if;

  perform net.http_post(
    url := alert_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'event', event_name,
      'record_id', record_id,
      'occurred_at', now()
    )
  );

  return new;
exception
  when others then
    raise warning 'Tier 1 moderation alert failed: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists requests_tier_1_moderation_alert on public.requests;
create trigger requests_tier_1_moderation_alert
after insert or update of flag_count on public.requests
for each row execute function public.notify_tier_1_moderation();

drop trigger if exists replies_tier_1_moderation_alert on public.request_replies;
create trigger replies_tier_1_moderation_alert
after insert on public.request_replies
for each row execute function public.notify_tier_1_moderation();
