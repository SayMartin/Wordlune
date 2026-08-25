


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."append_move"("p_session" "uuid", "p_player" "uuid", "p_payload" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_no int;
  inserted_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session::text)::bigint);

  SELECT COALESCE(MAX(move_no), -1) + 1 INTO next_no
    FROM game_moves WHERE session_id = p_session;

  INSERT INTO game_moves(session_id, player_id, move_no, payload)
  VALUES (p_session, p_player, next_no, p_payload)
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;


ALTER FUNCTION "public"."append_move"("p_session" "uuid", "p_player" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."boards_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes('board:' || COALESCE(NEW.id::text, OLD.id::text), TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."boards_broadcast_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_board_events"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'board:' || COALESCE(NEW.board_id::text, OLD.board_id::text),
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."broadcast_board_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."canonicalize"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
  SELECT regexp_replace(lower(unaccent($1)), '[^\w\s]', '', 'g');
$_$;


ALTER FUNCTION "public"."canonicalize"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_anonymous_users"("stale_after" interval DEFAULT '14 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  deleted_count integer;
begin
  with stale_anonymous as (
    select id from auth.users
    where is_anonymous = true
      and coalesce(last_sign_in_at, created_at) < now() - stale_after
  )
  delete from auth.users
  where id in (select id from stale_anonymous);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_anonymous_users"("stale_after" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_anonymous_users"("stale_after" interval) IS 'Deletes guest (is_anonymous=true) auth.users accounts inactive for longer than stale_after (default 30 days). Cascades to player_profiles, game_scores, and duel_matches. Scheduled daily via pg_cron below.';



CREATE OR REPLACE FUNCTION "public"."cleanup_inactive_registered_users"("grace_period" interval DEFAULT '14 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cleanup_inactive_registered_users"("grace_period" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_inactive_registered_users"("grace_period" interval) IS 'Deletes registered auth.users accounts that were warned by warn_inactive_registered_users() and remained inactive for grace_period (default 14 days) after the warning. Cascades to player_profiles, game_scores, challenge_attempts/results, and duel_matches. Scheduled daily via pg_cron below.';



CREATE OR REPLACE FUNCTION "public"."cleanup_unverified_registered_users"("stale_after" interval DEFAULT '14 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cleanup_unverified_registered_users"("stale_after" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_unverified_registered_users"("stale_after" interval) IS 'Deletes registered auth.users accounts whose email was never confirmed, stale_after (default 14 days) after signup — no warning email, since an unconfirmed signup has nothing to lose access to. Cascades to player_profiles, game_scores, challenge_attempts/results, and duel_matches. Scheduled daily via pg_cron below.';



CREATE OR REPLACE FUNCTION "public"."current_anon_token"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT (auth.jwt() ->> 'anon_token')::text;
  $$;


ALTER FUNCTION "public"."current_anon_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT auth.uid();
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_own_account"() IS 'Self-service account deletion, callable by any authenticated user (guest or registered) via RPC. Deletes auth.users for auth.uid(), cascading into player_profiles/game_scores/challenge_attempts/challenge_results/duel_matches.';



CREATE OR REPLACE FUNCTION "public"."display_name_available"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_name is not null
     and p_name <> ''
     and not exists (
       select 1 from public.player_profiles where display_name = p_name
     );
$$;


ALTER FUNCTION "public"."display_name_available"("p_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."display_name_available"("p_name" "text") IS 'True when p_name is non-empty and not already used as a player_profiles.display_name. Security definer so clients can check availability without being able to read other players'' profile rows. Case-sensitive, matching the unique constraint on display_name.';



CREATE OR REPLACE FUNCTION "public"."game_moves_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes('game_session:' || COALESCE(NEW.session_id::text, OLD.session_id::text), TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."game_moves_broadcast_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."game_sessions_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes('game_session:' || COALESCE(NEW.id::text, OLD.id::text), TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."game_sessions_broadcast_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_anon_id_from_token"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT id FROM public.anonymous_users WHERE session_token = public.current_anon_token() LIMIT 1;
  $$;


ALTER FUNCTION "public"."get_anon_id_from_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_duel_leaderboard"() RETURNS TABLE("player_id" "uuid", "display_name" "text", "avatar_url" "text", "wins" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT
    dm.winner_id AS player_id,
    pp.display_name,
    pp.avatar_url,
    count(dm.id) AS wins
  FROM
    public.duel_matches dm
    JOIN public.player_profiles pp ON dm.winner_id = pp.id
  WHERE
    dm.status = 'finished'::text
    AND dm.winner_id IS NOT NULL
  GROUP BY
    dm.winner_id,
    pp.display_name,
    pp.avatar_url
  ORDER BY wins DESC;
$$;


ALTER FUNCTION "public"."get_duel_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT auth.jwt() ->> 'role';
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$;


ALTER FUNCTION "public"."get_user_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  -- Define the strict default structure requested:
  -- { "level": 1, "settings": { "theme": "dark", "language": "sv", "reduceMotion": false } }
  default_metadata jsonb := '{"level": 1, "settings": {"theme": "dark", "language": "sv", "reduceMotion": false}}'::jsonb;
begin
  insert into public.player_profiles (id, display_name, avatar_url, metadata)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    -- Use the default metadata. 
    -- Note: We generally ignore new.raw_user_meta_data->'metadata' to enforce the default structure on creation,
    -- essentially treating it as the source of truth for new profiles.
    default_metadata
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT (auth.jwt() ->> 'role') = 'admin';
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_board_member"("b_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_users bu WHERE bu.board_id = b_id AND bu.user_id = (SELECT auth.uid())
  );
$$;


ALTER FUNCTION "public"."is_board_member"("b_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."duel_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player1_id" "uuid",
    "player2_id" "uuid",
    "status" "text" DEFAULT 'waiting'::"text",
    "secret_word" "text",
    "winner_id" "uuid",
    "language" "text" DEFAULT 'en'::"text",
    "is_hint_enabled" boolean DEFAULT false,
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'playing'::"text", 'finished'::"text"])))
);


