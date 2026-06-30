-- Drop old signatures
drop function if exists public.calculate_prediction_points_for_quiniela_v3(uuid, integer, integer, integer, integer, boolean, boolean, text, boolean, integer, integer, text);
drop function if exists public.calculate_prediction_points_for_quiniela_v3(uuid, integer, integer, integer, integer, boolean, boolean, text, boolean, integer, integer, match_stage);
drop function if exists public.calculate_prediction_points_for_quiniela_v3(uuid, integer, integer, integer, integer, boolean, boolean, text, boolean, boolean, integer, integer, match_stage);

-- Recreate with correct arguments and correct table lookup
create or replace function public.calculate_prediction_points_for_quiniela_v3(
  p_quiniela_id uuid,
  p_pred_home_score integer,
  p_pred_away_score integer,
  p_actual_home_score integer,
  p_actual_away_score integer,
  p_predicts_extra_time boolean,
  p_predicts_penalties boolean,
  p_predicts_qualifier text,
  p_went_to_extra_time boolean,
  p_has_penalties boolean,
  p_actual_home_penalties integer,
  p_actual_away_penalties integer,
  p_stage match_stage
) returns integer as $$
declare
  v_points integer := 0;
  v_max_exact integer;
  v_outcome integer;
  v_et_pts integer;
  v_pen_pts integer;
  v_qual_pts integer;

  v_actual_sign integer;
  v_pred_sign integer;

  v_actual_qualifier text;
  v_is_knockout boolean;
begin
  -- Read from quiniela_rules (NOT quinielas)
  select
    coalesce(qr.exact_score_points, 3),
    coalesce(qr.correct_outcome_points, 1),
    coalesce(qr.extra_time_prediction_points, 1),
    coalesce(qr.penalty_prediction_points, 2),
    coalesce(qr.qualifier_prediction_points, 1)
  into v_max_exact, v_outcome, v_et_pts, v_pen_pts, v_qual_pts
  from public.quiniela_rules qr
  where qr.quiniela_id = p_quiniela_id;

  if not found then
    v_max_exact := 3;
    v_outcome := 1;
    v_et_pts := 1;
    v_pen_pts := 2;
    v_qual_pts := 1;
  end if;

  -- 1. Exact score match (+3 default)
  if p_actual_home_score = p_pred_home_score and p_actual_away_score = p_pred_away_score then
    v_points := v_max_exact;
  else
    -- 2. Correct outcome only (+1 default)
    v_actual_sign := sign(p_actual_home_score - p_actual_away_score);
    v_pred_sign := sign(p_pred_home_score - p_pred_away_score);

    if v_actual_sign = v_pred_sign then
      v_points := v_outcome;
    end if;
  end if;

  -- 3. Knockout bonuses
  v_is_knockout := p_stage in ('round_32', 'round_16', 'quarter_final', 'semi_final', 'third_place', 'final');

  if v_is_knockout then
    -- +1 if predicted extra time and match went to extra time
    if coalesce(p_predicts_extra_time, false) = true and coalesce(p_went_to_extra_time, false) = true then
      v_points := v_points + v_et_pts;
    end if;

    -- +2 if predicted penalties and match had penalties
    if coalesce(p_predicts_penalties, false) = true and coalesce(p_has_penalties, false) = true then
      v_points := v_points + v_pen_pts;
    end if;

    -- Determine actual qualifier
    if p_actual_home_score > p_actual_away_score then
      v_actual_qualifier := 'home';
    elsif p_actual_home_score < p_actual_away_score then
      v_actual_qualifier := 'away';
    else
      -- Draw in 90 min => decided by penalties
      if coalesce(p_has_penalties, false) = true then
        if coalesce(p_actual_home_penalties, 0) > coalesce(p_actual_away_penalties, 0) then
          v_actual_qualifier := 'home';
        else
          v_actual_qualifier := 'away';
        end if;
      end if;
    end if;

    -- +1 if predicted qualifier correctly
    if p_predicts_qualifier is not null and v_actual_qualifier is not null and p_predicts_qualifier = v_actual_qualifier then
      v_points := v_points + v_qual_pts;
    end if;
  end if;

  return v_points;
end;
$$ language plpgsql stable;

grant execute on function public.calculate_prediction_points_for_quiniela_v3(uuid, integer, integer, integer, integer, boolean, boolean, text, boolean, boolean, integer, integer, match_stage) to authenticated, anon;


-- Re-create trigger function to pass correct args
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
  set points_earned = public.calculate_prediction_points_for_quiniela_v3(
        p.quiniela_id,
        p.home_score,
        p.away_score,
        new.home_score,
        new.away_score,
        p.predicts_extra_time,
        p.predicts_penalties,
        p.predicts_qualifier,
        coalesce(new.went_to_extra_time, false),
        (new.home_penalty_score is not null),
        coalesce(new.home_penalty_score, 0),
        coalesce(new.away_penalty_score, 0),
        new.stage
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


-- Re-create recalculate function too
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
          public.calculate_prediction_points_for_quiniela_v3(
            p.quiniela_id,
            p.home_score,
            p.away_score,
            m.home_score,
            m.away_score,
            p.predicts_extra_time,
            p.predicts_penalties,
            p.predicts_qualifier,
            coalesce(m.went_to_extra_time, false),
            (m.home_penalty_score is not null),
            coalesce(m.home_penalty_score, 0),
            coalesce(m.away_penalty_score, 0),
            m.stage
          )
        else 0
      end,
      updated_at = timezone('utc', now())
  from public.matches m
  where p.match_id = m.id
    and p.quiniela_id = p_quiniela_id;

  for v_member in
    select user_id
    from public.quiniela_members
    where quiniela_id = p_quiniela_id
  loop
    perform public.recalculate_member_total_points(v_member.user_id, p_quiniela_id);
  end loop;

  for v_week in
    select distinct match_time::date
    from public.matches m
    join public.predictions p on p.match_id = m.id
    where p.quiniela_id = p_quiniela_id
  loop
    perform public.calculate_weekly_ranking(p_quiniela_id, v_week);
  end loop;
end;
$$;
