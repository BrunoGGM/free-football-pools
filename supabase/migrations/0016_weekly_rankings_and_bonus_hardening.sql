-- Harden streak bonus idempotency.
-- Keep earliest row when duplicated streak bonus reasons exist.
delete from public.quiniela_member_manual_points newer
using public.quiniela_member_manual_points older
where newer.quiniela_id = older.quiniela_id
  and newer.user_id = older.user_id
  and newer.reason = older.reason
  and newer.id > older.id
  and newer.reason like 'streak_bonus_%';

create unique index if not exists idx_qmmp_unique_streak_bonus
  on public.quiniela_member_manual_points(quiniela_id, user_id, reason)
  where reason like 'streak_bonus_%';

create or replace function public.grant_streak_bonus(
  p_user_id uuid,
  p_quiniela_id uuid,
  p_milestone integer,
  p_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if p_points = 0 then
    return;
  end if;

  v_reason := format('streak_bonus_%s', p_milestone);

  insert into public.quiniela_member_manual_points (
    quiniela_id,
    user_id,
    points_delta,
    reason,
    created_by,
    created_at
  )
  values (
    p_quiniela_id,
    p_user_id,
    p_points,
    v_reason,
    p_user_id,
    timezone('utc', now())
  )
  on conflict do nothing;
end;
$$;

-- Weekly rankings materialized table.
create table if not exists public.quiniela_weekly_rankings (
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  rank integer not null,
  weekly_points integer not null default 0,
  exact_hits integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (quiniela_id, user_id, week_start_date),
  constraint quiniela_weekly_rankings_rank_positive check (rank > 0),
  constraint quiniela_weekly_rankings_points_non_negative check (weekly_points >= 0),
  constraint quiniela_weekly_rankings_exact_hits_non_negative check (exact_hits >= 0)
);

create index if not exists idx_qwr_lookup
  on public.quiniela_weekly_rankings(quiniela_id, week_start_date desc, rank);

create index if not exists idx_qwr_week_user
  on public.quiniela_weekly_rankings(week_start_date desc, user_id);

create or replace function public.get_week_start_date(
  p_timestamp timestamptz
)
returns date
language sql
immutable
as $$
  select date_trunc('week', p_timestamp at time zone 'utc')::date;
$$;

create or replace function public.recalculate_weekly_ranking_for_week(
  p_quiniela_id uuid,
  p_week_start_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with weekly_points as (
    select
      p.user_id,
      coalesce(sum(coalesce(p.points_earned, 0)), 0)::integer as weekly_points,
      count(*) filter (where coalesce(p.points_earned, 0) >= 3)::integer as exact_hits
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where p.quiniela_id = p_quiniela_id
      and m.status = 'finished'
      and public.get_week_start_date(m.match_time) = p_week_start_date
    group by p.user_id
  ), ranked as (
    select
      p_quiniela_id as quiniela_id,
      wp.user_id,
      p_week_start_date as week_start_date,
      dense_rank() over (
        order by wp.weekly_points desc, wp.exact_hits desc, wp.user_id
      )::integer as rank,
      wp.weekly_points,
      wp.exact_hits,
      timezone('utc', now()) as updated_at
    from weekly_points wp
  )
  insert into public.quiniela_weekly_rankings (
    quiniela_id,
    user_id,
    week_start_date,
    rank,
    weekly_points,
    exact_hits,
    updated_at
  )
  select
    r.quiniela_id,
    r.user_id,
    r.week_start_date,
    r.rank,
    r.weekly_points,
    r.exact_hits,
    r.updated_at
  from ranked r
  on conflict (quiniela_id, user_id, week_start_date)
  do update set
    rank = excluded.rank,
    weekly_points = excluded.weekly_points,
    exact_hits = excluded.exact_hits,
    updated_at = excluded.updated_at;

  delete from public.quiniela_weekly_rankings qwr
  where qwr.quiniela_id = p_quiniela_id
    and qwr.week_start_date = p_week_start_date
    and not exists (
      select 1
      from public.predictions p
      join public.matches m on m.id = p.match_id
      where p.user_id = qwr.user_id
        and p.quiniela_id = qwr.quiniela_id
        and m.status = 'finished'
        and public.get_week_start_date(m.match_time) = qwr.week_start_date
    );
end;
$$;

create or replace function public.refresh_weekly_ranking_for_match_and_quiniela(
  p_match_id uuid,
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
  v_status public.match_status;
begin
  if p_match_id is null or p_quiniela_id is null then
    return;
  end if;

  select public.get_week_start_date(m.match_time), m.status
  into v_week_start, v_status
  from public.matches m
  where m.id = p_match_id;

  if v_week_start is null or v_status is null or v_status <> 'finished' then
    return;
  end if;

  perform public.recalculate_weekly_ranking_for_week(p_quiniela_id, v_week_start);
end;
$$;

create or replace function public.refresh_weekly_ranking_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_week_start date;
begin
  if new.status <> 'finished' then
    return new;
  end if;

  v_week_start := public.get_week_start_date(new.match_time);

  for v_member in
    select distinct p.quiniela_id
    from public.predictions p
    where p.match_id = new.id
  loop
    perform public.recalculate_weekly_ranking_for_week(v_member.quiniela_id, v_week_start);
  end loop;

  return new;
end;
$$;

create or replace function public.refresh_weekly_ranking_after_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_match_id uuid;
  v_old_match_id uuid;
  v_new_quiniela_id uuid;
  v_old_quiniela_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_match_id := new.match_id;
    v_new_quiniela_id := new.quiniela_id;
  end if;

  if tg_op <> 'INSERT' then
    v_old_match_id := old.match_id;
    v_old_quiniela_id := old.quiniela_id;
  end if;

  perform public.refresh_weekly_ranking_for_match_and_quiniela(
    coalesce(v_new_match_id, v_old_match_id),
    v_new_quiniela_id
  );

  if v_old_quiniela_id is distinct from v_new_quiniela_id then
    perform public.refresh_weekly_ranking_for_match_and_quiniela(
      coalesce(v_new_match_id, v_old_match_id),
      v_old_quiniela_id
    );
  end if;

  if v_old_match_id is distinct from v_new_match_id then
    perform public.refresh_weekly_ranking_for_match_and_quiniela(
      v_old_match_id,
      coalesce(v_old_quiniela_id, v_new_quiniela_id)
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_matches_refresh_weekly_rankings on public.matches;
create trigger tr_matches_refresh_weekly_rankings
after update of home_score, away_score, status
on public.matches
for each row
execute function public.refresh_weekly_ranking_after_match_change();

drop trigger if exists tr_predictions_refresh_weekly_rankings on public.predictions;
create trigger tr_predictions_refresh_weekly_rankings
after insert or update or delete
on public.predictions
for each row
execute function public.refresh_weekly_ranking_after_prediction_change();

alter table public.quiniela_weekly_rankings enable row level security;

drop policy if exists "Authenticated can read weekly rankings" on public.quiniela_weekly_rankings;
create policy "Authenticated can read weekly rankings"
on public.quiniela_weekly_rankings
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

grant select on public.quiniela_weekly_rankings to authenticated;
grant execute on function public.get_week_start_date(timestamptz) to authenticated, anon;
grant execute on function public.recalculate_weekly_ranking_for_week(uuid, date) to authenticated, anon;
grant execute on function public.refresh_weekly_ranking_for_match_and_quiniela(uuid, uuid) to authenticated, anon;

-- Backfill recent 10 ISO weeks.
do $$
declare
  v_qid uuid;
  v_week date;
  v_current_week date := public.get_week_start_date(timezone('utc', now()));
begin
  for v_qid in
    select q.id
    from public.quinielas q
  loop
    for i in 0..9 loop
      v_week := (v_current_week - (i * 7));
      perform public.recalculate_weekly_ranking_for_week(v_qid, v_week);
    end loop;
  end loop;
end;
$$;
