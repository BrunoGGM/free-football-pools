create table if not exists public.quiniela_rules (
  quiniela_id uuid primary key references public.quinielas(id) on delete cascade,
  exact_score_points integer not null default 3,
  correct_outcome_points integer not null default 1,
  champion_bonus_points integer not null default 10,
  exact_hit_min_points integer not null default 3,
  streak_hit_min_points integer not null default 1,
  streak_bonus_3_points integer not null default 1,
  streak_bonus_5_points integer not null default 2,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_rules_exact_score_range check (exact_score_points between 1 and 20),
  constraint quiniela_rules_outcome_score_range check (correct_outcome_points between 0 and 20),
  constraint quiniela_rules_champion_bonus_range check (champion_bonus_points between 0 and 100),
  constraint quiniela_rules_exact_hit_min_range check (exact_hit_min_points between 1 and 20),
  constraint quiniela_rules_streak_hit_min_range check (streak_hit_min_points between 1 and 20),
  constraint quiniela_rules_streak_bonus_3_range check (streak_bonus_3_points between 0 and 20),
  constraint quiniela_rules_streak_bonus_5_range check (streak_bonus_5_points between 0 and 20),
  constraint quiniela_rules_outcome_le_exact check (correct_outcome_points <= exact_score_points),
  constraint quiniela_rules_exact_hit_le_exact check (exact_hit_min_points <= exact_score_points),
  constraint quiniela_rules_streak_hit_le_exact check (streak_hit_min_points <= exact_score_points)
);

insert into public.quiniela_rules (quiniela_id)
select q.id
from public.quinielas q
where not exists (
  select 1
  from public.quiniela_rules qr
  where qr.quiniela_id = q.id
);

create or replace function public.ensure_quiniela_rules_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quiniela_rules (quiniela_id)
  values (new.id)
  on conflict (quiniela_id)
  do nothing;

  return new;
end;
$$;

drop trigger if exists tr_quinielas_ensure_rules on public.quinielas;
create trigger tr_quinielas_ensure_rules
after insert
on public.quinielas
for each row
execute function public.ensure_quiniela_rules_row();

create or replace function public.get_quiniela_rules(
  p_quiniela_id uuid
)
returns table (
  exact_score_points integer,
  correct_outcome_points integer,
  champion_bonus_points integer,
  exact_hit_min_points integer,
  streak_hit_min_points integer,
  streak_bonus_3_points integer,
  streak_bonus_5_points integer
)
language sql
stable
as $$
  select
    coalesce(qr.exact_score_points, 3) as exact_score_points,
    coalesce(qr.correct_outcome_points, 1) as correct_outcome_points,
    coalesce(qr.champion_bonus_points, 10) as champion_bonus_points,
    coalesce(qr.exact_hit_min_points, 3) as exact_hit_min_points,
    coalesce(qr.streak_hit_min_points, 1) as streak_hit_min_points,
    coalesce(qr.streak_bonus_3_points, 1) as streak_bonus_3_points,
    coalesce(qr.streak_bonus_5_points, 2) as streak_bonus_5_points
  from public.quinielas q
  left join public.quiniela_rules qr on qr.quiniela_id = q.id
  where q.id = p_quiniela_id;
$$;

create or replace function public.calculate_prediction_points_for_quiniela(
  p_quiniela_id uuid,
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
)
returns integer
language plpgsql
stable
as $$
declare
  predicted_outcome integer;
  actual_outcome integer;
  v_exact_points integer := 3;
  v_outcome_points integer := 1;
begin
  if predicted_home is null
    or predicted_away is null
    or actual_home is null
    or actual_away is null then
    return 0;
  end if;

  select
    rules.exact_score_points,
    rules.correct_outcome_points
  into v_exact_points, v_outcome_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  if predicted_home = actual_home and predicted_away = actual_away then
    return coalesce(v_exact_points, 3);
  end if;

  predicted_outcome := sign(predicted_home - predicted_away);
  actual_outcome := sign(actual_home - actual_away);

  if predicted_outcome = actual_outcome then
    return coalesce(v_outcome_points, 1);
  end if;

  return 0;
end;
$$;

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
  v_champion_bonus_points integer := 10;