ALTER TABLE "public"."duel_matches" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_duel_match"("p_match_id" "uuid") RETURNS "public"."duel_matches"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  m public.duel_matches;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.duel_matches
     set player2_id = auth.uid(),
         status = 'playing'
   where id = p_match_id
     and status = 'waiting'
     and player2_id is null
     -- Can't duel yourself; without this a player could join their own
     -- invitation and see both boards.
     and player1_id <> auth.uid()
     -- Mirrors the 5-minute window duel_lobby advertises, with slack for a
     -- player who took a moment to click. An abandoned invitation shouldn't
     -- stay joinable forever.
     and created_at > now() - interval '15 minutes'
  returning * into m;

  if m.id is null then
    raise exception 'Match is no longer available';
  end if;

  return m;
end;
$$;


ALTER FUNCTION "public"."join_duel_match"("p_match_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."join_duel_match"("p_match_id" "uuid") IS 'Atomically claims an open duel invitation for the calling player and returns the full match row (including secret_word, which the joiner now legitimately needs). Security definer because duel_matches SELECT is restricted to participants, and before joining the caller is not one. Refuses matches that are already taken, self-created, or older than 15 minutes.';



CREATE OR REPLACE FUNCTION "public"."match_player_names"("p_match_id" "uuid") RETURNS TABLE("id" "uuid", "display_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public.duel_matches m
    where m.id = p_match_id
      and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
  ) then
    raise exception 'Not a participant in this match';
  end if;

  return query
    select p.id, p.display_name
    from public.player_profiles p
    join public.duel_matches m on p.id in (m.player1_id, m.player2_id)
    where m.id = p_match_id;
end;
$$;


ALTER FUNCTION "public"."match_player_names"("p_match_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_player_names"("p_match_id" "uuid") IS 'Display names of both players in a duel, callable only by a participant of that duel. Security definer so it survives the own-row player_profiles lockdown in 20260822.';



CREATE OR REPLACE FUNCTION "public"."normalize_text"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
  SELECT lower(regexp_replace(coalesce(input, ''), '[^\\w\\s]', '', 'g'));
$$;


ALTER FUNCTION "public"."normalize_text"("input" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'in_progress'::"text",
    "progress_index" integer DEFAULT 0,
    "total_score" integer DEFAULT 0,
    "total_duration" integer DEFAULT 0,
    "total_guesses" integer DEFAULT 0,
    CONSTRAINT "challenge_attempts_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'forfeited'::"text"])))
);


ALTER TABLE "public"."challenge_attempts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_challenge_progress"("p_attempt_id" "uuid", "p_score" integer, "p_duration" integer, "p_guesses" integer, "p_new_index" integer, "p_final" boolean) RETURNS "public"."challenge_attempts"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  a public.challenge_attempts;
begin
  update public.challenge_attempts
     set total_score    = coalesce(total_score, 0) + coalesce(p_score, 0),
         total_duration = coalesce(total_duration, 0) + coalesce(p_duration, 0),
         total_guesses  = coalesce(total_guesses, 0) + coalesce(p_guesses, 0),
         progress_index = greatest(coalesce(progress_index, 0), coalesce(p_new_index, 0)),
         status         = case when p_final then 'completed' else status end,
         completed_at   = case when p_final then now() else completed_at end
   where id = p_attempt_id
     and player_id = auth.uid()
     -- Don't reopen or double-count a challenge that's already finished or
     -- been forfeited. Without this a late-arriving request from a
     -- disconnected client could add points after the fact.
     and status = 'in_progress'
  returning * into a;

  if a.id is null then
    raise exception 'Challenge attempt not found, not yours, or no longer in progress';
  end if;

  return a;
end;
$$;


ALTER FUNCTION "public"."record_challenge_progress"("p_attempt_id" "uuid", "p_score" integer, "p_duration" integer, "p_guesses" integer, "p_new_index" integer, "p_final" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_challenge_progress"("p_attempt_id" "uuid", "p_score" integer, "p_duration" integer, "p_guesses" integer, "p_new_index" integer, "p_final" boolean) IS 'Atomically adds one word''s score/duration/guesses to a challenge attempt and advances progress_index monotonically. Replaces a client-side read-modify-write that lost points when two clients (or two browser tabs) reported at the same time. Refuses attempts that are not the caller''s or not in progress.';



CREATE OR REPLACE FUNCTION "public"."subcategories_normalize_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  sne text;
  snv text;
  col_exists boolean;
BEGIN
  sne := NEW.name_en;
  snv := COALESCE(NEW.name_sv, NEW.name_en);

  -- canonical_normalized_en
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subcategories' AND column_name = 'canonical_normalized_en'
  ) INTO col_exists;
  IF col_exists THEN
    NEW.canonical_normalized_en := normalize_text(sne);
  END IF;

  -- canonical_normalized_sv
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subcategories' AND column_name = 'canonical_normalized_sv'
  ) INTO col_exists;
  IF col_exists THEN
    NEW.canonical_normalized_sv := normalize_text(snv);
  END IF;

  -- legacy canonical_normalized
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subcategories' AND column_name = 'canonical_normalized'
  ) INTO col_exists;
  IF col_exists THEN
    NEW.canonical_normalized := normalize_text(sne);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."subcategories_normalize_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suggest_display_name"("p_base" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  max_len constant integer := 15; -- keep in sync with MAX_DISPLAY_NAME_LENGTH
  base text;
  suffix text;
  candidate text;
  counter integer := 1;
begin
  if p_base is null or p_base = '' then
    base := 'Player';
  else
    base := left(p_base, max_len);
  end if;

  if not exists (select 1 from public.player_profiles where display_name = base) then
    return base;
  end if;

  -- Bounded rather than `while true`: a runaway loop inside a security-definer
  -- function is a denial-of-service vector, and 9999 collisions on one base
  -- name is far past anything legitimate.
  while counter < 10000 loop
    suffix := counter::text;
    candidate := left(base, max_len - length(suffix)) || suffix;

    if not exists (select 1 from public.player_profiles where display_name = candidate) then
      return candidate;
    end if;

    counter := counter + 1;
  end loop;

  -- Exhausted: fall back to a random suffix rather than erroring, mirroring
  -- the client's own error fallback.
  return left(base, max_len - 4) || floor(random() * 9000 + 1000)::text;
end;
$$;


ALTER FUNCTION "public"."suggest_display_name"("p_base" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."suggest_display_name"("p_base" "text") IS 'Returns p_base truncated to 15 chars if free, else the first free base+N variant. Security definer so clients never need to read other players'' display names to find one. Port of suggestUniqueDisplayName() in src/supabase/players-repository.ts.';



CREATE OR REPLACE FUNCTION "public"."sync_category_name_on_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name_en IS DISTINCT FROM OLD.name_en THEN
      UPDATE public.words_categories
      SET category_name_en = NEW.name_en
      WHERE category_id = NEW.id;
    END IF;

    IF NEW.name_native IS DISTINCT FROM OLD.name_native THEN
      UPDATE public.words_categories
      SET category_name_native = NEW.name_native
      WHERE category_id = NEW.id;
    END IF;

    IF NEW.name_sv IS DISTINCT FROM OLD.name_sv THEN
      UPDATE public.words_categories
      SET category_name_sv = NEW.name_sv
      WHERE category_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_category_name_on_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_subcategory_name_before_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name_native IS DISTINCT FROM OLD.name_native THEN
      NEW.name_en := NEW.name_native;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_subcategory_name_before_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_subcategory_name_on_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name_native IS DISTINCT FROM OLD.name_native THEN
      NEW.name_en := NEW.name_native;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_subcategory_name_on_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_profile_display_name"("p_id" "uuid", "p_display_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_display_name IS NULL THEN
    UPDATE public.user_profiles SET display_name = NULL, updated_at = now() WHERE id = p_id;
    RETURN;
  END IF;

  INSERT INTO public.user_profiles (id, display_name, created_at, updated_at)
  VALUES (p_id, p_display_name, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_user_profile_display_name"("p_id" "uuid", "p_display_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_profiles_updated_at_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."user_profiles_updated_at_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."warn_inactive_registered_users"("inactive_after" interval DEFAULT '6 mons'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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
      when 'sv' then 'Ditt Wordlune-konto raderas snart'
      when 'fr' then E'Votre compte Wordlune sera bientôt supprimé'
      else 'Your Wordlune account will be deleted soon'
    end;
    body := case r.lang
      when 'sv' then
        '<p>Hej ' || coalesce(r.display_name, 'spelare') || ',</p>' ||
        E'<p>Ditt Wordlune-konto har varit inaktivt i över 6 månader. Om du inte loggar in inom 14 dagar kommer kontot och all tillhörande data (poäng, historik) att raderas permanent.</p>' ||
        E'<p>Logga bara in någon gång så avbryts raderingen automatiskt.</p>'
      when 'fr' then
        '<p>Bonjour ' || coalesce(r.display_name, 'joueur') || ',</p>' ||
        E'<p>Votre compte Wordlune est inactif depuis plus de 6 mois. Si vous ne vous reconnectez pas sous 14 jours, le compte et toutes les données associées (scores, historique) seront supprimés définitivement.</p>' ||
        E'<p>Reconnectez-vous simplement pour annuler la suppression.</p>'
      else
        '<p>Hi ' || coalesce(r.display_name, 'player') || ',</p>' ||
        '<p>Your Wordlune account has been inactive for over 6 months. If you don''t sign in within the next 14 days, the account and all its data (scores, history) will be permanently deleted.</p>' ||
        '<p>Just sign in any time before then to cancel the deletion.</p>'
    end;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Wordlune <noreply@appfinningar.se>',
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


ALTER FUNCTION "public"."warn_inactive_registered_users"("inactive_after" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."warn_inactive_registered_users"("inactive_after" interval) IS 'Emails (via Resend, through pg_net) any registered player inactive for longer than inactive_after (default 6 months) and not already warned, then marks them via player_profiles.deletion_warned_at. Un-marks anyone who signed back in since a previous warning. Scheduled daily via pg_cron below.';



CREATE OR REPLACE FUNCTION "public"."words_subcategories_normalize_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  col_exists boolean;
  sn_en text;
  sn_sv text;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- compute safe values only if columns exist
    -- subcategory_name_en
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'subcategory_name_en'
    ) INTO col_exists;
    IF col_exists THEN
      sn_en := NEW.subcategory_name_en;
    ELSE
      sn_en := NULL;
    END IF;

    -- subcategory_name_sv
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'subcategory_name_sv'
    ) INTO col_exists;
    IF col_exists THEN
      sn_sv := COALESCE(NEW.subcategory_name_sv, sn_en);
    ELSE
      sn_sv := sn_en;
    END IF;

    -- canonical_normalized_en
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'canonical_normalized_en'
    ) INTO col_exists;
    IF col_exists AND sn_en IS NOT NULL THEN
      NEW.canonical_normalized_en := normalize_text(sn_en);
    END IF;

    -- canonical_normalized_sv
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'canonical_normalized_sv'
    ) INTO col_exists;
    IF col_exists AND sn_sv IS NOT NULL THEN
      NEW.canonical_normalized_sv := normalize_text(sn_sv);
    END IF;

    -- legacy canonical_normalized
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'canonical_normalized'
    ) INTO col_exists;
    IF col_exists AND sn_en IS NOT NULL THEN
      NEW.canonical_normalized := normalize_text(sn_en);
    END IF;

    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."words_subcategories_normalize_trigger"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_sv" "text",
    "name_native" "text" NOT NULL,
    "name_fr" "text"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."categories"."name_sv" IS 'Swedish translation';



