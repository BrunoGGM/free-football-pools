alter table public.profiles
add column if not exists is_test_user boolean not null default false;

alter table public.quinielas
add column if not exists has_test_data boolean not null default false;

alter table public.quiniela_members
add column if not exists is_test_record boolean not null default false;

alter table public.predictions
add column if not exists is_test_record boolean not null default false;

create index if not exists idx_profiles_is_test_user
  on public.profiles(is_test_user)
  where is_test_user = true;

create index if not exists idx_quiniela_members_test_lookup
  on public.quiniela_members(quiniela_id, is_test_record);

create index if not exists idx_predictions_test_lookup
  on public.predictions(quiniela_id, is_test_record);

create or replace function public.refresh_quiniela_test_lock(
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_test_data boolean;
begin
  if p_quiniela_id is null then
    return;
  end if;

  select (
    exists (
      select 1
      from public.quiniela_members qm
      where qm.quiniela_id = p_quiniela_id
        and qm.is_test_record = true
    )
    or exists (
      select 1
      from public.predictions p
      where p.quiniela_id = p_quiniela_id
        and p.is_test_record = true
    )
  )
  into v_has_test_data;

  update public.quinielas q
  set has_test_data = coalesce(v_has_test_data, false)
  where q.id = p_quiniela_id;
end;
$$;

create or replace function public.handle_test_lock_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiniela_id uuid;
begin
  v_quiniela_id := coalesce(new.quiniela_id, old.quiniela_id);
  perform public.refresh_quiniela_test_lock(v_quiniela_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_quiniela_members_refresh_test_lock on public.quiniela_members;
create trigger tr_quiniela_members_refresh_test_lock
after insert or update of quiniela_id, is_test_record or delete
on public.quiniela_members
for each row
execute function public.handle_test_lock_refresh();

drop trigger if exists tr_predictions_refresh_test_lock on public.predictions;
create trigger tr_predictions_refresh_test_lock
after insert or update of quiniela_id, is_test_record or delete
on public.predictions
for each row
execute function public.handle_test_lock_refresh();

grant execute on function public.refresh_quiniela_test_lock(uuid) to authenticated, anon;

do $$
declare
  v_qid uuid;
begin
  for v_qid in
    select q.id from public.quinielas q
  loop
    perform public.refresh_quiniela_test_lock(v_qid);
  end loop;
end;
$$;

drop policy if exists "Users can join themselves" on public.quiniela_members;
create policy "Users can join themselves"
on public.quiniela_members
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = quiniela_members.quiniela_id
        and q.has_test_data = false
    )
  )
);

drop policy if exists "Members can update own champion before start" on public.quiniela_members;
create policy "Members can update own champion before start"
on public.quiniela_members
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quinielas q
    where q.id = quiniela_members.quiniela_id
      and timezone('utc', now()) < q.start_date
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = quiniela_members.quiniela_id
        and q.has_test_data = false
    )
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quinielas q
    where q.id = quiniela_members.quiniela_id
      and timezone('utc', now()) < q.start_date
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = quiniela_members.quiniela_id
        and q.has_test_data = false
    )
  )
);

drop policy if exists "Users can create predictions before kickoff" on public.predictions;
create policy "Users can create predictions before kickoff"
on public.predictions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = predictions.quiniela_id
        and q.has_test_data = false
    )
  )
);

drop policy if exists "Users can update predictions before kickoff" on public.predictions;
create policy "Users can update predictions before kickoff"
on public.predictions
for update
to authenticated
using (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = predictions.quiniela_id
        and q.has_test_data = false
    )
  )
)
with check (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = predictions.quiniela_id
        and q.has_test_data = false
    )
  )
);

drop policy if exists "Users can delete predictions before kickoff" on public.predictions;
create policy "Users can delete predictions before kickoff"
on public.predictions
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
  and exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.status = 'pending'
      and m.match_time > timezone('utc', now())
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_test_user = true
    )
    or exists (
      select 1
      from public.quinielas q
      where q.id = predictions.quiniela_id
        and q.has_test_data = false
    )
  )
);
