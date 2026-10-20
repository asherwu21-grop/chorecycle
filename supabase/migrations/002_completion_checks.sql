begin;

alter table public.chores
add constraint chores_completion_check check (
  (status = 'pending' and completed_by is null and completed_at is null)
  or (status = 'done' and completed_by is not null and completed_at is not null)
);

drop policy chores_insert_room_member on public.chores;
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
  and (
    chores.completed_by is null
    or exists (
      select 1 from public.members as completer
      where completer.id = chores.completed_by
        and completer.room_id = chores.room_id
    )
  )
);

drop policy chores_update_room_member on public.chores;
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
  and (
    chores.completed_by is null
    or exists (
      select 1 from public.members as completer
      where completer.id = chores.completed_by
        and completer.room_id = chores.room_id
    )
  )
);

commit;
