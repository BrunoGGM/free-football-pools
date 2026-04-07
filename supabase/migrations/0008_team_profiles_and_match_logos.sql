create table if not exists public.team_profiles (
  id uuid primary key default gen_random_uuid(),
  api_team_id bigint unique,
  team_key text not null unique,
  name text not null,
  code text,
  country text,
  logo_url text,
  is_national boolean,
  source_provider text not null default 'api-football',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_team_profiles_name on public.team_profiles(name);
create index if not exists idx_team_profiles_code on public.team_profiles(code);

alter table public.team_profiles enable row level security;

drop policy if exists "Team profiles are readable by authenticated users" on public.team_profiles;
create policy "Team profiles are readable by authenticated users"
on public.team_profiles
for select
to authenticated
using (true);

drop trigger if exists tr_team_profiles_set_updated_at on public.team_profiles;
create trigger tr_team_profiles_set_updated_at
before update on public.team_profiles
for each row
execute function public.set_updated_at();

alter table public.matches
add column if not exists home_team_logo_url text;

alter table public.matches
add column if not exists away_team_logo_url text;

update public.matches m
set home_team_logo_url = tp.logo_url,
    home_team_code = coalesce(m.home_team_code, tp.code)
from public.team_profiles tp
where tp.team_key = public.normalize_team_key(m.home_team)
  and (m.home_team_logo_url is null or m.home_team_logo_url = '');

update public.matches m
set away_team_logo_url = tp.logo_url,
    away_team_code = coalesce(m.away_team_code, tp.code)
from public.team_profiles tp
where tp.team_key = public.normalize_team_key(m.away_team)
  and (m.away_team_logo_url is null or m.away_team_logo_url = '');
