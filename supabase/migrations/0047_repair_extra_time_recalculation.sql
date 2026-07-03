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
            coalesce(p.predicts_qualifier, p.predicts_penalty_winner),
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