COMMENT ON COLUMN "public"."categories"."name_native" IS 'canonical';



CREATE TABLE IF NOT EXISTS "public"."challenge_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "total_score" integer NOT NULL,
    "total_duration" integer NOT NULL,
    "total_guesses" integer DEFAULT 0,
    "completed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_public" boolean DEFAULT false
);


ALTER TABLE "public"."challenge_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_public" boolean DEFAULT false,
    "deletion_warned_at" timestamp with time zone
);


ALTER TABLE "public"."player_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."player_profiles"."is_public" IS 'To allow publicising profile and game scores';



COMMENT ON COLUMN "public"."player_profiles"."deletion_warned_at" IS 'Set when warn_inactive_registered_users() emails this (registered) player about upcoming account deletion. Cleared automatically if they sign back in. NULL = not currently pending deletion.';



CREATE OR REPLACE VIEW "public"."challenge_leaderboards" WITH ("security_invoker"='false') AS
 SELECT "cr"."challenge_id",
    "cr"."player_id",
    "pp"."display_name",
    "pp"."avatar_url",
    "max"("cr"."total_score") AS "total_score",
    "min"("cr"."total_duration") AS "total_duration",
    "count"("cr"."id") AS "completions_count",
    "max"("cr"."completed_at") AS "last_completed_at"
   FROM ("public"."challenge_results" "cr"
     JOIN "public"."player_profiles" "pp" ON (("cr"."player_id" = "pp"."id")))
  WHERE ("cr"."is_public" = true)
  GROUP BY "cr"."challenge_id", "cr"."player_id", "pp"."display_name", "pp"."avatar_url";


