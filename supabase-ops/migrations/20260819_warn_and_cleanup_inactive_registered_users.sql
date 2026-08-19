-- Registered (non-anonymous) accounts that go dormant are never cleaned up
-- today — only guest accounts are (see 20260818_cleanup_anonymous_users.sql).
-- This adds two policies for registered users, split by email verification:
--
--   * email-verified: warn after 6 months of inactivity, delete 14 days
--     after that warning if they still haven't signed back in.
--   * never email-verified: delete straight away, no warning, 14 days after
--     signup — an unconfirmed signup isn't a real account yet (can't sign
--     in as that identity in any meaningful way), so there's nothing to
--     warn about losing, same reasoning as the no-warning anonymous cleanup.
--
-- Two-step design (warn, then cleanup) for the verified path rather than one
-- job, so the warning and the deletion are independently re-runnable/
-- inspectable, and so a player who logs back in during the 14-day grace
-- period is automatically un-marked (see step 3a's UPDATE) instead of being
-- deleted anyway.
--
-- Email sending goes straight from Postgres via pg_net to the Resend API
-- (https://resend.com) — no Edge Function in between, since this repo has
-- no existing supabase/functions setup to hang one off of. If you already
-- use a different provider (Postmark/SendGrid/your own SMTP), swap the
-- net.http_post call in step 4 for that provider's API and adjust the
-- Authorization header / payload shape accordingly.

-- 1. Track warning state on player_profiles (not auth.users, which is
--    Supabase-managed schema you shouldn't add columns to). NULL = never
--    warned (or warned-then-came-back and reset, see step 2).
alter table public.player_profiles
  add column if not exists deletion_warned_at timestamptz;

comment on column public.player_profiles.deletion_warned_at is
  'Set when warn_inactive_registered_users() emails this (registered) player about upcoming account deletion. Cleared automatically if they sign back in. NULL = not currently pending deletion.';

-- 2. pg_net for outbound HTTP from Postgres, and Vault for the Resend API
--    key — never hardcode a real API key in a migration file, since these
--    live in a git history forever. After running this migration, set the
--    actual key once via the SQL editor — reuse the existing "wordse-mail"
--    Resend API key (Resend dashboard -> API keys), don't create a new one:
--
--      select vault.create_secret('re_the_wordse_mail_key_value', 'resend_api_key', 'Resend API key for transactional email (account-deletion warnings) — the "wordse-mail" key from the Resend dashboard');
--
--    Vault is enabled by default on Supabase projects; pg_net needs enabling
--    like pg_cron below (Database -> Extensions, or the line below if you
--    have the privileges).
create extension if not exists pg_net with schema extensions;

-- 3. The warning function. Two passes:
--    a) un-mark anyone previously warned who has since signed back in, so a
--       future dormant spell can trigger a fresh warning instead of them
--       silently staying marked-for-deletion forever;
--    b) email + mark anyone newly past the inactivity threshold.
create or replace function public.warn_inactive_registered_users(inactive_after interval default interval '6 months')
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  warned_count integer;
  api_key text;
  r record;
  subject text;
  body text;
begin
  -- 2a. Reset anyone who logged back in since being warned.
  update public.player_profiles p
  set deletion_warned_at = null
  from auth.users u
  where u.id = p.id
    and p.deletion_warned_at is not null
    and u.is_anonymous = false
    and u.last_sign_in_at is not null
    and u.last_sign_in_at > p.deletion_warned_at;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if api_key is null then
    raise exception 'warn_inactive_registered_users: no resend_api_key secret in Vault — see step 2 comment in 20260819_warn_and_cleanup_inactive_registered_users.sql';
  end if;

  warned_count := 0;

  for r in
    select u.id, u.email, p.display_name, coalesce(p.metadata->>'language', 'en') as lang
    from auth.users u
    join public.player_profiles p on p.id = u.id
    where u.is_anonymous = false
      and u.email is not null
      and u.email_confirmed_at is not null
      and p.deletion_warned_at is null
      and coalesce(u.last_sign_in_at, u.created_at) < now() - inactive_after
  loop
    subject := case r.lang
      when 'sv' then 'Ditt Wordse-konto raderas snart'
      when 'fr' then E'Votre compte Wordse sera bientôt supprimé'
      else 'Your Wordse account will be deleted soon'
    end;
    body := case r.lang
      when 'sv' then
        '<p>Hej ' || coalesce(r.display_name, 'spelare') || ',</p>' ||
        E'<p>Ditt Wordse-konto har varit inaktivt i över 6 månader. Om du inte loggar in inom 14 dagar kommer kontot och all tillhörande data (poäng, historik) att raderas permanent.</p>' ||
        E'<p>Logga bara in någon gång så avbryts raderingen automatiskt.</p>'
      when 'fr' then
        '<p>Bonjour ' || coalesce(r.display_name, 'joueur') || ',</p>' ||
        E'<p>Votre compte Wordse est inactif depuis plus de 6 mois. Si vous ne vous reconnectez pas sous 14 jours, le compte et toutes les données associées (scores, historique) seront supprimés définitivement.</p>' ||
        E'<p>Reconnectez-vous simplement pour annuler la suppression.</p>'
      else
        '<p>Hi ' || coalesce(r.display_name, 'player') || ',</p>' ||
        '<p>Your Wordse account has been inactive for over 6 months. If you don''t sign in within the next 14 days, the account and all its data (scores, history) will be permanently deleted.</p>' ||
        '<p>Just sign in any time before then to cancel the deletion.</p>'
    end;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Wordse <noreply@appfinningar.se>',
        'to', array[r.email],
        'subject', subject,
        'html', body
      )
    );

    update public.player_profiles set deletion_warned_at = now() where id = r.id;
    warned_count := warned_count + 1;
  end loop;

  return warned_count;
