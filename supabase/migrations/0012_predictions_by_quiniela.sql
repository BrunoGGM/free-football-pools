alter table public.predictions
add column if not exists quiniela_id uuid references public.quinielas(id) on delete cascade;

create index if not exists idx_predictions_quiniela_id on public.predictions(quiniela_id);

update public.predictions p
set quiniela_id = source.quiniela_id
from (
  select
    qm.user_id,
    qm.quiniela_id,
    row_number() over (
      partition by qm.user_id
      order by qm.created_at asc, qm.quiniela_id asc
    ) as rn
  from public.quiniela_members qm
) as source
where p.user_id = source.user_id
  and source.rn = 1
  and p.quiniela_id is null;

update public.predictions p
set quiniela_id = source.quiniela_id
from (
  select
    q.admin_id as user_id,
    q.id as quiniela_id,
    row_number() over (
      partition by q.admin_id
      order by q.created_at asc, q.id asc
    ) as rn
  from public.quinielas q
) as source
where p.user_id = source.user_id
  and source.rn = 1
  and p.quiniela_id is null;

update public.predictions p
set quiniela_id = fallback.id
from (
  select q.id
  from public.quinielas q
  order by q.created_at asc, q.id asc
  limit 1
) as fallback
where p.quiniela_id is null;

do $$
begin
  if not exists (select 1 from public.predictions where quiniela_id is null) then
    alter table public.predictions
    alter column quiniela_id set not null;
  end if;
end;
$$;

alter table public.predictions
drop constraint if exists predictions_unique_user_match;

alter table public.predictions
drop constraint if exists predictions_unique_user_match_quiniela;

alter table public.predictions
add constraint predictions_unique_user_match_quiniela
unique (user_id, quiniela_id, match_id);

create or replace function public.recalculate_member_total_points(
  p_user_id uuid,
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer := 0;
  v_bonus integer := 0;
begin
  select coalesce(sum(p.points_earned), 0)
  into v_points
  from public.predictions p
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id;

  select
    case
      when q.champion_team is null then 0
      when qm.predicted_champion is null then 0
      when qm.champion_predicted_at is null then 0
      when qm.champion_predicted_at >= q.start_date then 0
      when lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team)) then 10
      else 0
    end
  into v_bonus
  from public.quiniela_members qm
  join public.quinielas q on q.id = qm.quiniela_id
  where qm.user_id = p_user_id
    and qm.quiniela_id = p_quiniela_id;

  update public.quiniela_members
  set total_points = greatest(v_points + coalesce(v_bonus, 0), 0),
      updated_at = timezone('utc', now())
  where user_id = p_user_id
    and quiniela_id = p_quiniela_id;
end;
$$;

drop policy if exists "Users can read own predictions" on public.predictions;
create policy "Users can read own predictions"
on public.predictions
for select
to authenticated
using (
  auth.uid() = user_id
  and public.is_member_of_quiniela(quiniela_id, auth.uid())
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
);
