create extension if not exists "pgcrypto";

-- Enums used by matches.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('pending', 'in_progress', 'finished');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_stage') then
    create type public.match_stage as enum (
      'group_a',
      'group_b',
      'group_c',
      'group_d',
      'group_e',
      'group_f',
      'group_g',
      'group_h',
      'group_i',
      'group_j',
      'group_k',
      'group_l',
      'round_32',
      'round_16',
      'quarter_final',
      'semi_final',
      'final'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_length check (char_length(username) between 3 and 32)
);

create table if not exists public.quinielas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  access_code text not null unique,
  start_date timestamptz not null,
  end_date timestamptz,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  champion_team text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quinielas_name_length check (char_length(name) between 3 and 120),
  constraint quinielas_access_code_format check (access_code ~ '^[A-Z0-9]{6,12}$'),
  constraint quinielas_dates_order check (end_date is null or end_date > start_date)
);

create table if not exists public.quiniela_members (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  predicted_champion text,
  champion_predicted_at timestamptz,
  total_points integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, quiniela_id),
  constraint quiniela_members_total_points_non_negative check (total_points >= 0)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id bigint not null unique,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  status public.match_status not null default 'pending',
  match_time timestamptz not null,
  stage public.match_stage not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint matches_teams_must_differ check (home_team <> away_team),
  constraint matches_scores_non_negative check (
    (home_score is null or home_score >= 0)
    and (away_score is null or away_score >= 0)
  )
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score integer not null,
  away_score integer not null,
  points_earned integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint predictions_unique_user_match_quiniela unique (user_id, quiniela_id, match_id),
  constraint predictions_scores_non_negative check (home_score >= 0 and away_score >= 0),
  constraint predictions_points_range check (points_earned between 0 and 3)
);

create index if not exists idx_quinielas_admin_id on public.quinielas(admin_id);
create index if not exists idx_quinielas_access_code on public.quinielas(access_code);
create index if not exists idx_quiniela_members_quiniela_id on public.quiniela_members(quiniela_id);
create index if not exists idx_matches_match_time on public.matches(match_time);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_stage on public.matches(stage);
create index if not exists idx_predictions_match_id on public.predictions(match_id);
create index if not exists idx_predictions_user_id on public.predictions(user_id);
create index if not exists idx_predictions_quiniela_id on public.predictions(quiniela_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists tr_profiles_set_updated_at on public.profiles;
create trigger tr_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists tr_quinielas_set_updated_at on public.quinielas;
create trigger tr_quinielas_set_updated_at
before update on public.quinielas
for each row
execute function public.set_updated_at();

drop trigger if exists tr_quiniela_members_set_updated_at on public.quiniela_members;
create trigger tr_quiniela_members_set_updated_at
before update on public.quiniela_members
for each row
execute function public.set_updated_at();

drop trigger if exists tr_matches_set_updated_at on public.matches;
create trigger tr_matches_set_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

drop trigger if exists tr_predictions_set_updated_at on public.predictions;
create trigger tr_predictions_set_updated_at
before update on public.predictions
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'jugador_' || substring(new.id::text from 1 for 8)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists tr_auth_user_created_profile on auth.users;
create trigger tr_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();
