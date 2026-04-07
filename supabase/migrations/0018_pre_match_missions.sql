create table if not exists public.mission_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  mission_type text not null,
  is_active boolean not null default true,
  default_target_value integer not null default 1,
  default_reward_points integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint mission_definitions_code_len check (char_length(code) between 3 and 64),
  constraint mission_definitions_name_len check (char_length(name) between 3 and 120),
  constraint mission_definitions_target_positive check (default_target_value > 0),
  constraint mission_definitions_reward_non_negative check (default_reward_points >= 0),
  constraint mission_definitions_type_supported check (
    mission_type in (
      'predictions_before_kickoff_weekly'
    )
  )
);

create table if not exists public.quiniela_missions (
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  is_active boolean not null default true,
  target_value integer not null,
  reward_points integer not null,
  display_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (quiniela_id, mission_id),
  constraint quiniela_missions_target_positive check (target_value > 0),
  constraint quiniela_missions_reward_non_negative check (reward_points >= 0)
);

create index if not exists idx_quiniela_missions_active
  on public.quiniela_missions(quiniela_id, is_active, display_order, mission_id);

create table if not exists public.user_mission_progress (
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  period_start_date date not null,
  progress_value integer not null default 0,
  target_value integer not null,
  reward_points integer not null,
  is_completed boolean not null default false,
  is_claimed boolean not null default false,
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (quiniela_id, user_id, mission_id, period_start_date),
  constraint user_mission_progress_progress_non_negative check (progress_value >= 0),
  constraint user_mission_progress_target_positive check (target_value > 0),
  constraint user_mission_progress_reward_non_negative check (reward_points >= 0)
);

create index if not exists idx_ump_user_lookup
  on public.user_mission_progress(user_id, quiniela_id, period_start_date desc, is_claimed);

create unique index if not exists idx_qmmp_unique_mission_bonus
  on public.quiniela_member_manual_points(quiniela_id, user_id, reason)
  where reason like 'mission_bonus_%';

insert into public.mission_definitions (
  code,
  name,
  description,
  mission_type,
  default_target_value,
  default_reward_points,
  is_active
)
values
  (
    'prekickoff_3',
    'Madrugador',
    'Registra 3 predicciones antes del inicio del partido esta semana.',
    'predictions_before_kickoff_weekly',
    3,
    2,
    true
  ),
  (
    'prekickoff_5',
    'Vision semanal',
    'Registra 5 predicciones antes del inicio del partido esta semana.',
    'predictions_before_kickoff_weekly',
    5,
    4,
    true
  )
on conflict (code)
do update set
  name = excluded.name,
  description = excluded.description,
  mission_type = excluded.mission_type,
  default_target_value = excluded.default_target_value,
  default_reward_points = excluded.default_reward_points,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

insert into public.quiniela_missions (
  quiniela_id,
  mission_id,
  is_active,
  target_value,
  reward_points,
  display_order
)
select
  q.id,
  md.id,
  md.is_active,
  md.default_target_value,
  md.default_reward_points,
  row_number() over (partition by q.id order by md.default_target_value asc, md.code asc)
from public.quinielas q
join public.mission_definitions md on md.is_active = true
where not exists (
  select 1
  from public.quiniela_missions qm
  where qm.quiniela_id = q.id
    and qm.mission_id = md.id
);

create or replace function public.ensure_quiniela_missions_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quiniela_missions (
    quiniela_id,
    mission_id,
    is_active,
    target_value,
    reward_points,
    display_order
  )
  select
    new.id,
    md.id,
    md.is_active,
    md.default_target_value,
    md.default_reward_points,
    row_number() over (order by md.default_target_value asc, md.code asc)
  from public.mission_definitions md
  where md.is_active = true
  on conflict (quiniela_id, mission_id)
  do nothing;

  return new;
end;
$$;

drop trigger if exists tr_quinielas_seed_missions on public.quinielas;
create trigger tr_quinielas_seed_missions
after insert
on public.quinielas
for each row
execute function public.ensure_quiniela_missions_row();

