-- Remove weekly pre-match missions feature and its scoring side-effects.

-- Stop mission-related triggers first.
drop trigger if exists tr_predictions_refresh_user_missions on public.predictions;
drop trigger if exists tr_quinielas_seed_missions on public.quinielas;
drop trigger if exists tr_mission_definitions_set_updated_at on public.mission_definitions;
drop trigger if exists tr_quiniela_missions_set_updated_at on public.quiniela_missions;

-- Remove mission RPC/functions.
drop function if exists public.refresh_user_missions_after_prediction_change();
drop function if exists public.claim_user_mission_reward(uuid, text, date);
drop function if exists public.get_user_missions_snapshot(uuid, uuid, date);
drop function if exists public.refresh_user_missions_for_prediction(uuid, uuid, uuid);
drop function if exists public.recalculate_user_missions_for_week(uuid, uuid, date);
drop function if exists public.ensure_quiniela_missions_row();

-- Remove mission bonus points already granted and recompute standings.
do $$
declare
  v_quiniela_id uuid;
begin
  for v_quiniela_id in
    with removed as (
      delete from public.quiniela_member_manual_points
      where reason like 'mission_bonus_%'
      returning quiniela_id
    )
    select distinct quiniela_id
    from removed
  loop
    perform public.recalculate_quiniela_scoring(v_quiniela_id);
  end loop;
end;
$$;

-- Remove mission-only index on manual points.
drop index if exists public.idx_qmmp_unique_mission_bonus;

-- Drop mission data model.
drop table if exists public.user_mission_progress;
drop table if exists public.quiniela_missions;
drop table if exists public.mission_definitions;
