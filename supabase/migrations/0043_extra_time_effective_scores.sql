alter table public.matches
add column if not exists home_extra_time_score integer;

alter table public.matches
add column if not exists away_extra_time_score integer;

alter table public.matches
drop constraint if exists matches_extra_time_scores_non_negative;

alter table public.matches
add constraint matches_extra_time_scores_non_negative check (
  (home_extra_time_score is null or home_extra_time_score >= 0)
  and (away_extra_time_score is null or away_extra_time_score >= 0)
);

update public.matches
set
  home_extra_time_score = coalesce(home_extra_time_score, home_score),
  away_extra_time_score = coalesce(away_extra_time_score, away_score)
where coalesce(went_to_extra_time, false) = true
  and home_score is not null
  and away_score is not null
  and home_extra_time_score is null
  and away_extra_time_score is null;

create or replace function public.effective_match_home_score(
  p_home_score integer,
  p_home_extra_time_score integer,
  p_away_extra_time_score integer,
  p_went_to_extra_time boolean
) returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_went_to_extra_time, false) = true
      and p_home_extra_time_score is not null
      and p_away_extra_time_score is not null
      then p_home_extra_time_score
    else p_home_score
  end
$$;

create or replace function public.effective_match_away_score(
  p_away_score integer,
  p_home_extra_time_score integer,
  p_away_extra_time_score integer,
  p_went_to_extra_time boolean
) returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_went_to_extra_time, false) = true
      and p_home_extra_time_score is not null
      and p_away_extra_time_score is not null
      then p_away_extra_time_score
    else p_away_score
  end
$$;

drop function if exists public.calculate_prediction_points_for_quiniela_v4(uuid, integer, integer, integer, integer, integer, integer, boolean, boolean, text, boolean, boolean, integer, integer, match_stage);

