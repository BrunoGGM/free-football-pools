-- 0036_knockout_penalties_predictions.sql

-- 1. Update quiniela_rules
alter table public.quiniela_rules
add column if not exists extra_time_prediction_points integer not null default 1,
add column if not exists penalty_prediction_points integer not null default 1,
add column if not exists penalty_exact_score_points integer not null default 3;

-- 2. Update matches
alter table public.matches
add column if not exists went_to_extra_time boolean not null default false;

-- 3. Update simulation_match_snapshots
alter table public.simulation_match_snapshots
add column if not exists went_to_extra_time boolean not null default false;

-- 4. Update predictions
alter table public.predictions
add column if not exists predicts_extra_time boolean not null default false,
add column if not exists predicts_penalties boolean not null default false,
add column if not exists home_penalty_score integer,
add column if not exists away_penalty_score integer;

-- 5. Update get_quiniela_rules function
drop function if exists public.get_quiniela_rules(uuid);
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
  streak_bonus_5_points integer,
  extra_time_prediction_points integer,
  penalty_prediction_points integer,
  penalty_exact_score_points integer
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
    coalesce(qr.streak_bonus_5_points, 2) as streak_bonus_5_points,
    coalesce(qr.extra_time_prediction_points, 1) as extra_time_prediction_points,
    coalesce(qr.penalty_prediction_points, 1) as penalty_prediction_points,
    coalesce(qr.penalty_exact_score_points, 3) as penalty_exact_score_points
  from public.quinielas q
  left join public.quiniela_rules qr on qr.quiniela_id = q.id
  where q.id = p_quiniela_id;
$$;

grant execute on function public.get_quiniela_rules(uuid) to authenticated, anon;

-- 6. Update calculate_prediction_points_for_quiniela function (new signature)
create or replace function public.calculate_prediction_points_for_quiniela_v2(
  p_quiniela_id uuid,
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer,
  pred_predicts_extra_time boolean,
  pred_predicts_penalties boolean,
  pred_home_penalty integer,
  pred_away_penalty integer,
  actual_went_to_extra_time boolean,
  actual_home_penalty integer,
  actual_away_penalty integer
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
  v_extra_time_pts integer := 1;
  v_penalty_pred_pts integer := 1;
  v_penalty_exact_pts integer := 3;
  
  v_base_points integer := 0;
  v_extra_points integer := 0;
  
  actual_went_to_penalties boolean := false;
begin
  if predicted_home is null
    or predicted_away is null
    or actual_home is null
    or actual_away is null then
    return 0;
  end if;

  select
    rules.exact_score_points,
    rules.correct_outcome_points,
    rules.extra_time_prediction_points,
    rules.penalty_prediction_points,
    rules.penalty_exact_score_points
  into 
    v_exact_points, 
    v_outcome_points,
    v_extra_time_pts,
    v_penalty_pred_pts,
    v_penalty_exact_pts
  from public.get_quiniela_rules(p_quiniela_id) rules;

  -- 1. Base points (Regular / Extra time goals)
  if predicted_home = actual_home and predicted_away = actual_away then
    v_base_points := greatest(coalesce(v_outcome_points, 1) + coalesce(v_exact_points, 3), 0);
  else
    predicted_outcome := sign(predicted_home - predicted_away);
    actual_outcome := sign(actual_home - actual_away);

    if predicted_outcome = actual_outcome then
      v_base_points := greatest(coalesce(v_outcome_points, 1), 0);
    end if;
  end if;

  -- 2. Extra time points
  if coalesce(actual_went_to_extra_time, false) and coalesce(pred_predicts_extra_time, false) then
    v_extra_points := v_extra_points + coalesce(v_extra_time_pts, 1);
  end if;

  -- 3. Penalties points
  actual_went_to_penalties := (actual_home_penalty is not null and actual_away_penalty is not null);
  
  if actual_went_to_penalties and coalesce(pred_predicts_penalties, false) then
    v_extra_points := v_extra_points + coalesce(v_penalty_pred_pts, 1);
    
    if coalesce(pred_home_penalty, -1) = actual_home_penalty and coalesce(pred_away_penalty, -1) = actual_away_penalty then
      v_extra_points := v_extra_points + coalesce(v_penalty_exact_pts, 3);
    end if;
  end if;

  return v_base_points + v_extra_points;
end;
$$;

grant execute on function public.calculate_prediction_points_for_quiniela_v2(uuid, integer, integer, integer, integer, boolean, boolean, integer, integer, boolean, integer, integer) to authenticated, anon;


-- 7. Update apply_match_scoring trigger
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
  set points_earned = public.calculate_prediction_points_for_quiniela_v2(
        p.quiniela_id,
        p.home_score,
        p.away_score,
        new.home_score,
        new.away_score,
        p.predicts_extra_time,
        p.predicts_penalties,
        p.home_penalty_score,
        p.away_penalty_score,
        new.went_to_extra_time,
        new.home_penalty_score,
        new.away_penalty_score
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


-- 8. Update recalculate_quiniela_scoring
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
          public.calculate_prediction_points_for_quiniela_v2(
            p.quiniela_id,
            p.home_score,
            p.away_score,
            m.home_score,
            m.away_score,
            p.predicts_extra_time,
            p.predicts_penalties,
            p.home_penalty_score,
            p.away_penalty_score,
            m.went_to_extra_time,
            m.home_penalty_score,
            m.away_penalty_score
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

-- Trigger recalculation for all quinielas
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