ALTER VIEW "public"."challenge_leaderboards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitive_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "jsonb",
    "subcategory_ids" "uuid"[],
    "word_ids" "uuid"[] NOT NULL,
    "start_date" timestamp with time zone,
    "difficulty" "text" DEFAULT 'medium'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_five_chars" boolean DEFAULT false
);


ALTER TABLE "public"."competitive_challenges" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."challenge_menu_stats" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."name",
    "c"."description",
    "c"."difficulty",
    "c"."subcategory_ids",
    "count"("ca"."id") FILTER (WHERE ("ca"."status" = 'completed'::"text")) AS "completions_count"
   FROM ("public"."competitive_challenges" "c"
     LEFT JOIN "public"."challenge_attempts" "ca" ON (("c"."id" = "ca"."challenge_id")))
  GROUP BY "c"."id", "c"."name", "c"."description", "c"."difficulty", "c"."subcategory_ids";


ALTER VIEW "public"."challenge_menu_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."duel_leaderboard" WITH ("security_invoker"='false') AS
 SELECT "dm"."winner_id" AS "player_id",
    "pp"."display_name",
    "pp"."avatar_url",
    "count"("dm"."id") AS "wins"
   FROM ("public"."duel_matches" "dm"
     JOIN "public"."player_profiles" "pp" ON (("dm"."winner_id" = "pp"."id")))
  WHERE (("dm"."status" = 'finished'::"text") AND ("dm"."winner_id" IS NOT NULL) AND ("pp"."is_public" = true))
  GROUP BY "dm"."winner_id", "pp"."display_name", "pp"."avatar_url";


