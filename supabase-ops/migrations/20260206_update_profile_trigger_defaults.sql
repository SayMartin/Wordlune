-- Update the trigger function to use specific default metadata for new users
create or replace function public.handle_new_user()
returns trigger as $$
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
$$ language plpgsql security definer;
