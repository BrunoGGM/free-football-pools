create table if not exists public.simulation_match_snapshots (
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  home_team_code text,
  away_team_code text,
  home_team_logo_url text,
  away_team_logo_url text,
  home_score integer,
  away_score integer,
  status public.match_status not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (quiniela_id, match_id)
);

create index if not exists idx_simulation_match_snapshots_quiniela
  on public.simulation_match_snapshots(quiniela_id);