ALTER VIEW "public"."duel_leaderboard" OWNER TO "postgres";


COMMENT ON VIEW "public"."duel_leaderboard" IS 'Duel win counts for players who have made their profile public. The is_public gate was added in 20260822; before that every duel winner was listed, including guests who never opted in.';



CREATE OR REPLACE VIEW "public"."duel_lobby" WITH ("security_invoker"='false') AS
 SELECT "dm"."id",
    "dm"."created_at",
    "dm"."player1_id",
    "dm"."status",
    "dm"."language",
    "dm"."is_hint_enabled",
    "p1"."display_name" AS "p1_name"
   FROM ("public"."duel_matches" "dm"
     JOIN "public"."player_profiles" "p1" ON (("p1"."id" = "dm"."player1_id")))
  WHERE (("dm"."status" = 'waiting'::"text") AND ("dm"."created_at" > ("now"() - '00:05:00'::interval)));


ALTER VIEW "public"."duel_lobby" OWNER TO "postgres";


COMMENT ON VIEW "public"."duel_lobby" IS 'Open duel invitations from the last 5 minutes, with player 1''s display name. Deliberately omits secret_word (readable by non-participants through the old raw-table query) and player2_id. Owner rights, so it survives the own-row RLS lockdown in 20260822.';



CREATE TABLE IF NOT EXISTS "public"."game_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid",
    "word" "text" NOT NULL,
    "word_id" "uuid",
    "language" "text" NOT NULL,
    "guesses_count" integer NOT NULL,
    "score" integer DEFAULT 0,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "game_mode" "text" DEFAULT 'practice'::"text",
    "seed" "text",
    "is_always_five_letters" boolean DEFAULT false,
    "max_letters" integer,
    "is_public" boolean DEFAULT false,
    "challenge_id" "uuid",
    "duration_seconds" integer DEFAULT 0
);


ALTER TABLE "public"."game_scores" OWNER TO "postgres";


COMMENT ON COLUMN "public"."game_scores"."word" IS 'The secret word to find';



CREATE OR REPLACE VIEW "public"."leaderboard_entries" WITH ("security_invoker"='false') AS
 SELECT "cr"."id",
    "cr"."player_id",
    "pp"."display_name",
    "pp"."avatar_url",
    "cr"."total_score" AS "score",
    NULL::"text" AS "word",
    "cr"."total_guesses" AS "guesses_count",
    "cr"."completed_at",
    "cr"."challenge_id",
    "cc"."name" AS "challenge_name"
   FROM (("public"."challenge_results" "cr"
     JOIN "public"."player_profiles" "pp" ON (("cr"."player_id" = "pp"."id")))
     JOIN "public"."competitive_challenges" "cc" ON (("cr"."challenge_id" = "cc"."id")))
  WHERE ("cr"."is_public" = true);


ALTER VIEW "public"."leaderboard_entries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."player_history_view" WITH ("security_invoker"='true') AS
 SELECT "gs"."id",
    "gs"."player_id",
    'practice'::"text" AS "mode",
    "gs"."score",
    "gs"."duration_seconds",
    "gs"."word" AS "description",
    "gs"."completed_at"
   FROM "public"."game_scores" "gs"
  WHERE (("gs"."game_mode" = 'practice'::"text") AND ("gs"."player_id" = "auth"."uid"()))
UNION ALL
 SELECT "cr"."id",
    "cr"."player_id",
    'competitive'::"text" AS "mode",
    "cr"."total_score" AS "score",
    "cr"."total_duration" AS "duration_seconds",
    "cc"."name" AS "description",
    "cr"."completed_at"
   FROM ("public"."challenge_results" "cr"
     LEFT JOIN "public"."competitive_challenges" "cc" ON (("cr"."challenge_id" = "cc"."id")))
  WHERE ("cr"."player_id" = "auth"."uid"());


ALTER VIEW "public"."player_history_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."player_history_view" IS 'Combined practice + competitive history for the CALLING player only (auth.uid()). Previously owner-rights with no filter, which let any client read another player''s practice history — including the secret words — by passing ?player_id=eq.<uuid>.';