end;
$$;

comment on function public.warn_inactive_registered_users(interval) is
  'Emails (via Resend, through pg_net) any registered player inactive for longer than inactive_after (default 6 months) and not already warned, then marks them via player_profiles.deletion_warned_at. Un-marks anyone who signed back in since a previous warning. Scheduled daily via pg_cron below.';

-- 4. The cleanup function — mirrors cleanup_anonymous_users() but only
--    deletes accounts that were warned AND are still inactive AND the
--    14-day grace period has elapsed since the warning.
create or replace function public.cleanup_inactive_registered_users(grace_period interval default interval '14 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with stale_registered as (
    select p.id
    from public.player_profiles p
    join auth.users u on u.id = p.id
    where u.is_anonymous = false
      and u.email_confirmed_at is not null
      and p.deletion_warned_at is not null
      and p.deletion_warned_at < now() - grace_period
      and coalesce(u.last_sign_in_at, u.created_at) < p.deletion_warned_at
  )
  delete from auth.users
  where id in (select id from stale_registered);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.cleanup_inactive_registered_users(interval) is
  'Deletes registered auth.users accounts that were warned by warn_inactive_registered_users() and remained inactive for grace_period (default 14 days) after the warning. Cascades to player_profiles, game_scores, challenge_attempts/results, and duel_matches. Scheduled daily via pg_cron below.';

-- 5. Unverified registered accounts: no warning email (nothing confirmed to
--    warn on), just delete 14 days after signup if the address was never
--    confirmed. Mirrors cleanup_anonymous_users()'s no-warning shape.
create or replace function public.cleanup_unverified_registered_users(stale_after interval default interval '14 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with stale_unverified as (
    select id from auth.users
    where is_anonymous = false
      and email_confirmed_at is null
      and created_at < now() - stale_after
  )
  delete from auth.users
  where id in (select id from stale_unverified);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.cleanup_unverified_registered_users(interval) is
  'Deletes registered auth.users accounts whose email was never confirmed, stale_after (default 14 days) after signup — no warning email, since an unconfirmed signup has nothing to lose access to. Cascades to player_profiles, game_scores, challenge_attempts/results, and duel_matches. Scheduled daily via pg_cron below.';

-- 6. Schedule all three. Staggered after the existing anonymous-cleanup job
--    (03:00 UTC) so none of them contend for the same minute.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'warn-inactive-registered-users',
  '0 2 * * *', -- daily at 02:00 UTC
  $$ select public.warn_inactive_registered_users(); $$
);

select cron.schedule(
  'cleanup-inactive-registered-users',
  '0 4 * * *', -- daily at 04:00 UTC
  $$ select public.cleanup_inactive_registered_users(); $$
);

select cron.schedule(
  'cleanup-unverified-registered-users',
  '0 5 * * *', -- daily at 05:00 UTC
  $$ select public.cleanup_unverified_registered_users(); $$
);