create or replace function public.recalculate_user_missions_for_week(
  p_user_id uuid,
  p_quiniela_id uuid,
  p_period_start_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_mission record;
  v_progress integer;
  v_existing_claimed boolean;
  v_existing_claimed_at timestamptz;
begin
  if p_user_id is null or p_quiniela_id is null or p_period_start_date is null then
    return;
  end if;

  for v_mission in
    select
      qm.mission_id,
      qm.target_value,
      qm.reward_points,
      md.mission_type
    from public.quiniela_missions qm
    join public.mission_definitions md on md.id = qm.mission_id
    where qm.quiniela_id = p_quiniela_id
      and qm.is_active = true
      and md.is_active = true
    order by qm.display_order asc, md.code asc
  loop
    v_progress := 0;

    if v_mission.mission_type = 'predictions_before_kickoff_weekly' then
      select count(*)::integer
      into v_progress
      from public.predictions p
      join public.matches m on m.id = p.match_id
      where p.user_id = p_user_id
        and p.quiniela_id = p_quiniela_id
        and public.get_week_start_date(m.match_time) = p_period_start_date
        and p.created_at < m.match_time;
    end if;

    select
      ump.is_claimed,
      ump.claimed_at
    into v_existing_claimed, v_existing_claimed_at
    from public.user_mission_progress ump
    where ump.quiniela_id = p_quiniela_id
      and ump.user_id = p_user_id
      and ump.mission_id = v_mission.mission_id
      and ump.period_start_date = p_period_start_date;

    insert into public.user_mission_progress (
      quiniela_id,
      user_id,
      mission_id,
      period_start_date,
      progress_value,
      target_value,
      reward_points,
      is_completed,
      is_claimed,
      completed_at,
      claimed_at,
      updated_at
    )
    values (
      p_quiniela_id,
      p_user_id,
      v_mission.mission_id,
      p_period_start_date,
      v_progress,
      v_mission.target_value,
      v_mission.reward_points,
      v_progress >= v_mission.target_value,
      coalesce(v_existing_claimed, false),
      case
        when v_progress >= v_mission.target_value then v_now
        else null
      end,
      v_existing_claimed_at,
      v_now
    )
    on conflict (quiniela_id, user_id, mission_id, period_start_date)
    do update set
      progress_value = excluded.progress_value,
      target_value = excluded.target_value,
      reward_points = excluded.reward_points,
      is_completed = excluded.is_completed,
      completed_at = case
        when excluded.is_completed then coalesce(public.user_mission_progress.completed_at, excluded.completed_at)
        else null
      end,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

create or replace function public.refresh_user_missions_for_prediction(
  p_user_id uuid,
  p_quiniela_id uuid,
  p_match_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start date;
begin
  if p_user_id is null or p_quiniela_id is null or p_match_id is null then
    return;
  end if;

  select public.get_week_start_date(m.match_time)
  into v_period_start
  from public.matches m
  where m.id = p_match_id;

  if v_period_start is null then
    return;
  end if;

  perform public.recalculate_user_missions_for_week(
    p_user_id,
    p_quiniela_id,
    v_period_start
  );
end;
$$;

create or replace function public.refresh_user_missions_after_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_user_id uuid;
  v_old_user_id uuid;
  v_new_quiniela_id uuid;
  v_old_quiniela_id uuid;
  v_new_match_id uuid;
  v_old_match_id uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_user_id := new.user_id;
    v_new_quiniela_id := new.quiniela_id;
    v_new_match_id := new.match_id;
  end if;

  if tg_op <> 'INSERT' then
    v_old_user_id := old.user_id;
    v_old_quiniela_id := old.quiniela_id;
    v_old_match_id := old.match_id;
  end if;

  perform public.refresh_user_missions_for_prediction(
    v_new_user_id,
    v_new_quiniela_id,
    v_new_match_id
  );

  if v_old_user_id is distinct from v_new_user_id
    or v_old_quiniela_id is distinct from v_new_quiniela_id
    or v_old_match_id is distinct from v_new_match_id then
    perform public.refresh_user_missions_for_prediction(
      v_old_user_id,
      v_old_quiniela_id,
      v_old_match_id
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_predictions_refresh_user_missions on public.predictions;
create trigger tr_predictions_refresh_user_missions
after insert or update or delete
on public.predictions
for each row
execute function public.refresh_user_missions_after_prediction_change();

create or replace function public.get_user_missions_snapshot(
  p_user_id uuid,
  p_quiniela_id uuid,
  p_period_start_date date
)
returns table (
  mission_code text,
  mission_name text,
  mission_description text,
  period_start_date date,
  progress_value integer,
  target_value integer,
  reward_points integer,
  is_completed boolean,
  is_claimed boolean,
  completed_at timestamptz,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_quiniela_id is null or p_period_start_date is null then
    return;
  end if;

  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if auth.uid() <> p_user_id
     and not public.is_admin_of_quiniela(p_quiniela_id, auth.uid())
     and not public.is_global_admin(auth.uid()) then
    raise exception 'No autorizado para consultar misiones';
  end if;

  perform public.recalculate_user_missions_for_week(
    p_user_id,
    p_quiniela_id,
    p_period_start_date
  );

  return query
  select
    md.code as mission_code,
    md.name as mission_name,
    md.description as mission_description,
    p_period_start_date,
    coalesce(ump.progress_value, 0)::integer as progress_value,
    qm.target_value,
    qm.reward_points,
    coalesce(ump.is_completed, false) as is_completed,
    coalesce(ump.is_claimed, false) as is_claimed,
    ump.completed_at,
    ump.claimed_at
  from public.quiniela_missions qm
  join public.mission_definitions md on md.id = qm.mission_id
  left join public.user_mission_progress ump
    on ump.quiniela_id = qm.quiniela_id
   and ump.user_id = p_user_id
   and ump.mission_id = qm.mission_id
   and ump.period_start_date = p_period_start_date
  where qm.quiniela_id = p_quiniela_id
    and qm.is_active = true
    and md.is_active = true
  order by qm.display_order asc, md.code asc;
end;
$$;

create or replace function public.claim_user_mission_reward(
  p_quiniela_id uuid,
  p_mission_code text,
  p_period_start_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_mission_id uuid;
  v_target integer;
  v_reward integer;
  v_progress integer;
  v_is_completed boolean;
  v_is_claimed boolean;
  v_reason text;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_quiniela_id is null then
    raise exception 'quiniela_id requerido';
  end if;

  if coalesce(trim(p_mission_code), '') = '' then
    raise exception 'mission_code requerido';
  end if;

  if p_period_start_date is null then
    p_period_start_date := public.get_week_start_date(v_now);
  end if;

  if not public.is_member_of_quiniela(p_quiniela_id, v_user_id)
     and not public.is_admin_of_quiniela(p_quiniela_id, v_user_id)
     and not public.is_global_admin(v_user_id) then
    raise exception 'No autorizado para reclamar recompensa';
  end if;

  perform public.recalculate_user_missions_for_week(
    v_user_id,
    p_quiniela_id,
    p_period_start_date
  );

  select
    md.id,
    ump.target_value,
    ump.reward_points,
    ump.progress_value,
    ump.is_completed,
    ump.is_claimed
  into
    v_mission_id,
    v_target,
    v_reward,
    v_progress,
    v_is_completed,
    v_is_claimed
  from public.user_mission_progress ump
  join public.mission_definitions md on md.id = ump.mission_id
  where ump.quiniela_id = p_quiniela_id
    and ump.user_id = v_user_id
    and ump.period_start_date = p_period_start_date
    and md.code = p_mission_code
  limit 1;

  if v_mission_id is null then
    raise exception 'Mision no encontrada para este periodo';
  end if;

  if not coalesce(v_is_completed, false) then
    raise exception 'Mision aun no completada (%/%).', coalesce(v_progress, 0), coalesce(v_target, 0);
  end if;

  if coalesce(v_is_claimed, false) then
    return jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'pointsAwarded', 0,
      'message', 'La recompensa ya fue reclamada.'
    );
  end if;

  v_reason := format(
    'mission_bonus_%s_%s',
    lower(trim(p_mission_code)),
    to_char(p_period_start_date, 'YYYYMMDD')
  );

  if coalesce(v_reward, 0) > 0 then
    insert into public.quiniela_member_manual_points (
      quiniela_id,
      user_id,
      points_delta,
      reason,
      created_by,
      created_at
    )
    values (
      p_quiniela_id,
      v_user_id,
      v_reward,
      v_reason,
      v_user_id,
      v_now
    )
    on conflict do nothing;
  end if;

  update public.user_mission_progress
  set is_claimed = true,
      claimed_at = v_now,
      updated_at = v_now
  where quiniela_id = p_quiniela_id
    and user_id = v_user_id
    and mission_id = v_mission_id
    and period_start_date = p_period_start_date;

  perform public.recalculate_quiniela_scoring(p_quiniela_id);

  return jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'pointsAwarded', coalesce(v_reward, 0),
    'message', format('Recompensa reclamada: +%s pts', coalesce(v_reward, 0))
  );
end;
$$;

drop trigger if exists tr_mission_definitions_set_updated_at on public.mission_definitions;
create trigger tr_mission_definitions_set_updated_at
before update on public.mission_definitions
for each row
execute function public.set_updated_at();

drop trigger if exists tr_quiniela_missions_set_updated_at on public.quiniela_missions;
create trigger tr_quiniela_missions_set_updated_at
before update on public.quiniela_missions
for each row
execute function public.set_updated_at();

alter table public.mission_definitions enable row level security;
alter table public.quiniela_missions enable row level security;
alter table public.user_mission_progress enable row level security;

drop policy if exists "Authenticated can read mission definitions" on public.mission_definitions;
create policy "Authenticated can read mission definitions"
on public.mission_definitions
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read quiniela missions" on public.quiniela_missions;
create policy "Authenticated can read quiniela missions"
on public.quiniela_missions
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Users and admins can read mission progress" on public.user_mission_progress;
create policy "Users and admins can read mission progress"
on public.user_mission_progress
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

grant select on public.mission_definitions to authenticated;
grant select on public.quiniela_missions to authenticated;
grant select on public.user_mission_progress to authenticated;
grant execute on function public.recalculate_user_missions_for_week(uuid, uuid, date) to authenticated, anon;
grant execute on function public.refresh_user_missions_for_prediction(uuid, uuid, uuid) to authenticated, anon;
grant execute on function public.get_user_missions_snapshot(uuid, uuid, date) to authenticated, anon;
grant execute on function public.claim_user_mission_reward(uuid, text, date) to authenticated, anon;

do $$
declare
  v_member record;
  v_week date := public.get_week_start_date(timezone('utc', now()));
begin
  for v_member in
    select qm.user_id, qm.quiniela_id
    from public.quiniela_members qm
  loop
    perform public.recalculate_user_missions_for_week(
      v_member.user_id,
      v_member.quiniela_id,
      v_week
    );
  end loop;
end;
$$;