CREATE TABLE IF NOT EXISTS "public"."staging_import_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "word_native" "text",
    "word_en" "text",
    "word_sv" "text",
    "category_name_native" "text",
    "category_name_en" "text",
    "category_name_sv" "text",
    "subcategory_name_native" "text",
    "subcategory_name_en" "text",
    "subcategory_name_sv" "text",
    "difficulty" smallint,
    "source" "text",
    "created_by" "uuid",
    "is_active" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "word_fr" "text",
    "category_name_fr" "text",
    "subcategory_name_fr" "text"
);


ALTER TABLE "public"."staging_import_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name_native" "text" NOT NULL,
    "name_en" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_sv" "text",
    "canonical_normalized_en" "text",
    "canonical_normalized_sv" "text",
    "canonical_normalized" "text",
    "name_fr" "text"
);


ALTER TABLE "public"."subcategories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subcategories"."name_native" IS 'canonical';



COMMENT ON COLUMN "public"."subcategories"."name_en" IS 'English';



COMMENT ON COLUMN "public"."subcategories"."name_sv" IS 'Swedish translation';



CREATE TABLE IF NOT EXISTS "public"."word_stats" (
    "word_id" "uuid" NOT NULL,
    "plays" bigint DEFAULT 0 NOT NULL,
    "successes" bigint DEFAULT 0 NOT NULL,
    "failures" bigint DEFAULT 0 NOT NULL,
    "last_played_at" timestamp with time zone
);


ALTER TABLE "public"."word_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."words" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "word_en" "text" NOT NULL,
    "difficulty" smallint DEFAULT 1,
    "source" "text",
    "created_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "word_sv" "text",
    "word_native" "text",
    "word_fr" "text"
);


ALTER TABLE "public"."words" OWNER TO "postgres";


COMMENT ON COLUMN "public"."words"."word_sv" IS 'Swedish translation';



COMMENT ON COLUMN "public"."words"."word_native" IS 'canonical';



CREATE TABLE IF NOT EXISTS "public"."words_categories" (
    "word_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL
);


ALTER TABLE "public"."words_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."words_subcategories" (
    "word_id" "uuid" NOT NULL,
    "subcategory_id" "uuid" NOT NULL
);


ALTER TABLE "public"."words_subcategories" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name_en");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_native_key" UNIQUE ("name_native");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_player_id_challenge_id_key" UNIQUE ("player_id", "challenge_id");



ALTER TABLE ONLY "public"."challenge_results"
    ADD CONSTRAINT "challenge_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitive_challenges"
    ADD CONSTRAINT "competitive_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_scores"
    ADD CONSTRAINT "game_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_display_name_key" UNIQUE ("display_name");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_display_name_unique" UNIQUE ("display_name");



ALTER TABLE ONLY "public"."staging_import_rows"
    ADD CONSTRAINT "staging_import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_name_key" UNIQUE ("category_id", "name_native");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_name_key" UNIQUE ("name_native");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."word_stats"
    ADD CONSTRAINT "word_stats_pkey" PRIMARY KEY ("word_id");



ALTER TABLE ONLY "public"."words_categories"
    ADD CONSTRAINT "words_categories_pkey" PRIMARY KEY ("word_id", "category_id");



ALTER TABLE ONLY "public"."words"
    ADD CONSTRAINT "words_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."words_subcategories"
    ADD CONSTRAINT "words_subcategories_pkey" PRIMARY KEY ("word_id", "subcategory_id");



ALTER TABLE ONLY "public"."words"
    ADD CONSTRAINT "words_word_native_key" UNIQUE ("word_native");



CREATE INDEX "idx_categories_lower_name_en" ON "public"."categories" USING "btree" ("lower"("name_en"));



CREATE INDEX "idx_categories_lower_name_native" ON "public"."categories" USING "btree" ("lower"("name_native"));



CREATE INDEX "idx_game_scores_challenge" ON "public"."game_scores" USING "btree" ("challenge_id");



CREATE INDEX "idx_game_scores_mode" ON "public"."game_scores" USING "btree" ("game_mode");



CREATE INDEX "idx_game_scores_player_mode" ON "public"."game_scores" USING "btree" ("player_id", "game_mode");



CREATE INDEX "idx_subcategories_category_id" ON "public"."subcategories" USING "btree" ("category_id");



CREATE INDEX "idx_subcategories_lower_name_en" ON "public"."subcategories" USING "btree" ("lower"("name_en"));



CREATE INDEX "idx_subcategories_lower_name_native" ON "public"."subcategories" USING "btree" ("lower"("name_native"));



CREATE INDEX "idx_words_lower_word_en" ON "public"."words" USING "btree" ("lower"("word_en"));



CREATE INDEX "idx_words_lower_word_native" ON "public"."words" USING "btree" ("lower"("word_native"));



CREATE INDEX "idx_words_word_fr" ON "public"."words" USING "btree" ("word_fr");



CREATE INDEX "ix_words_categories_category_id" ON "public"."words_categories" USING "btree" ("category_id");



CREATE INDEX "ix_words_subcategories_subcategory_id" ON "public"."words_subcategories" USING "btree" ("subcategory_id");



CREATE UNIQUE INDEX "subcategories_name_per_category_key_idx" ON "public"."subcategories" USING "btree" ("name_native", "category_id");