create or replace function public.calculate_prediction_points_for_quiniela_v4(
  p_quiniela_id uuid,
  p_pred_home_score integer,
  p_pred_away_score integer,
  p_regular_home_score integer,
  p_regular_away_score integer,
  p_final_home_score integer,
  p_final_away_score integer,
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
  v_regular_sign integer;
  v_pred_sign integer;
  v_actual_qualifier text;
  v_is_knockout boolean;
begin
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

  if p_regular_home_score = p_pred_home_score and p_regular_away_score = p_pred_away_score then
    v_points := v_max_exact;
  else
    v_regular_sign := sign(p_regular_home_score - p_regular_away_score);
    v_pred_sign := sign(p_pred_home_score - p_pred_away_score);

    if v_regular_sign = v_pred_sign then
      v_points := v_outcome;
    end if;
  end if;

  v_is_knockout := p_stage in ('round_32', 'round_16', 'quarter_final', 'semi_final', 'third_place', 'final');

  if v_is_knockout then
    if coalesce(p_predicts_extra_time, false) = true and coalesce(p_went_to_extra_time, false) = true then
      v_points := v_points + v_et_pts;
    end if;

    if coalesce(p_predicts_penalties, false) = true and coalesce(p_has_penalties, false) = true then
      v_points := v_points + v_pen_pts;
    end if;

    if p_final_home_score > p_final_away_score then
      v_actual_qualifier := 'home';
    elsif p_final_home_score < p_final_away_score then
      v_actual_qualifier := 'away';
    elsif coalesce(p_has_penalties, false) = true then
      if coalesce(p_actual_home_penalties, 0) > coalesce(p_actual_away_penalties, 0) then
        v_actual_qualifier := 'home';
      elsif coalesce(p_actual_home_penalties, 0) < coalesce(p_actual_away_penalties, 0) then
        v_actual_qualifier := 'away';
      end if;
    end if;

    if p_predicts_qualifier is not null and v_actual_qualifier is not null and p_predicts_qualifier = v_actual_qualifier then
      v_points := v_points + v_qual_pts;
    end if;
  end if;

  return v_points;
end;
$$ language plpgsql stable;

grant execute on function public.calculate_prediction_points_for_quiniela_v4(uuid, integer, integer, integer, integer, integer, integer, boolean, boolean, text, boolean, boolean, integer, integer, match_stage) to authenticated, anon;

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
  v_custom_points integer := 0;
  v_champion_bonus_points integer := 10;
  v_final_winner text;
  v_lock_time timestamptz;
begin
  select coalesce(sum(p.points_earned), 0)
  into v_points
  from public.predictions p
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id;

  select rules.champion_bonus_points
  into v_champion_bonus_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  v_lock_time := public.champion_pick_lock_time();

  select
    case
      when public.effective_match_home_score(
        m.home_score,
        m.home_extra_time_score,
        m.away_extra_time_score,
        m.went_to_extra_time
      ) > public.effective_match_away_score(
        m.away_score,
        m.home_extra_time_score,
        m.away_extra_time_score,
        m.went_to_extra_time
      ) then m.home_team
      when public.effective_match_home_score(
        m.home_score,
        m.home_extra_time_score,
        m.away_extra_time_score,
        m.went_to_extra_time
      ) < public.effective_match_away_score(
        m.away_score,
        m.home_extra_time_score,
        m.away_extra_time_score,
        m.went_to_extra_time
      ) then m.away_team
      when m.home_penalty_score is not null
        and m.away_penalty_score is not null
        and m.home_penalty_score > m.away_penalty_score then m.home_team
      when m.home_penalty_score is not null
        and m.away_penalty_score is not null
        and m.home_penalty_score < m.away_penalty_score then m.away_team
      else null
    end
  into v_final_winner
  from public.matches m
  where m.stage = 'final'
    and m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
  order by m.match_time desc, m.updated_at desc, m.id desc
  limit 1;

  select
    case
      when q.champion_team is null then 0
      when v_final_winner is null then 0
      when lower(trim(q.champion_team)) <> lower(trim(v_final_winner)) then 0
      when qm.predicted_champion is null then 0
      when qm.champion_predicted_at is null then 0
      when v_lock_time is not null and qm.champion_predicted_at >= v_lock_time then 0
      when lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team)) then coalesce(v_champion_bonus_points, 10)
      else 0
    end
  into v_bonus
  from public.quiniela_members qm
  join public.quinielas q on q.id = qm.quiniela_id
  where qm.user_id = p_user_id
    and qm.quiniela_id = p_quiniela_id;

  select coalesce(sum(cp.points), 0)
  into v_custom_points
  from public.quiniela_custom_pick_answers a
  join public.quiniela_custom_picks cp on cp.id = a.custom_pick_id
  where a.quiniela_id = p_quiniela_id
    and a.user_id = p_user_id
    and a.is_correct = true;

  update public.quiniela_members
  set total_points = greatest(v_points + coalesce(v_bonus, 0) + coalesce(v_custom_points, 0), 0),
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
    set points_earned = public.calculate_prediction_points_for_quiniela_v4(
        p.quiniela_id,
        p.home_score,
        p.away_score,
      new.home_score,
      new.away_score,
        public.effective_match_home_score(
          new.home_score,
          new.home_extra_time_score,
          new.away_extra_time_score,
          new.went_to_extra_time
        ),
        public.effective_match_away_score(
          new.away_score,
          new.home_extra_time_score,
          new.away_extra_time_score,
          new.went_to_extra_time
        ),
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
          public.calculate_prediction_points_for_quiniela_v4(
            p.quiniela_id,
            p.home_score,
            p.away_score,
            m.home_score,
            m.away_score,
            public.effective_match_home_score(
              m.home_score,
              m.home_extra_time_score,
              m.away_extra_time_score,
              m.went_to_extra_time
            ),
            public.effective_match_away_score(
              m.away_score,
              m.home_extra_time_score,
              m.away_extra_time_score,
              m.went_to_extra_time
            ),
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

drop trigger if exists tr_matches_apply_match_scoring on public.matches;
create trigger tr_matches_apply_match_scoring
after insert or update of home_score, away_score, home_extra_time_score, away_extra_time_score, home_penalty_score, away_penalty_score, status, went_to_extra_time
on public.matches
for each row
execute function public.apply_match_scoring();
