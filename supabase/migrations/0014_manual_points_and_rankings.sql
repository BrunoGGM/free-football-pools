create table if not exists public.quiniela_member_manual_points (
  id uuid primary key default gen_random_uuid(),
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_delta integer not null,
  reason text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_member_manual_points_delta_non_zero check (points_delta <> 0),
  constraint quiniela_member_manual_points_reason_len check (reason is null or char_length(reason) <= 240)
);

create index if not exists idx_qmmp_quiniela_user
  on public.quiniela_member_manual_points(quiniela_id, user_id);
create index if not exists idx_qmmp_quiniela_created_at
  on public.quiniela_member_manual_points(quiniela_id, created_at desc);

create table if not exists public.quiniela_rankings (
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  automatic_points integer not null default 0,
  manual_points integer not null default 0,
  total_points integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (quiniela_id, user_id),
  constraint quiniela_rankings_rank_positive check (rank > 0)
);

create index if not exists idx_quiniela_rankings_lookup
  on public.quiniela_rankings(quiniela_id, rank, total_points desc, user_id);

create or replace function public.recalculate_quiniela_ranking(
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with base_points as (
    select
      qm.quiniela_id,
      qm.user_id,
      coalesce(qm.total_points, 0)::integer as automatic_points,
      coalesce((
        select sum(adj.points_delta)
        from public.quiniela_member_manual_points adj
        where adj.quiniela_id = qm.quiniela_id
          and adj.user_id = qm.user_id
      ), 0)::integer as manual_points
    from public.quiniela_members qm
    where qm.quiniela_id = p_quiniela_id
  ), ranked as (
    select
      bp.quiniela_id,
      bp.user_id,
      dense_rank() over (
        partition by bp.quiniela_id
        order by greatest(bp.automatic_points + bp.manual_points, 0) desc,
                 bp.user_id
      )::integer as rank,
      bp.automatic_points,
      bp.manual_points,
      greatest(bp.automatic_points + bp.manual_points, 0)::integer as total_points
    from base_points bp
  )
  insert into public.quiniela_rankings (
    quiniela_id,
    user_id,
    rank,
    automatic_points,
    manual_points,
    total_points,
    updated_at
  )
  select
    r.quiniela_id,
    r.user_id,
    r.rank,
    r.automatic_points,
    r.manual_points,
    r.total_points,
    timezone('utc', now())
  from ranked r
  on conflict (quiniela_id, user_id)
  do update set
    rank = excluded.rank,
    automatic_points = excluded.automatic_points,
    manual_points = excluded.manual_points,
    total_points = excluded.total_points,
    updated_at = excluded.updated_at;

  delete from public.quiniela_rankings qr
  where qr.quiniela_id = p_quiniela_id
    and not exists (
      select 1
      from public.quiniela_members qm
      where qm.quiniela_id = qr.quiniela_id
        and qm.user_id = qr.user_id
    );
end;
$$;

create or replace function public.recalculate_ranking_after_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiniela_id uuid;
begin
  v_quiniela_id := coalesce(new.quiniela_id, old.quiniela_id);
  perform public.recalculate_quiniela_ranking(v_quiniela_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.recalculate_ranking_after_manual_points_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiniela_id uuid;
begin
  v_quiniela_id := coalesce(new.quiniela_id, old.quiniela_id);
  perform public.recalculate_quiniela_ranking(v_quiniela_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_quiniela_members_recalculate_ranking on public.quiniela_members;
create trigger tr_quiniela_members_recalculate_ranking
after insert or update of total_points or delete
on public.quiniela_members
for each row
execute function public.recalculate_ranking_after_member_change();

drop trigger if exists tr_qmmp_recalculate_ranking on public.quiniela_member_manual_points;
create trigger tr_qmmp_recalculate_ranking
after insert or update or delete
on public.quiniela_member_manual_points
for each row
execute function public.recalculate_ranking_after_manual_points_change();

alter table public.quiniela_member_manual_points enable row level security;
alter table public.quiniela_rankings enable row level security;

drop policy if exists "Admins can read manual point adjustments" on public.quiniela_member_manual_points;
create policy "Admins can read manual point adjustments"
on public.quiniela_member_manual_points
for select
to authenticated
using (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Admins can insert manual point adjustments" on public.quiniela_member_manual_points;
create policy "Admins can insert manual point adjustments"
on public.quiniela_member_manual_points
for insert
to authenticated
with check (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Authenticated can read quiniela rankings" on public.quiniela_rankings;
create policy "Authenticated can read quiniela rankings"
on public.quiniela_rankings
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

grant execute on function public.recalculate_quiniela_ranking(uuid) to authenticated, anon;

-- Backfill rankings for existing quinielas.
do $$
declare
  v_qid uuid;
begin
  for v_qid in
    select q.id from public.quinielas q
  loop
    perform public.recalculate_quiniela_ranking(v_qid);
  end loop;
end;
$$;
