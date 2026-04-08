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
  v_final_winner text;
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
      when m.home_score > m.away_score then m.home_team
      when m.home_score < m.away_score then m.away_team
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
