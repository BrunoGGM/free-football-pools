-- Streak should be informational and achievement-based only.
-- It must not grant competitive points in rankings.

delete from public.quiniela_member_manual_points
where reason like 'streak_bonus_%';

insert into public.achievement_definitions (code, name, description, icon_emoji, tier)
values
  ('streak_3', 'Racha de 3', 'Acertaste 3 picks consecutivos', '🔥', 1),
  ('streak_5', 'Racha de 5', 'Acertaste 5 picks consecutivos', '🚀', 2),
  ('streak_10', 'Racha de 10', 'Acertaste 10 picks consecutivos', '⚡', 3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon_emoji = excluded.icon_emoji,
  tier = excluded.tier,
  is_active = true;

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
  v_predicted_home integer;
  v_predicted_away integer;
  v_actual_home integer;
  v_actual_away integer;
begin
  for v_predicted_home, v_predicted_away, v_actual_home, v_actual_away in
    select
      p.home_score,
      p.away_score,
      m.home_score,
      m.away_score
    from public.matches m
    left join public.predictions p
      on p.match_id = m.id
      and p.user_id = p_user_id
      and p.quiniela_id = p_quiniela_id
    where m.status = 'finished'
    order by m.match_time asc, m.id asc
  loop
    if v_predicted_home is not null
      and v_predicted_away is not null
      and v_actual_home is not null
      and v_actual_away is not null
      and sign(v_predicted_home - v_predicted_away) = sign(v_actual_home - v_actual_away) then
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
    best_streak = excluded.best_streak,
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
begin
  select rules.exact_hit_min_points
  into v_exact_hit_min_points
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
  end if;

  if v_current_streak >= 5 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'streak_5',
      jsonb_build_object('current_streak', v_current_streak)
    );
  end if;

  if v_current_streak >= 10 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'streak_10',
      jsonb_build_object('current_streak', v_current_streak)
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

-- Recompute streaks and achievements with the new no-bonus logic.
do $$
declare
  v_member record;
  v_qid uuid;
begin
  for v_member in
    select qm.user_id, qm.quiniela_id
    from public.quiniela_members qm
  loop
    perform public.refresh_member_gamification(v_member.user_id, v_member.quiniela_id);
  end loop;

  for v_qid in
    select q.id
    from public.quinielas q
  loop
    perform public.recalculate_quiniela_ranking(v_qid);
  end loop;
end;
$$;
