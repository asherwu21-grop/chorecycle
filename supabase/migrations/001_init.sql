begin;

create table public.rooms (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null,
  join_code text not null unique check (pg_catalog.char_length(join_code) = 6),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default pg_catalog.now()
);

create table public.members (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  user_id uuid not null references auth.users (id),
  display_name text not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (room_id, user_id)
);

create table public.chores (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  title text not null check (pg_catalog.char_length(title) between 1 and 100),
  description text,
  assignee_id uuid references public.members (id) on delete set null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  completed_by uuid references public.members (id),
  completed_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default pg_catalog.now()
);

-- The members unique constraint already indexes room_id first.
create index rooms_created_by_idx on public.rooms (created_by);
create index members_user_id_idx on public.members (user_id);
create index chores_room_id_idx on public.chores (room_id);
create index chores_assignee_id_idx on public.chores (assignee_id);
create index chores_completed_by_idx on public.chores (completed_by);
create index chores_created_by_idx on public.chores (created_by);

alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.chores enable row level security;

-- Bypass members RLS for this caller-only lookup to avoid recursive policies.
create function public.is_room_member(room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members as m
    where m.room_id = is_room_member.room_id
      and m.user_id = (select auth.uid())
  );
$$;

create policy rooms_select_member
on public.rooms for select to authenticated
using (public.is_room_member(rooms.id));

create policy members_select_room_member
on public.members for select to authenticated
using (public.is_room_member(members.room_id));

create policy chores_select_room_member
on public.chores for select to authenticated
using (public.is_room_member(chores.room_id));

create policy chores_insert_room_member
on public.chores for insert to authenticated
with check (
  public.is_room_member(chores.room_id)
  and (
    chores.assignee_id is null
    or exists (
      select 1 from public.members as assignee
      where assignee.id = chores.assignee_id
        and assignee.room_id = chores.room_id
    )
  )
);

create policy chores_update_room_member
on public.chores for update to authenticated
using (public.is_room_member(chores.room_id))
with check (
  public.is_room_member(chores.room_id)
  and (
    chores.assignee_id is null
    or exists (
      select 1 from public.members as assignee
      where assignee.id = chores.assignee_id
        and assignee.room_id = chores.room_id
    )
  )
);

create policy chores_delete_room_member
on public.chores for delete to authenticated
using (public.is_room_member(chores.room_id));

create function public.create_room(name text, display_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_room public.rooms;
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

  -- Serialize room entry for this user; multiple rooms per user are out of scope.
  perform u.id from auth.users as u where u.id = caller_id for update;
  if exists (select 1 from public.members as m where m.user_id = caller_id) then
    raise exception 'You already belong to a room.';
  end if;

  loop
    insert into public.rooms (name, join_code, created_by)
    values (
      pg_catalog.btrim(create_room.name),
      pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6)),
      caller_id
    )
    on conflict (join_code) do nothing
    returning * into new_room;

    -- Retry only a random code collision; other database errors reach the caller.
    exit when found;
  end loop;

  insert into public.members (room_id, user_id, display_name)
  values (new_room.id, caller_id, pg_catalog.btrim(create_room.display_name));

  return new_room;
end;
$$;

create function public.join_room(code text, display_name text)
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
  if join_room.code is null or pg_catalog.char_length(pg_catalog.btrim(join_room.code)) <> 6 then
    raise exception 'Join code must be 6 characters.';
  end if;
  if join_room.display_name is null or pg_catalog.btrim(join_room.display_name) = '' then
    raise exception 'Display name is required.';
  end if;

  perform u.id from auth.users as u where u.id = caller_id for update;
  if exists (select 1 from public.members as m where m.user_id = caller_id) then
    raise exception 'You already belong to a room.';
  end if;

  select r.* into joined_room
  from public.rooms as r
  where r.join_code = pg_catalog.upper(pg_catalog.btrim(join_room.code));

  if not found then
    raise exception 'No room matches that join code.';
  end if;

  insert into public.members (room_id, user_id, display_name)
  values (joined_room.id, caller_id, pg_catalog.btrim(join_room.display_name));

  return joined_room;
end;
$$;

-- Remove inherited defaults, including TRUNCATE, which is not protected by RLS.
revoke all on table public.rooms, public.members, public.chores from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.rooms, public.members to authenticated;
grant select, insert, update, delete on table public.chores to authenticated;

revoke all on function public.is_room_member(uuid) from public, anon, authenticated;
revoke all on function public.create_room(text, text) from public, anon, authenticated;
revoke all on function public.join_room(text, text) from public, anon, authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;

commit;
