alter table public.matches
  add column if not exists bracket_match_no integer,
  add column if not exists home_seed_token text,
  add column if not exists away_seed_token text;

do $$
begin
  if to_regclass('public.simulation_match_snapshots') is not null then
    alter table public.simulation_match_snapshots
      add column if not exists bracket_match_no integer,
      add column if not exists home_seed_token text,
      add column if not exists away_seed_token text;
  end if;
end;
$$;

create unique index if not exists uq_matches_knockout_bracket_match_no
  on public.matches(bracket_match_no)
  where stage in ('round_32', 'round_16', 'quarter_final', 'semi_final', 'third_place', 'final');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_bracket_match_no_range'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_bracket_match_no_range
      check (bracket_match_no is null or bracket_match_no between 73 and 104);
  end if;
end;
$$;

create table if not exists public.quiniela_group_overrides (
  id uuid primary key default gen_random_uuid(),
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  group_code text not null,
  position smallint not null,
  team_name text not null,
  team_code text,
  team_logo_url text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_group_overrides_group_code check (group_code ~ '^[A-L]$'),
  constraint quiniela_group_overrides_position_range check (position between 1 and 4),
  constraint quiniela_group_overrides_team_name_len check (char_length(team_name) between 2 and 120)
);

create unique index if not exists uq_quiniela_group_overrides_unique_position
  on public.quiniela_group_overrides(quiniela_id, group_code, position);

create index if not exists idx_quiniela_group_overrides_lookup
  on public.quiniela_group_overrides(quiniela_id, group_code);

create index if not exists idx_quiniela_group_overrides_updated_by
  on public.quiniela_group_overrides(updated_by)
  where updated_by is not null;

drop trigger if exists tr_quiniela_group_overrides_set_updated_at on public.quiniela_group_overrides;
create trigger tr_quiniela_group_overrides_set_updated_at
before update on public.quiniela_group_overrides
for each row
execute function public.set_updated_at();

with bracket_seed_map(api_fixture_id, bracket_match_no, home_seed_token, away_seed_token) as (
  values
    (202600101::bigint, 73, '2A', '2B'),
    (202600102::bigint, 76, '1C', '2F'),
    (202600103::bigint, 74, '1E', '3rd(A/B/C/D/F)'),
    (202600104::bigint, 75, '1F', '2C'),
    (202600105::bigint, 78, '2E', '2I'),
    (202600106::bigint, 77, '1I', '3rd(C/D/F/G/H)'),
    (202600107::bigint, 79, '1A', '3rd(C/E/F/H/I)'),
    (202600108::bigint, 80, '1L', '3rd(E/H/I/J/K)'),
    (202600109::bigint, 82, '1G', '3rd(A/E/H/I/J)'),
    (202600110::bigint, 81, '1D', '3rd(B/E/F/I/J)'),
    (202600111::bigint, 84, '1H', '2J'),
    (202600112::bigint, 83, '2K', '2L'),
    (202600113::bigint, 85, '1B', '3rd(E/F/G/I/J)'),
    (202600114::bigint, 88, '2D', '2G'),
    (202600115::bigint, 86, '1J', '2H'),
    (202600116::bigint, 87, '1K', '3rd(D/E/I/J/L)'),
    (202600117::bigint, 89, 'W74', 'W77'),
    (202600118::bigint, 90, 'W73', 'W75'),
    (202600119::bigint, 91, 'W76', 'W78'),
    (202600120::bigint, 92, 'W79', 'W80'),
    (202600121::bigint, 93, 'W83', 'W84'),
    (202600122::bigint, 94, 'W81', 'W82'),
    (202600123::bigint, 95, 'W86', 'W88'),
    (202600124::bigint, 96, 'W85', 'W87'),
    (202600125::bigint, 97, 'W89', 'W90'),
    (202600126::bigint, 98, 'W93', 'W94'),
    (202600127::bigint, 99, 'W91', 'W92'),
    (202600128::bigint, 100, 'W95', 'W96'),
    (202600129::bigint, 101, 'W97', 'W98'),
    (202600130::bigint, 102, 'W99', 'W100'),
    (202600131::bigint, 103, 'L101', 'L102'),
    (202600132::bigint, 104, 'W101', 'W102')
)
update public.matches m
set
  bracket_match_no = b.bracket_match_no,
  home_seed_token = b.home_seed_token,
  away_seed_token = b.away_seed_token,
  home_team = case
    when m.stage = 'round_32'
      and m.status = 'pending'
      and (m.home_team ~* '^([12][A-L])$' or m.home_team ~* '^Mejor\\s*3ro')
      then b.home_seed_token
    when m.stage in ('round_16', 'quarter_final', 'semi_final', 'third_place', 'final')
      and m.status = 'pending'
      and (m.home_team ~* '^Ganador\\s+' or m.home_team ~* '^Perdedor\\s+')
      then b.home_seed_token
    else m.home_team
  end,
  away_team = case
    when m.stage = 'round_32'
      and m.status = 'pending'
      and (m.away_team ~* '^([12][A-L])$' or m.away_team ~* '^Mejor\\s*3ro')
      then b.away_seed_token
    when m.stage in ('round_16', 'quarter_final', 'semi_final', 'third_place', 'final')
      and m.status = 'pending'
      and (m.away_team ~* '^Ganador\\s+' or m.away_team ~* '^Perdedor\\s+')
      then b.away_seed_token
    else m.away_team
  end,
  home_team_code = case
    when m.stage = 'round_32'
      and m.status = 'pending'
      and (m.home_team ~* '^([12][A-L])$' or m.home_team ~* '^Mejor\\s*3ro')
      then null
    when m.stage in ('round_16', 'quarter_final', 'semi_final', 'third_place', 'final')
      and m.status = 'pending'
      and (m.home_team ~* '^Ganador\\s+' or m.home_team ~* '^Perdedor\\s+')
      then null
    else m.home_team_code
  end,
  away_team_code = case
    when m.stage = 'round_32'
      and m.status = 'pending'
      and (m.away_team ~* '^([12][A-L])$' or m.away_team ~* '^Mejor\\s*3ro')
      then null
    when m.stage in ('round_16', 'quarter_final', 'semi_final', 'third_place', 'final')
      and m.status = 'pending'
      and (m.away_team ~* '^Ganador\\s+' or m.away_team ~* '^Perdedor\\s+')
      then null
    else m.away_team_code
  end,
  home_team_logo_url = case
    when m.stage = 'round_32'
      and m.status = 'pending'
      and (m.home_team ~* '^([12][A-L])$' or m.home_team ~* '^Mejor\\s*3ro')
      then null
    when m.stage in ('round_16', 'quarter_final', 'semi_final', 'third_place', 'final')
      and m.status = 'pending'
      and (m.home_team ~* '^Ganador\\s+' or m.home_team ~* '^Perdedor\\s+')
      then null
    else m.home_team_logo_url
  end,
  away_team_logo_url = case
    when m.stage = 'round_32'
      and m.status = 'pending'
      and (m.away_team ~* '^([12][A-L])$' or m.away_team ~* '^Mejor\\s*3ro')
      then null
    when m.stage in ('round_16', 'quarter_final', 'semi_final', 'third_place', 'final')
      and m.status = 'pending'
      and (m.away_team ~* '^Ganador\\s+' or m.away_team ~* '^Perdedor\\s+')
      then null
    else m.away_team_logo_url
  end,
  updated_at = timezone('utc', now())
