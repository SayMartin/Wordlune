create or replace function public.handle_new_user()
returns trigger as $$
declare
  proposed_name text;
  avatar_url text;
begin
  -- 1. Try to get name from metadata
  proposed_name := new.raw_user_meta_data->>'full_name';
  avatar_url := new.raw_user_meta_data->>'avatar_url';
  
  -- 2. Fallback if null
  if proposed_name is null or proposed_name = '' then
    proposed_name := 'Player_' || substr(new.id::text, 1, 8);
  end if;

  -- 3. Insert with avatar
  insert into public.player_profiles (id, display_name, avatar_url, metadata)
  values (new.id, proposed_name, avatar_url, '{"level": 1}');
  
  return new;
exception 
  when unique_violation then
    -- Fallback for duplicate names
    insert into public.player_profiles (id, display_name, avatar_url, metadata)
    values (new.id, 'Player_' || substr(md5(random()::text), 1, 8), avatar_url, '{"level": 1}');
    return new;
end;
$$ language plpgsql security definer;