begin
  select coalesce(sum(p.points_earned), 0)
  into v_points
  from public.predictions p
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id;

  select rules.champion_bonus_points
  into v_champion_bonus_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  select
    case
      when q.champion_team is null then 0
      when qm.predicted_champion is null then 0
      when qm.champion_predicted_at is null then 0
      when qm.champion_predicted_at >= q.start_date then 0
      when lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team)) then coalesce(v_champion_bonus_points, 10)
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

create or replace function public.apply_match_scoring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_member record;
begin
  if new.status <> 'finished' then
    return new;
  end if;

  if new.home_score is null or new.away_score is null then
    return new;
  end if;

  update public.predictions p
  set points_earned = public.calculate_prediction_points_for_quiniela(
        p.quiniela_id,
        p.home_score,
        p.away_score,
        new.home_score,
        new.away_score
      ),
      updated_at = timezone('utc', now())
  where p.match_id = new.id;

  for v_user in
    select distinct p.user_id
    from public.predictions p
    where p.match_id = new.id
  loop
    for v_member in
      select qm.quiniela_id
      from public.quiniela_members qm
      where qm.user_id = v_user.user_id
    loop
      perform public.recalculate_member_total_points(v_user.user_id, v_member.quiniela_id);
    end loop;
  end loop;

  return new;
end;
$$;

create or replace function public.recalculate_member_streak(
  p_user_id uuid,
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_running integer := 0;
  v_best integer := 0;
  v_points integer;
  v_streak_hit_min_points integer := 1;
begin
  select rules.streak_hit_min_points
  into v_streak_hit_min_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  for v_points in
    select coalesce(p.points_earned, 0)::integer
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where p.user_id = p_user_id
      and p.quiniela_id = p_quiniela_id
      and m.status = 'finished'
    order by m.match_time asc, m.id asc
  loop
    if v_points >= coalesce(v_streak_hit_min_points, 1) then
      v_running := v_running + 1;
      v_best := greatest(v_best, v_running);
    else
      v_running := 0;
    end if;
  end loop;

  insert into public.quiniela_member_streaks (
    quiniela_id,
    user_id,
    current_streak,
    best_streak,
    updated_at
  )
  values (
    p_quiniela_id,
    p_user_id,
    v_running,
    v_best,
    timezone('utc', now())
  )
  on conflict (quiniela_id, user_id)
  do update set
    current_streak = excluded.current_streak,
    best_streak = greatest(public.quiniela_member_streaks.best_streak, excluded.best_streak),
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.award_member_achievements(
  p_user_id uuid,
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_streak integer := 0;
  v_exact_hits integer := 0;
  v_rank integer;
  v_champion_hit boolean := false;
  v_exact_hit_min_points integer := 3;
  v_streak_bonus_3 integer := 1;
  v_streak_bonus_5 integer := 2;
begin
  select
    rules.exact_hit_min_points,
    rules.streak_bonus_3_points,
    rules.streak_bonus_5_points
  into v_exact_hit_min_points, v_streak_bonus_3, v_streak_bonus_5
  from public.get_quiniela_rules(p_quiniela_id) rules;

  select coalesce(qms.current_streak, 0)
  into v_current_streak
  from public.quiniela_member_streaks qms
  where qms.user_id = p_user_id
    and qms.quiniela_id = p_quiniela_id;

  if v_current_streak >= 3 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'streak_3',
      jsonb_build_object('current_streak', v_current_streak)
    );

    perform public.grant_streak_bonus(
      p_user_id,
      p_quiniela_id,
      3,
      coalesce(v_streak_bonus_3, 1)
    );
  end if;

  if v_current_streak >= 5 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'streak_5',
      jsonb_build_object('current_streak', v_current_streak)
    );

    perform public.grant_streak_bonus(
      p_user_id,
      p_quiniela_id,
      5,
      coalesce(v_streak_bonus_5, 2)
    );
  end if;

  select count(*)::integer
  into v_exact_hits
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id
    and m.status = 'finished'
    and coalesce(p.points_earned, 0) >= coalesce(v_exact_hit_min_points, 3);

  if v_exact_hits >= 3 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'exact_3',
      jsonb_build_object('exact_hits', v_exact_hits)
    );
  end if;

  select qr.rank
  into v_rank
  from public.quiniela_rankings qr
  where qr.user_id = p_user_id
    and qr.quiniela_id = p_quiniela_id;

  if v_rank is not null and v_rank <= 3 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'top_3',
      jsonb_build_object('rank', v_rank)
    );
  end if;

  if v_rank = 1 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'leader_1',
      jsonb_build_object('rank', v_rank)
    );
  end if;

  select (
    q.champion_team is not null
    and qm.predicted_champion is not null
    and qm.champion_predicted_at is not null
    and qm.champion_predicted_at < q.start_date
    and lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team))
  )
  into v_champion_hit
  from public.quiniela_members qm
  join public.quinielas q on q.id = qm.quiniela_id
  where qm.user_id = p_user_id
    and qm.quiniela_id = p_quiniela_id;

  if coalesce(v_champion_hit, false) then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'champion_hit'
    );
  end if;
