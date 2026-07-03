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
    v_points := v_outcome + v_max_exact;
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
        coalesce(p.predicts_qualifier, p.predicts_penalty_winner),
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

drop function if exists public.admin_preview_quiniela_recalculation(uuid);

create or replace function public.admin_preview_quiniela_recalculation(
  p_quiniela_id uuid
)
returns table (
  user_id uuid,
  username text,
  automatic_points_before integer,
  manual_points integer,
  total_points_before integer,
  rank_before integer,
  automatic_points_after integer,
  total_points_after integer,
  rank_after integer,
  delta_points integer
)
language sql
security definer
set search_path = public
as $$
  with base_members as (
    select
      qm.quiniela_id,
      qm.user_id,
      coalesce(qm.total_points, 0)::integer as automatic_points_current
    from public.quiniela_members qm
    where qm.quiniela_id = p_quiniela_id
  ),
  manual_points_by_user as (
    select
      adj.quiniela_id,
      adj.user_id,
      coalesce(sum(adj.points_delta), 0)::integer as manual_points
    from public.quiniela_member_manual_points adj
    where adj.quiniela_id = p_quiniela_id
    group by adj.quiniela_id, adj.user_id
  ),
  current_rankings as (
    select
      qr.quiniela_id,
      qr.user_id,
      qr.rank,
      qr.automatic_points,
      qr.manual_points,
      qr.total_points
    from public.quiniela_rankings qr
    where qr.quiniela_id = p_quiniela_id
  ),
  before_points as (
    select
      bm.quiniela_id,
      bm.user_id,
      coalesce(cr.automatic_points, bm.automatic_points_current, 0)::integer as automatic_points_before,
      coalesce(cr.manual_points, mp.manual_points, 0)::integer as manual_points,
      coalesce(
        cr.total_points,
        greatest(
          coalesce(cr.automatic_points, bm.automatic_points_current, 0)::integer +
          coalesce(cr.manual_points, mp.manual_points, 0)::integer,
          0
        )
      )::integer as total_points_before
    from base_members bm
    left join current_rankings cr
      on cr.quiniela_id = bm.quiniela_id
     and cr.user_id = bm.user_id
    left join manual_points_by_user mp
      on mp.quiniela_id = bm.quiniela_id
     and mp.user_id = bm.user_id
  ),
  before_ranked as (
    select
      bp.*,
      dense_rank() over (
        partition by bp.quiniela_id
        order by bp.total_points_before desc, bp.user_id
      )::integer as rank_before
    from before_points bp
  ),
  champion_bonus_rule as (
    select
      coalesce(rules.champion_bonus_points, 10)::integer as champion_bonus_points,
      public.champion_pick_lock_time() as lock_time
    from public.get_quiniela_rules(p_quiniela_id) rules
  ),
  final_winner as (
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
      end as winner
    from public.matches m
    where m.stage = 'final'
      and m.status = 'finished'
      and m.home_score is not null
      and m.away_score is not null
    order by m.match_time desc, m.updated_at desc, m.id desc
    limit 1
  ),
  automatic_after_base as (
    select
      bm.quiniela_id,
      bm.user_id,
      coalesce(sum(
        case
          when m.status = 'finished'
            and m.home_score is not null
            and m.away_score is not null then
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
              coalesce(p.predicts_qualifier, p.predicts_penalty_winner),
              coalesce(m.went_to_extra_time, false),
              (m.home_penalty_score is not null),
              coalesce(m.home_penalty_score, 0),
              coalesce(m.away_penalty_score, 0),
              m.stage
            )
          else 0
        end
      ), 0)::integer as prediction_points_after
    from base_members bm
    left join public.predictions p
      on p.quiniela_id = bm.quiniela_id
     and p.user_id = bm.user_id
    left join public.matches m
      on m.id = p.match_id
    group by bm.quiniela_id, bm.user_id
  ),
  custom_points_by_user as (
    select
      bm.quiniela_id,
      bm.user_id,
      coalesce(sum(cp.points), 0)::integer as custom_points
    from base_members bm
    left join public.quiniela_custom_pick_answers a
      on a.quiniela_id = bm.quiniela_id
     and a.user_id = bm.user_id
     and a.is_correct = true
    left join public.quiniela_custom_picks cp
      on cp.id = a.custom_pick_id
    group by bm.quiniela_id, bm.user_id
  ),
  champion_bonus_by_user as (
    select
      bm.quiniela_id,
      bm.user_id,
      case
        when q.champion_team is null then 0
        when fw.winner is null then 0
        when lower(trim(q.champion_team)) <> lower(trim(fw.winner)) then 0
        when qm.predicted_champion is null then 0
        when qm.champion_predicted_at is null then 0
        when cbr.lock_time is not null and qm.champion_predicted_at >= cbr.lock_time then 0
        when lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team)) then cbr.champion_bonus_points
        else 0
      end::integer as champion_bonus_points
    from base_members bm
    join public.quiniela_members qm
      on qm.quiniela_id = bm.quiniela_id
     and qm.user_id = bm.user_id
    join public.quinielas q
      on q.id = bm.quiniela_id
    cross join champion_bonus_rule cbr
    left join final_winner fw
      on true
  ),
  after_points as (
    select
      bm.quiniela_id,
      bm.user_id,
      (
        aab.prediction_points_after +
        coalesce(cpu.custom_points, 0)::integer +
        coalesce(cbu.champion_bonus_points, 0)::integer
      )::integer as automatic_points_after,
      coalesce(mp.manual_points, 0)::integer as manual_points,
      greatest(
        (
          aab.prediction_points_after +
          coalesce(cpu.custom_points, 0)::integer +
          coalesce(cbu.champion_bonus_points, 0)::integer
        ) + coalesce(mp.manual_points, 0)::integer,
        0
      )::integer as total_points_after
    from base_members bm
    join automatic_after_base aab
      on aab.quiniela_id = bm.quiniela_id
     and aab.user_id = bm.user_id
    left join custom_points_by_user cpu
      on cpu.quiniela_id = bm.quiniela_id
     and cpu.user_id = bm.user_id
    left join champion_bonus_by_user cbu
      on cbu.quiniela_id = bm.quiniela_id
     and cbu.user_id = bm.user_id
    left join manual_points_by_user mp
      on mp.quiniela_id = bm.quiniela_id
     and mp.user_id = bm.user_id
  ),
  after_ranked as (
    select
      ap.*,
      dense_rank() over (
        partition by ap.quiniela_id
        order by ap.total_points_after desc, ap.user_id
      )::integer as rank_after
    from after_points ap
  )
  select
    bm.user_id,
    coalesce(pr.username, 'Jugador')::text as username,
    br.automatic_points_before,
    br.manual_points,
    br.total_points_before,
    br.rank_before,
    ar.automatic_points_after,
    ar.total_points_after,
    ar.rank_after,
    (ar.total_points_after - br.total_points_before)::integer as delta_points
  from base_members bm
  join before_ranked br
    on br.quiniela_id = bm.quiniela_id
   and br.user_id = bm.user_id
  join after_ranked ar
    on ar.quiniela_id = bm.quiniela_id
   and ar.user_id = bm.user_id
  left join public.profiles pr
    on pr.id = bm.user_id
  order by ar.rank_after asc, username asc;
$$;

grant execute on function public.admin_preview_quiniela_recalculation(uuid) to authenticated, anon;

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