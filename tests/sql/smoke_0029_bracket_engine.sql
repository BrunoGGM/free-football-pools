\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

create table if not exists public.quinielas (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Quiniela Test'
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  status text not null default 'pending',
  match_time timestamptz not null default timezone('utc', now()),
  api_fixture_id bigint unique,
  home_team text,
  away_team text,
  home_team_code text,
  away_team_code text,
  home_team_logo_url text,
  away_team_logo_url text,
  home_score integer,
  away_score integer,
  home_penalty_score integer,
  away_penalty_score integer,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.simulation_match_snapshots (
  quiniela_id uuid not null,
  match_id uuid not null,
  home_team text,
  away_team text,
  home_team_code text,
  away_team_code text,
  home_team_logo_url text,
  away_team_logo_url text,
  home_score integer,
  away_score integer,
  home_penalty_score integer,
  away_penalty_score integer,
  status text,
  primary key (quiniela_id, match_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

\i supabase/migrations/0029_bracket_engine_tokens_and_group_overrides.sql

do $$
begin
  if to_regclass('public.quiniela_group_overrides') is null then
    raise exception 'Expected quiniela_group_overrides table to exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'bracket_match_no'
  ) then
    raise exception 'Expected matches.bracket_match_no to exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'home_seed_token'
  ) then
    raise exception 'Expected matches.home_seed_token to exist';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'tr_matches_apply_knockout_progression'
  ) then
    raise exception 'Expected tr_matches_apply_knockout_progression trigger to exist';
  end if;
end;
$$;

insert into public.matches (
  stage,
  status,
  bracket_match_no,
  home_seed_token,
  away_seed_token,
  home_team,
  away_team,
  api_fixture_id
)
values
  ('round_32', 'pending', 74, '1E', '3rd(A/B/C/D/F)', 'Team Winner', 'Team Loser', 900074),
  ('round_16', 'pending', 89, 'W74', 'W77', 'W74', 'W77', 900089);

update public.matches
set
  home_score = 2,
  away_score = 1,
  status = 'finished'
where bracket_match_no = 74;

do $$
declare
  v_home_team text;
begin
  select home_team
  into v_home_team
  from public.matches
  where bracket_match_no = 89;

  if v_home_team <> 'Team Winner' then
    raise exception 'Expected winner propagation into match 89, got %', coalesce(v_home_team, '<null>');
  end if;
end;
$$;
