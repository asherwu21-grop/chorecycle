begin;

create table public.join_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default pg_catalog.now()
);

create index join_attempts_user_id_attempted_at_idx
  on public.join_attempts (user_id, attempted_at);
create index join_attempts_attempted_at_idx on public.join_attempts (attempted_at);

alter table public.join_attempts enable row level security;
revoke all on table public.join_attempts from public, anon, authenticated;

create or replace function public.create_room(name text, display_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_room public.rooms;
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  new_code text;
  random_byte integer;
begin
  if caller_id is null then
    raise exception 'Sign in to create a room.';
  end if;
  if create_room.name is null or pg_catalog.btrim(create_room.name) = '' then
    raise exception 'Room name is required.';
  end if;
  if create_room.display_name is null or pg_catalog.btrim(create_room.display_name) = '' then
    raise exception 'Display name is required.';
  end if;

  perform u.id from auth.users as u where u.id = caller_id for update;
  if exists (select 1 from public.members as m where m.user_id = caller_id) then
    raise exception 'You already belong to a room.';
  end if;

  loop
    new_code := '';
    while pg_catalog.char_length(new_code) < 6 loop
      -- The first UUID byte is fully random (no version/variant bits).
      random_byte := pg_catalog.get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()), 0);
      -- Reject the last eight values so all 31 characters are equally likely.
      if random_byte < 248 then
        new_code := new_code || pg_catalog.substr(alphabet, (random_byte % 31) + 1, 1);
      end if;
    end loop;

    insert into public.rooms (name, join_code, created_by)
    values (pg_catalog.btrim(create_room.name), new_code, caller_id)
    on conflict (join_code) do nothing
    returning * into new_room;

    exit when found;
  end loop;

  insert into public.members (room_id, user_id, display_name)
  values (new_room.id, caller_id, pg_catalog.btrim(create_room.display_name));

  return new_room;
end;
$$;

create or replace function public.join_room(code text, display_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  joined_room public.rooms;
begin
  if caller_id is null then
    raise exception 'Sign in to join a room.';
  end if;

  -- Serialize checks and failed-attempt inserts for concurrent calls by this user.
  perform u.id from auth.users as u where u.id = caller_id for update;
  if (
    select pg_catalog.count(*) from public.join_attempts as a
    where a.user_id = caller_id
      and a.attempted_at >= pg_catalog.now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Too many attempts. Try again in 10 minutes.';
  end if;

  if join_room.code is null or pg_catalog.char_length(pg_catalog.btrim(join_room.code)) <> 6 then
    raise exception 'Join code must be 6 characters.';
  end if;
  if join_room.display_name is null or pg_catalog.btrim(join_room.display_name) = '' then
    raise exception 'Display name is required.';
  end if;
  if exists (select 1 from public.members as m where m.user_id = caller_id) then
    raise exception 'You already belong to a room.';
  end if;

  delete from public.join_attempts as a
  where a.attempted_at < pg_catalog.now() - interval '1 day';

  select r.* into joined_room
  from public.rooms as r
  where r.join_code = pg_catalog.upper(pg_catalog.btrim(join_room.code));

  if not found then
    insert into public.join_attempts (user_id) values (caller_id);
    -- A normal return preserves the failed attempt when the RPC commits.
    return null;
  end if;

  insert into public.members (room_id, user_id, display_name)
  values (joined_room.id, caller_id, pg_catalog.btrim(join_room.display_name));

  return joined_room;
end;
$$;

revoke all on function public.is_room_member(uuid) from public, anon, authenticated;
revoke all on function public.create_room(text, text) from public, anon, authenticated;
revoke all on function public.join_room(text, text) from public, anon, authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;

commit;
