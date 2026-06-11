-- Custom (additional) picks per quiniela.
-- Admins define dynamic picks (title, answer format, lock date, points).
-- Members submit an answer (free text and/or country). Admins manually mark
-- each answer as correct, which awards the configured points to that member.

create table if not exists public.quiniela_custom_picks (
  id uuid primary key default gen_random_uuid(),
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  title text not null,
  description text,
  requires_text boolean not null default true,
  requires_country boolean not null default false,
  points integer not null default 3,
  locks_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_custom_picks_title_len check (char_length(title) between 3 and 160),
  constraint quiniela_custom_picks_description_len check (description is null or char_length(description) <= 480),
  constraint quiniela_custom_picks_points_range check (points between 0 and 100),
  constraint quiniela_custom_picks_requires_any check (requires_text or requires_country)
);

create index if not exists idx_quiniela_custom_picks_quiniela
  on public.quiniela_custom_picks(quiniela_id, created_at desc);

create table if not exists public.quiniela_custom_pick_answers (
  id uuid primary key default gen_random_uuid(),
  custom_pick_id uuid not null references public.quiniela_custom_picks(id) on delete cascade,
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text,
  answer_country text,
  is_correct boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_custom_pick_answers_text_len check (answer_text is null or char_length(answer_text) <= 160),
  constraint quiniela_custom_pick_answers_country_len check (answer_country is null or char_length(answer_country) <= 80),
  constraint quiniela_custom_pick_answers_unique unique (custom_pick_id, user_id)
);

create index if not exists idx_quiniela_custom_pick_answers_pick
  on public.quiniela_custom_pick_answers(custom_pick_id);
create index if not exists idx_quiniela_custom_pick_answers_member
  on public.quiniela_custom_pick_answers(quiniela_id, user_id);

-- Keep updated_at fresh.
drop trigger if exists tr_quiniela_custom_picks_set_updated_at on public.quiniela_custom_picks;
create trigger tr_quiniela_custom_picks_set_updated_at
before update on public.quiniela_custom_picks
for each row
execute function public.set_updated_at();

drop trigger if exists tr_quiniela_custom_pick_answers_set_updated_at on public.quiniela_custom_pick_answers;
create trigger tr_quiniela_custom_pick_answers_set_updated_at
before update on public.quiniela_custom_pick_answers
for each row
execute function public.set_updated_at();

-- Extend member scoring to include points from correct custom pick answers.
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
  v_custom_points integer := 0;
  v_champion_bonus_points integer := 10;
  v_final_winner text;
  v_lock_time timestamptz;
begin
  select coalesce(sum(p.points_earned), 0)
  into v_points
  from public.predictions p
  where p.user_id = p_user_id
    and p.quiniela_id = p_quiniela_id;

  select rules.champion_bonus_points
  into v_champion_bonus_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  v_lock_time := public.champion_pick_lock_time();

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
      when v_lock_time is not null and qm.champion_predicted_at >= v_lock_time then 0
      when lower(trim(qm.predicted_champion)) = lower(trim(q.champion_team)) then coalesce(v_champion_bonus_points, 10)
      else 0
    end
  into v_bonus
  from public.quiniela_members qm
  join public.quinielas q on q.id = qm.quiniela_id
  where qm.user_id = p_user_id
    and qm.quiniela_id = p_quiniela_id;

  select coalesce(sum(cp.points), 0)
  into v_custom_points
  from public.quiniela_custom_pick_answers a
  join public.quiniela_custom_picks cp on cp.id = a.custom_pick_id
  where a.quiniela_id = p_quiniela_id
    and a.user_id = p_user_id
    and a.is_correct = true;

  update public.quiniela_members
  set total_points = greatest(v_points + coalesce(v_bonus, 0) + coalesce(v_custom_points, 0), 0),
      updated_at = timezone('utc', now())
  where user_id = p_user_id
    and quiniela_id = p_quiniela_id;
end;
$$;

-- Recalculate the owner's total when their answer changes.
create or replace function public.recalculate_after_custom_pick_answer_change()
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

  perform public.recalculate_member_total_points(v_user_id, v_quiniela_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_custom_pick_answers_recalculate on public.quiniela_custom_pick_answers;
create trigger tr_custom_pick_answers_recalculate
after insert or update or delete
on public.quiniela_custom_pick_answers
for each row
execute function public.recalculate_after_custom_pick_answer_change();

-- When a pick's points change (or it is removed), recalc all members that answered it.
create or replace function public.recalculate_after_custom_pick_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_quiniela_id uuid;
  v_pick_id uuid;
begin
  v_quiniela_id := coalesce(new.quiniela_id, old.quiniela_id);
  v_pick_id := coalesce(new.id, old.id);

  for v_member in
    select distinct a.user_id
    from public.quiniela_custom_pick_answers a
    where a.custom_pick_id = v_pick_id
  loop
    perform public.recalculate_member_total_points(v_member.user_id, v_quiniela_id);
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_custom_picks_recalculate on public.quiniela_custom_picks;
create trigger tr_custom_picks_recalculate
after update of points or delete
on public.quiniela_custom_picks
for each row
execute function public.recalculate_after_custom_pick_change();

-- Row level security.
alter table public.quiniela_custom_picks enable row level security;
alter table public.quiniela_custom_pick_answers enable row level security;

drop policy if exists "Members read custom picks" on public.quiniela_custom_picks;
create policy "Members read custom picks"
on public.quiniela_custom_picks
for select
to authenticated
using (
  public.is_member_of_quiniela(quiniela_id, auth.uid())
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Admins manage custom picks" on public.quiniela_custom_picks;
create policy "Admins manage custom picks"
on public.quiniela_custom_picks
for all
to authenticated
using (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
)
with check (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Members read related custom answers" on public.quiniela_custom_pick_answers;
create policy "Members read related custom answers"
on public.quiniela_custom_pick_answers
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
  or exists (
    select 1
    from public.quiniela_rules qr
    where qr.quiniela_id = quiniela_custom_pick_answers.quiniela_id
      and qr.allow_member_predictions_view = true
      and public.is_member_of_quiniela(quiniela_custom_pick_answers.quiniela_id, auth.uid())
  )
);

drop policy if exists "Members insert own custom answers before lock" on public.quiniela_custom_pick_answers;
create policy "Members insert own custom answers before lock"
on public.quiniela_custom_pick_answers
for insert
to authenticated
with check (
  user_id = auth.uid()
  and is_correct = false
  and exists (
    select 1
    from public.quiniela_custom_picks cp
    where cp.id = custom_pick_id
      and cp.quiniela_id = quiniela_custom_pick_answers.quiniela_id
      and public.is_member_of_quiniela(cp.quiniela_id, auth.uid())
      and (cp.locks_at is null or timezone('utc', now()) < cp.locks_at)
  )
);

drop policy if exists "Members update own custom answers before lock" on public.quiniela_custom_pick_answers;
create policy "Members update own custom answers before lock"
on public.quiniela_custom_pick_answers
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and is_correct = false
  and exists (
    select 1
    from public.quiniela_custom_picks cp
    where cp.id = custom_pick_id
      and cp.quiniela_id = quiniela_custom_pick_answers.quiniela_id
      and public.is_member_of_quiniela(cp.quiniela_id, auth.uid())
      and (cp.locks_at is null or timezone('utc', now()) < cp.locks_at)
  )
);

drop policy if exists "Admins manage custom answers" on public.quiniela_custom_pick_answers;
create policy "Admins manage custom answers"
on public.quiniela_custom_pick_answers
for all
to authenticated
using (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
)
with check (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);
