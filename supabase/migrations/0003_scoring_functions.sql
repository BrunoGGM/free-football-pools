create or replace function public.calculate_prediction_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
)
returns integer
language plpgsql
immutable
as $$
declare
  predicted_outcome integer;
  actual_outcome integer;
begin
  if predicted_home is null
    or predicted_away is null
    or actual_home is null
    or actual_away is null then
    return 0;
  end if;

  if predicted_home = actual_home and predicted_away = actual_away then
    return 3;
  end if;

  predicted_outcome := sign(predicted_home - predicted_away);
  actual_outcome := sign(actual_home - actual_away);

  if predicted_outcome = actual_outcome then
    return 1;
  end if;

  return 0;
end;
$$;

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
  where p.user_id = p_user_id;

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

create or replace function public.set_champion_prediction_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_date timestamptz;
begin
  select q.start_date
  into v_start_date
  from public.quinielas q
  where q.id = new.quiniela_id;

  if new.predicted_champion is null then
    return new;
  end if;

  if v_start_date is null then
    raise exception 'Quiniela not found for champion prediction';
  end if;

  if timezone('utc', now()) >= v_start_date then
    raise exception 'Champion prediction is locked after quiniela start date';
  end if;

  if tg_op = 'INSERT' then
    new.champion_predicted_at := timezone('utc', now());
    return new;
  end if;

  if tg_op = 'UPDATE' and new.predicted_champion is distinct from old.predicted_champion then
    new.champion_predicted_at := coalesce(old.champion_predicted_at, timezone('utc', now()));
  end if;

  return new;
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
  set points_earned = public.calculate_prediction_points(
        p.home_score,
        p.away_score,
        new.home_score,
        new.away_score
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

create or replace function public.recalculate_after_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_member_total_points(new.user_id, new.quiniela_id);
  return new;
end;
$$;

create or replace function public.recalculate_after_champion_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
begin
  if new.champion_team is not distinct from old.champion_team then
    return new;
  end if;

  for v_member in
    select qm.user_id
    from public.quiniela_members qm
    where qm.quiniela_id = new.id
  loop
    perform public.recalculate_member_total_points(v_member.user_id, new.id);
  end loop;

  return new;
end;
$$;

drop trigger if exists tr_quiniela_members_champion_timestamp on public.quiniela_members;
create trigger tr_quiniela_members_champion_timestamp
before insert or update of predicted_champion
on public.quiniela_members
for each row
execute function public.set_champion_prediction_timestamp();

drop trigger if exists tr_matches_apply_scoring on public.matches;
create trigger tr_matches_apply_scoring
after update of home_score, away_score, status
on public.matches
for each row
execute function public.apply_match_scoring();

drop trigger if exists tr_predictions_recalculate_totals on public.predictions;
create trigger tr_predictions_recalculate_totals
after insert or update or delete
on public.predictions
for each row
execute function public.recalculate_after_prediction_change();

drop trigger if exists tr_quiniela_members_recalculate_totals on public.quiniela_members;
create trigger tr_quiniela_members_recalculate_totals
after insert or update of predicted_champion
on public.quiniela_members
for each row
execute function public.recalculate_after_member_change();

drop trigger if exists tr_quinielas_recalculate_champion_bonus on public.quinielas;
create trigger tr_quinielas_recalculate_champion_bonus
after update of champion_team
on public.quinielas
for each row
execute function public.recalculate_after_champion_set();