end;
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
declare
  v_exact_hit_min_points integer := 3;
begin
  select rules.exact_hit_min_points
  into v_exact_hit_min_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  with weekly_points as (
    select
      p.user_id,
      coalesce(sum(coalesce(p.points_earned, 0)), 0)::integer as weekly_points,
      count(*) filter (
        where coalesce(p.points_earned, 0) >= coalesce(v_exact_hit_min_points, 3)
      )::integer as exact_hits
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

create or replace function public.recalculate_quiniela_scoring(
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_week date;
begin
  update public.predictions p
  set points_earned = case
        when m.status = 'finished' and m.home_score is not null and m.away_score is not null then
          public.calculate_prediction_points_for_quiniela(
            p.quiniela_id,
            p.home_score,
            p.away_score,
            m.home_score,
            m.away_score
          )
        else 0
      end,
      updated_at = timezone('utc', now())
  from public.matches m
  where p.match_id = m.id
    and p.quiniela_id = p_quiniela_id;

  for v_member in
    select qm.user_id
    from public.quiniela_members qm
    where qm.quiniela_id = p_quiniela_id
  loop
    perform public.recalculate_member_total_points(v_member.user_id, p_quiniela_id);
    perform public.refresh_member_gamification(v_member.user_id, p_quiniela_id);
  end loop;

  perform public.recalculate_quiniela_ranking(p_quiniela_id);

  for v_week in
    select distinct public.get_week_start_date(m.match_time)
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where p.quiniela_id = p_quiniela_id
      and m.status = 'finished'
  loop
    perform public.recalculate_weekly_ranking_for_week(p_quiniela_id, v_week);
  end loop;

  delete from public.quiniela_weekly_rankings qwr
  where qwr.quiniela_id = p_quiniela_id
    and not exists (
      select 1
      from public.predictions p
      join public.matches m on m.id = p.match_id
      where p.quiniela_id = p_quiniela_id
        and m.status = 'finished'
        and public.get_week_start_date(m.match_time) = qwr.week_start_date
    );
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'predictions_points_range'
      and conrelid = 'public.predictions'::regclass
  ) then
    alter table public.predictions
    drop constraint predictions_points_range;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'predictions_points_non_negative'
      and conrelid = 'public.predictions'::regclass
  ) then
    alter table public.predictions
    add constraint predictions_points_non_negative
    check (points_earned >= 0);
  end if;
end;
$$;

drop trigger if exists tr_quiniela_rules_set_updated_at on public.quiniela_rules;
create trigger tr_quiniela_rules_set_updated_at
before update on public.quiniela_rules
for each row
execute function public.set_updated_at();

alter table public.quiniela_rules enable row level security;

drop policy if exists "Authenticated can read quiniela rules" on public.quiniela_rules;
create policy "Authenticated can read quiniela rules"
on public.quiniela_rules
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

grant select on public.quiniela_rules to authenticated;
grant execute on function public.get_quiniela_rules(uuid) to authenticated, anon;
grant execute on function public.calculate_prediction_points_for_quiniela(uuid, integer, integer, integer, integer) to authenticated, anon;
grant execute on function public.recalculate_quiniela_scoring(uuid) to authenticated, anon;

do $$
declare
  v_qid uuid;
begin
  for v_qid in
    select q.id
    from public.quinielas q
  loop
    perform public.recalculate_quiniela_scoring(v_qid);
  end loop;
end;
$$;