from bracket_seed_map b
where m.api_fixture_id = b.api_fixture_id;

create or replace function public.apply_knockout_progression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner_team text;
  v_loser_team text;
  v_winner_code text;
  v_loser_code text;
  v_winner_logo text;
  v_loser_logo text;
  v_winner_seed text;
  v_loser_seed text;
begin
  if new.stage not in ('round_32', 'round_16', 'quarter_final', 'semi_final') then
    return new;
  end if;

  if new.status <> 'finished' then
    return new;
  end if;

  if new.bracket_match_no is null then
    return new;
  end if;

  if new.home_score is null or new.away_score is null then
    return new;
  end if;

  if new.home_score > new.away_score then
    v_winner_team := new.home_team;
    v_winner_code := new.home_team_code;
    v_winner_logo := new.home_team_logo_url;
    v_loser_team := new.away_team;
    v_loser_code := new.away_team_code;
    v_loser_logo := new.away_team_logo_url;
  elsif new.away_score > new.home_score then
    v_winner_team := new.away_team;
    v_winner_code := new.away_team_code;
    v_winner_logo := new.away_team_logo_url;
    v_loser_team := new.home_team;
    v_loser_code := new.home_team_code;
    v_loser_logo := new.home_team_logo_url;
  else
    if new.home_penalty_score is null or new.away_penalty_score is null then
      return new;
    end if;

    if new.home_penalty_score = new.away_penalty_score then
      return new;
    end if;

    if new.home_penalty_score > new.away_penalty_score then
      v_winner_team := new.home_team;
      v_winner_code := new.home_team_code;
      v_winner_logo := new.home_team_logo_url;
      v_loser_team := new.away_team;
      v_loser_code := new.away_team_code;
      v_loser_logo := new.away_team_logo_url;
    else
      v_winner_team := new.away_team;
      v_winner_code := new.away_team_code;
      v_winner_logo := new.away_team_logo_url;
      v_loser_team := new.home_team;
      v_loser_code := new.home_team_code;
      v_loser_logo := new.home_team_logo_url;
    end if;
  end if;

  v_winner_seed := 'W' || new.bracket_match_no::text;
  v_loser_seed := 'L' || new.bracket_match_no::text;

  update public.matches
  set
    home_team = v_winner_team,
    home_team_code = v_winner_code,
    home_team_logo_url = v_winner_logo,
    updated_at = timezone('utc', now())
  where home_seed_token = v_winner_seed;

  update public.matches
  set
    away_team = v_winner_team,
    away_team_code = v_winner_code,
    away_team_logo_url = v_winner_logo,
    updated_at = timezone('utc', now())
  where away_seed_token = v_winner_seed;

  update public.matches
  set
    home_team = v_loser_team,
    home_team_code = v_loser_code,
    home_team_logo_url = v_loser_logo,
    updated_at = timezone('utc', now())
  where home_seed_token = v_loser_seed;

  update public.matches
  set
    away_team = v_loser_team,
    away_team_code = v_loser_code,
    away_team_logo_url = v_loser_logo,
    updated_at = timezone('utc', now())
  where away_seed_token = v_loser_seed;

  return new;
end;
$$;

drop trigger if exists tr_matches_apply_knockout_progression on public.matches;
create trigger tr_matches_apply_knockout_progression
after insert or update of home_score, away_score, home_penalty_score, away_penalty_score, status
on public.matches
for each row
execute function public.apply_knockout_progression();
