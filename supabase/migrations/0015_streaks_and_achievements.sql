create table if not exists public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon_emoji text not null default '🏅',
  tier integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint achievement_definitions_tier_check check (tier between 1 and 5)
);

create table if not exists public.quiniela_member_streaks (
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (quiniela_id, user_id),
  constraint quiniela_member_streaks_current_non_negative check (current_streak >= 0),
  constraint quiniela_member_streaks_best_non_negative check (best_streak >= 0)
);

create index if not exists idx_streaks_quiniela_lookup
  on public.quiniela_member_streaks(quiniela_id, current_streak desc, user_id);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievement_definitions(id) on delete cascade,
  unlocked_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (quiniela_id, user_id, achievement_id)
);

create index if not exists idx_user_achievements_quiniela_user
  on public.user_achievements(quiniela_id, user_id, unlocked_at desc);

insert into public.achievement_definitions (code, name, description, icon_emoji, tier)
values
  ('streak_3', 'Racha de 3', 'Acertaste resultado en 3 partidos seguidos', '🔥', 1),
  ('streak_5', 'Racha de 5', 'Acertaste resultado en 5 partidos seguidos', '🚀', 2),
  ('exact_3', 'Triple exacto', 'Lograste al menos 3 marcadores exactos', '🎯', 2),
  ('top_3', 'Podio', 'Entraste al top 3 de la quiniela', '🥉', 2),
  ('leader_1', 'Lider', 'Llegaste al primer lugar de la quiniela', '🥇', 3),
  ('champion_hit', 'Vision de campeon', 'Acertaste el campeon dentro del plazo', '👑', 3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon_emoji = excluded.icon_emoji,
  tier = excluded.tier,
  is_active = true;

create or replace function public.grant_achievement_by_code(
  p_user_id uuid,
  p_quiniela_id uuid,
  p_code text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_achievement_id uuid;
begin
  select ad.id
  into v_achievement_id
  from public.achievement_definitions ad
  where ad.code = p_code
    and ad.is_active = true
  limit 1;

  if v_achievement_id is null then
    return;
  end if;

  insert into public.user_achievements (
    quiniela_id,
    user_id,
    achievement_id,
    unlocked_at,
    metadata
  )
  values (
    p_quiniela_id,
    p_user_id,
    v_achievement_id,
    timezone('utc', now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (quiniela_id, user_id, achievement_id)
  do nothing;
end;
$$;

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
  v_points integer;
begin
  for v_points in
    select coalesce(p.points_earned, 0)::integer
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where p.user_id = p_user_id
      and p.quiniela_id = p_quiniela_id
      and m.status = 'finished'
    order by m.match_time asc, m.id asc
  loop
    if v_points > 0 then
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
    best_streak = greatest(public.quiniela_member_streaks.best_streak, excluded.best_streak),
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.grant_streak_bonus(
  p_user_id uuid,
  p_quiniela_id uuid,
  p_milestone integer,
  p_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if p_points = 0 then
    return;
  end if;

  v_reason := format('streak_bonus_%s', p_milestone);

  if exists (
    select 1
    from public.quiniela_member_manual_points qmmp
    where qmmp.user_id = p_user_id
      and qmmp.quiniela_id = p_quiniela_id
      and qmmp.reason = v_reason
  ) then
    return;
  end if;

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
    p_user_id,
    p_points,
    v_reason,
    p_user_id,
    timezone('utc', now())
  );
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
begin
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

    perform public.grant_streak_bonus(
      p_user_id,
      p_quiniela_id,
      3,
      1
    );
  end if;

  if v_current_streak >= 5 then
    perform public.grant_achievement_by_code(
      p_user_id,
      p_quiniela_id,
      'streak_5',
      jsonb_build_object('current_streak', v_current_streak)
    );

    perform public.grant_streak_bonus(
      p_user_id,
      p_quiniela_id,
      5,
      2
    );
  end if;

  select count(*)::integer
  into v_exact_hits
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id
    and m.status = 'finished'
    and coalesce(p.points_earned, 0) >= 3;

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

create or replace function public.refresh_member_gamification(
  p_user_id uuid,
  p_quiniela_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_member_streak(p_user_id, p_quiniela_id);
  perform public.award_member_achievements(p_user_id, p_quiniela_id);
end;
$$;

create or replace function public.refresh_gamification_after_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_quiniela_id uuid;
begin
  v_user_id := coalesce(new.user_id, old.user_id);
  v_quiniela_id := coalesce(new.quiniela_id, old.quiniela_id);

  if v_user_id is null or v_quiniela_id is null then
    return coalesce(new, old);
  end if;

  perform public.refresh_member_gamification(v_user_id, v_quiniela_id);

  return coalesce(new, old);
end;
$$;

create or replace function public.seed_streak_after_member_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quiniela_member_streaks (
    quiniela_id,
    user_id,
    current_streak,
    best_streak,
    updated_at
  )
  values (
    new.quiniela_id,
    new.user_id,
    0,
    0,
    timezone('utc', now())
  )
  on conflict (quiniela_id, user_id)
  do nothing;

  perform public.refresh_member_gamification(new.user_id, new.quiniela_id);

  return new;
end;
$$;

create or replace function public.award_achievements_after_ranking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_member_achievements(new.user_id, new.quiniela_id);
  return new;
end;
$$;

create or replace function public.award_achievements_after_champion_set()
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
    perform public.award_member_achievements(v_member.user_id, new.id);
  end loop;

  return new;
end;
$$;

drop trigger if exists tr_predictions_refresh_gamification on public.predictions;
create trigger tr_predictions_refresh_gamification
after insert or update or delete
on public.predictions
for each row
execute function public.refresh_gamification_after_prediction_change();

drop trigger if exists tr_quiniela_members_seed_streak on public.quiniela_members;
create trigger tr_quiniela_members_seed_streak
after insert
on public.quiniela_members
for each row
execute function public.seed_streak_after_member_join();

drop trigger if exists tr_quiniela_rankings_award_achievements on public.quiniela_rankings;
create trigger tr_quiniela_rankings_award_achievements
after insert or update of rank, total_points
on public.quiniela_rankings
for each row
execute function public.award_achievements_after_ranking_change();

drop trigger if exists tr_quinielas_award_champion_achievement on public.quinielas;
create trigger tr_quinielas_award_champion_achievement
after update of champion_team
on public.quinielas
for each row
execute function public.award_achievements_after_champion_set();

alter table public.achievement_definitions enable row level security;
alter table public.quiniela_member_streaks enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Authenticated can read achievement definitions" on public.achievement_definitions;
create policy "Authenticated can read achievement definitions"
on public.achievement_definitions
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read streaks" on public.quiniela_member_streaks;
create policy "Authenticated can read streaks"
on public.quiniela_member_streaks
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Authenticated can read user achievements" on public.user_achievements;
create policy "Authenticated can read user achievements"
on public.user_achievements
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

grant select on public.achievement_definitions to authenticated, anon;
grant select on public.quiniela_member_streaks to authenticated;
grant select on public.user_achievements to authenticated;

grant execute on function public.grant_achievement_by_code(uuid, uuid, text, jsonb) to authenticated, anon;
grant execute on function public.grant_streak_bonus(uuid, uuid, integer, integer) to authenticated, anon;
grant execute on function public.recalculate_member_streak(uuid, uuid) to authenticated, anon;
grant execute on function public.award_member_achievements(uuid, uuid) to authenticated, anon;
grant execute on function public.refresh_member_gamification(uuid, uuid) to authenticated, anon;

insert into public.quiniela_member_streaks (
  quiniela_id,
  user_id,
  current_streak,
  best_streak,
  updated_at
)
select
  qm.quiniela_id,
  qm.user_id,
  0,
  0,
  timezone('utc', now())
from public.quiniela_members qm
on conflict (quiniela_id, user_id)
do nothing;

do $$
declare
  v_member record;
begin
  for v_member in
    select qm.user_id, qm.quiniela_id
    from public.quiniela_members qm
  loop
    perform public.refresh_member_gamification(v_member.user_id, v_member.quiniela_id);
  end loop;
end;
$$;