CREATE UNIQUE INDEX "user_profiles_display_name_lower_idx" ON "public"."player_profiles" USING "btree" ("lower"("display_name")) WHERE ("display_name" IS NOT NULL);



CREATE UNIQUE INDEX "words_categories_word_category_key_idx" ON "public"."words_categories" USING "btree" ("word_id", "category_id");



CREATE UNIQUE INDEX "words_subcategories_word_subcategory_key_idx" ON "public"."words_subcategories" USING "btree" ("word_id", "subcategory_id");



CREATE OR REPLACE TRIGGER "categories_name_sync_trigger" AFTER UPDATE OF "name_en", "name_native", "name_sv" ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."sync_category_name_on_update"();



CREATE OR REPLACE TRIGGER "subcategories_name_sync_trigger" AFTER UPDATE OF "name_native" ON "public"."subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."sync_subcategory_name_on_update"();



CREATE OR REPLACE TRIGGER "sync_subcategory_name_before_update" BEFORE UPDATE ON "public"."subcategories" FOR EACH ROW WHEN (("old"."name_native" IS DISTINCT FROM "new"."name_native")) EXECUTE FUNCTION "public"."sync_subcategory_name_before_update"();



CREATE OR REPLACE TRIGGER "trg_subcategories_normalize" BEFORE INSERT OR UPDATE ON "public"."subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."subcategories_normalize_trigger"();



CREATE OR REPLACE TRIGGER "trg_user_profiles_updated_at" BEFORE UPDATE ON "public"."player_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."user_profiles_updated_at_trigger"();



CREATE OR REPLACE TRIGGER "trg_words_subcategories_normalize" BEFORE INSERT OR UPDATE ON "public"."words_subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."words_subcategories_normalize_trigger"();



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."competitive_challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_results"
    ADD CONSTRAINT "challenge_results_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."competitive_challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_results"
    ADD CONSTRAINT "challenge_results_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "duel_matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "duel_matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "duel_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "fk_user_profiles_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words_categories"
    ADD CONSTRAINT "fk_words_categories_category" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words_categories"
    ADD CONSTRAINT "fk_words_categories_word" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words_subcategories"
    ADD CONSTRAINT "fk_words_subcategories_subcategory" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words_subcategories"
    ADD CONSTRAINT "fk_words_subcategories_word" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_scores"
    ADD CONSTRAINT "game_scores_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."competitive_challenges"("id");



ALTER TABLE ONLY "public"."game_scores"
    ADD CONSTRAINT "game_scores_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."duel_matches"
    ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."word_stats"
    ADD CONSTRAINT "word_stats_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words_categories"
    ADD CONSTRAINT "words_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."words_categories"
    ADD CONSTRAINT "words_categories_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words_subcategories"
    ADD CONSTRAINT "words_subcategories_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."words_subcategories"
    ADD CONSTRAINT "words_subcategories_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated can read challenge_results" ON "public"."challenge_results" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can read game_scores" ON "public"."game_scores" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Everyone can read challenges" ON "public"."competitive_challenges" FOR SELECT USING (true);



CREATE POLICY "Players can update their match" ON "public"."duel_matches" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id") OR ("player2_id" IS NULL))) WITH CHECK ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));



CREATE POLICY "Players can view their own matches" ON "public"."duel_matches" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));



CREATE POLICY "Public read access categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Public read access subcategories" ON "public"."subcategories" FOR SELECT USING (true);



CREATE POLICY "Public read access words" ON "public"."words" FOR SELECT USING (true);



CREATE POLICY "Public read access words_categories" ON "public"."words_categories" FOR SELECT USING (true);



CREATE POLICY "Public read access words_subcategories" ON "public"."words_subcategories" FOR SELECT USING (true);



CREATE POLICY "Users can create matches" ON "public"."duel_matches" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "player1_id"));



CREATE POLICY "Users can delete own challenge results" ON "public"."challenge_results" FOR DELETE USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can delete own scores" ON "public"."game_scores" FOR DELETE USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can delete their own matches" ON "public"."duel_matches" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "player1_id"));



