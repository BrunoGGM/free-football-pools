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

  -- Recalculo inmediato solo para predicciones reales; las de prueba se recalculan en lote.
  for v_user in
    select distinct p.user_id
    from public.predictions p
    where p.match_id = new.id
      and coalesce(p.is_test_record, false) = false
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

create or replace function public.recalculate_after_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_member record;
begin
  if tg_op = 'INSERT' and coalesce(new.is_test_record, false) then
    return new;
  end if;

  if tg_op = 'DELETE' and coalesce(old.is_test_record, false) then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(new.is_test_record, false)
    and coalesce(old.is_test_record, false) then
    return new;
  end if;

  v_user_id := coalesce(new.user_id, old.user_id);

  for v_member in
    select qm.quiniela_id
    from public.quiniela_members qm
    where qm.user_id = v_user_id
  loop
    perform public.recalculate_member_total_points(v_user_id, v_member.quiniela_id);
  end loop;

  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_weekly_ranking_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_week_start date;
begin
  if new.status <> 'finished' then
    return new;
  end if;

  v_week_start := public.get_week_start_date(new.match_time);

  -- Evita trabajo extra por datos de prueba durante simulaciones masivas.
  for v_member in
    select distinct p.quiniela_id
    from public.predictions p
    where p.match_id = new.id
      and coalesce(p.is_test_record, false) = false
  loop
    perform public.recalculate_weekly_ranking_for_week(v_member.quiniela_id, v_week_start);
  end loop;

  return new;
end;
$$;

create or replace function public.refresh_weekly_ranking_after_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_match_id uuid;
  v_old_match_id uuid;
  v_new_quiniela_id uuid;
  v_old_quiniela_id uuid;
begin
  if tg_op = 'INSERT' and coalesce(new.is_test_record, false) then
    return new;
  end if;

  if tg_op = 'DELETE' and coalesce(old.is_test_record, false) then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(new.is_test_record, false)
    and coalesce(old.is_test_record, false) then
    return new;
  end if;

  if tg_op <> 'DELETE' then
    v_new_match_id := new.match_id;
    v_new_quiniela_id := new.quiniela_id;
  end if;

  if tg_op <> 'INSERT' then
    v_old_match_id := old.match_id;
    v_old_quiniela_id := old.quiniela_id;
  end if;

  perform public.refresh_weekly_ranking_for_match_and_quiniela(
    coalesce(v_new_match_id, v_old_match_id),
    v_new_quiniela_id
  );

  if v_old_quiniela_id is distinct from v_new_quiniela_id then
    perform public.refresh_weekly_ranking_for_match_and_quiniela(
      coalesce(v_new_match_id, v_old_match_id),
      v_old_quiniela_id
    );
  end if;

  if v_old_match_id is distinct from v_new_match_id then
    perform public.refresh_weekly_ranking_for_match_and_quiniela(
      v_old_match_id,
      coalesce(v_old_quiniela_id, v_new_quiniela_id)
    );
  end if;

  return coalesce(new, old);
end;
$$;
