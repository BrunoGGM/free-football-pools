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
begin
  select coalesce(sum(p.points_earned), 0)
  into v_points
  from public.predictions p
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id;

  select
    case
      when q.champion_team is null then 0
      when qm.predicted_champion is null then 0
      when qm.champion_predicted_at is null then 0
      when qm.champion_predicted_at >= q.start_date then 0
      when lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team)) then 10
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