CREATE POLICY "Users can insert own attempts" ON "public"."challenge_attempts" FOR INSERT WITH CHECK (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can insert own challenge results" ON "public"."challenge_results" FOR INSERT WITH CHECK (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can insert own profile" ON "public"."player_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own scores" ON "public"."game_scores" FOR INSERT WITH CHECK (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can update own attempts" ON "public"."challenge_attempts" FOR UPDATE USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can update own challenge results" ON "public"."challenge_results" FOR UPDATE USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can update own profile" ON "public"."player_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own scores" ON "public"."game_scores" FOR UPDATE USING (("auth"."uid"() = "player_id")) WITH CHECK (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can view own attempts" ON "public"."challenge_attempts" FOR SELECT USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can view own challenge results" ON "public"."challenge_results" FOR SELECT USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can view own profile" ON "public"."player_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own scores" ON "public"."game_scores" FOR SELECT USING (("auth"."uid"() = "player_id"));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitive_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."duel_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_import_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."words" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."words_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."words_subcategories" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."append_move"("p_session" "uuid", "p_player" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."append_move"("p_session" "uuid", "p_player" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_move"("p_session" "uuid", "p_player" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."boards_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."boards_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."boards_broadcast_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."broadcast_board_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_board_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_board_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."canonicalize"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."canonicalize"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canonicalize"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_anonymous_users"("stale_after" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_anonymous_users"("stale_after" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_anonymous_users"("stale_after" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_inactive_registered_users"("grace_period" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_inactive_registered_users"("grace_period" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_inactive_registered_users"("grace_period" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_unverified_registered_users"("stale_after" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_unverified_registered_users"("stale_after" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_unverified_registered_users"("stale_after" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."current_anon_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."display_name_available"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."display_name_available"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."display_name_available"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."game_moves_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."game_moves_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."game_moves_broadcast_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."game_sessions_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."game_sessions_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."game_sessions_broadcast_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_anon_id_from_token"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_duel_leaderboard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_duel_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_duel_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_duel_leaderboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_board_member"("b_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_board_member"("b_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_board_member"("b_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_board_member"("b_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."duel_matches" TO "anon";
GRANT ALL ON TABLE "public"."duel_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."duel_matches" TO "service_role";



GRANT ALL ON FUNCTION "public"."join_duel_match"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."join_duel_match"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_duel_match"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_player_names"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_player_names"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_player_names"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("input" "text") TO "service_role";



GRANT ALL ON TABLE "public"."challenge_attempts" TO "anon";
GRANT ALL ON TABLE "public"."challenge_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_attempts" TO "service_role";



GRANT ALL ON FUNCTION "public"."record_challenge_progress"("p_attempt_id" "uuid", "p_score" integer, "p_duration" integer, "p_guesses" integer, "p_new_index" integer, "p_final" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_challenge_progress"("p_attempt_id" "uuid", "p_score" integer, "p_duration" integer, "p_guesses" integer, "p_new_index" integer, "p_final" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_challenge_progress"("p_attempt_id" "uuid", "p_score" integer, "p_duration" integer, "p_guesses" integer, "p_new_index" integer, "p_final" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."subcategories_normalize_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."subcategories_normalize_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."subcategories_normalize_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."suggest_display_name"("p_base" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."suggest_display_name"("p_base" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suggest_display_name"("p_base" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_category_name_on_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_category_name_on_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_category_name_on_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_category_name_on_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_subcategory_name_before_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_subcategory_name_before_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_subcategory_name_before_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_subcategory_name_on_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_subcategory_name_on_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_subcategory_name_on_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_subcategory_name_on_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_user_profile_display_name"("p_id" "uuid", "p_display_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_user_profile_display_name"("p_id" "uuid", "p_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_profile_display_name"("p_id" "uuid", "p_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_profile_display_name"("p_id" "uuid", "p_display_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_profiles_updated_at_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_profiles_updated_at_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_profiles_updated_at_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_profiles_updated_at_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."warn_inactive_registered_users"("inactive_after" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."warn_inactive_registered_users"("inactive_after" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."warn_inactive_registered_users"("inactive_after" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."words_subcategories_normalize_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."words_subcategories_normalize_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."words_subcategories_normalize_trigger"() TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_results" TO "anon";
GRANT ALL ON TABLE "public"."challenge_results" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_results" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."player_profiles" TO "anon";
GRANT ALL ON TABLE "public"."player_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."player_profiles" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."challenge_leaderboards" TO "anon";
GRANT ALL ON TABLE "public"."challenge_leaderboards" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_leaderboards" TO "service_role";



GRANT ALL ON TABLE "public"."competitive_challenges" TO "anon";
GRANT ALL ON TABLE "public"."competitive_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."competitive_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_menu_stats" TO "anon";
GRANT ALL ON TABLE "public"."challenge_menu_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_menu_stats" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."duel_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."duel_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."duel_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."duel_lobby" TO "authenticated";
GRANT ALL ON TABLE "public"."duel_lobby" TO "service_role";



GRANT ALL ON TABLE "public"."game_scores" TO "anon";
GRANT ALL ON TABLE "public"."game_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."game_scores" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."leaderboard_entries" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_entries" TO "service_role";



GRANT ALL ON TABLE "public"."player_history_view" TO "anon";
GRANT ALL ON TABLE "public"."player_history_view" TO "authenticated";
GRANT ALL ON TABLE "public"."player_history_view" TO "service_role";



GRANT ALL ON TABLE "public"."staging_import_rows" TO "anon";
GRANT ALL ON TABLE "public"."staging_import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."word_stats" TO "anon";
GRANT ALL ON TABLE "public"."word_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."word_stats" TO "service_role";



GRANT ALL ON TABLE "public"."words" TO "anon";
GRANT ALL ON TABLE "public"."words" TO "authenticated";
GRANT ALL ON TABLE "public"."words" TO "service_role";



GRANT ALL ON TABLE "public"."words_categories" TO "anon";
GRANT ALL ON TABLE "public"."words_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."words_categories" TO "service_role";



GRANT ALL ON TABLE "public"."words_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."words_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."words_subcategories" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








