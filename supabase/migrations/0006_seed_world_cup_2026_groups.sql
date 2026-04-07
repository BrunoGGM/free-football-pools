-- Seed inicial de fase de grupos Mundial 2026.
-- Horarios fuente en ET; aqui se guardan convertidos a UTC.

create unique index if not exists uq_matches_stage_time_teams
  on public.matches(stage, match_time, home_team, away_team);

with seed_matches(api_fixture_id, home_team, away_team, match_time, stage) as (
  values
    (202600001, 'Mexico', 'Sudafrica', '2026-06-11T19:00:00Z'::timestamptz, 'group_a'::public.match_stage),
    (202600002, 'Republica de Corea', 'Republica Checa', '2026-06-12T02:00:00Z'::timestamptz, 'group_a'::public.match_stage),
    (202600003, 'Republica Checa', 'Sudafrica', '2026-06-18T16:00:00Z'::timestamptz, 'group_a'::public.match_stage),
    (202600004, 'Mexico', 'Republica de Corea', '2026-06-19T01:00:00Z'::timestamptz, 'group_a'::public.match_stage),
    (202600005, 'Republica Checa', 'Mexico', '2026-06-25T01:00:00Z'::timestamptz, 'group_a'::public.match_stage),
    (202600006, 'Sudafrica', 'Republica de Corea', '2026-06-25T01:00:00Z'::timestamptz, 'group_a'::public.match_stage),

    (202600007, 'Canada', 'Bosnia y Herzegovina', '2026-06-12T19:00:00Z'::timestamptz, 'group_b'::public.match_stage),
    (202600008, 'Catar', 'Suiza', '2026-06-13T19:00:00Z'::timestamptz, 'group_b'::public.match_stage),
    (202600009, 'Suiza', 'Bosnia y Herzegovina', '2026-06-18T19:00:00Z'::timestamptz, 'group_b'::public.match_stage),
    (202600010, 'Canada', 'Catar', '2026-06-18T22:00:00Z'::timestamptz, 'group_b'::public.match_stage),
    (202600011, 'Suiza', 'Canada', '2026-06-24T19:00:00Z'::timestamptz, 'group_b'::public.match_stage),
    (202600012, 'Bosnia y Herzegovina', 'Catar', '2026-06-24T19:00:00Z'::timestamptz, 'group_b'::public.match_stage),

    (202600013, 'Brasil', 'Marruecos', '2026-06-13T22:00:00Z'::timestamptz, 'group_c'::public.match_stage),
    (202600014, 'Haiti', 'Escocia', '2026-06-14T01:00:00Z'::timestamptz, 'group_c'::public.match_stage),
    (202600015, 'Escocia', 'Marruecos', '2026-06-19T22:00:00Z'::timestamptz, 'group_c'::public.match_stage),
    (202600016, 'Brasil', 'Haiti', '2026-06-20T01:00:00Z'::timestamptz, 'group_c'::public.match_stage),
    (202600017, 'Brasil', 'Escocia', '2026-06-24T22:00:00Z'::timestamptz, 'group_c'::public.match_stage),
    (202600018, 'Marruecos', 'Haiti', '2026-06-24T22:00:00Z'::timestamptz, 'group_c'::public.match_stage),

    (202600019, 'Estados Unidos', 'Paraguay', '2026-06-13T01:00:00Z'::timestamptz, 'group_d'::public.match_stage),
    (202600020, 'Australia', 'Turquia', '2026-06-13T04:00:00Z'::timestamptz, 'group_d'::public.match_stage),
    (202600021, 'Estados Unidos', 'Australia', '2026-06-19T19:00:00Z'::timestamptz, 'group_d'::public.match_stage),
    (202600022, 'Turquia', 'Paraguay', '2026-06-19T04:00:00Z'::timestamptz, 'group_d'::public.match_stage),
    (202600023, 'Turquia', 'Estados Unidos', '2026-06-26T02:00:00Z'::timestamptz, 'group_d'::public.match_stage),
    (202600024, 'Paraguay', 'Australia', '2026-06-26T02:00:00Z'::timestamptz, 'group_d'::public.match_stage),

    (202600025, 'Alemania', 'Curazao', '2026-06-14T17:00:00Z'::timestamptz, 'group_e'::public.match_stage),
    (202600026, 'Costa de Marfil', 'Ecuador', '2026-06-14T23:00:00Z'::timestamptz, 'group_e'::public.match_stage),
    (202600027, 'Alemania', 'Costa de Marfil', '2026-06-20T20:00:00Z'::timestamptz, 'group_e'::public.match_stage),
    (202600028, 'Ecuador', 'Curazao', '2026-06-21T02:00:00Z'::timestamptz, 'group_e'::public.match_stage),
    (202600029, 'Curazao', 'Costa de Marfil', '2026-06-25T20:00:00Z'::timestamptz, 'group_e'::public.match_stage),
    (202600030, 'Ecuador', 'Alemania', '2026-06-25T20:00:00Z'::timestamptz, 'group_e'::public.match_stage),

    (202600031, 'Paises Bajos', 'Japon', '2026-06-14T20:00:00Z'::timestamptz, 'group_f'::public.match_stage),
    (202600032, 'Suecia', 'Tunez', '2026-06-15T02:00:00Z'::timestamptz, 'group_f'::public.match_stage),
    (202600033, 'Paises Bajos', 'Suecia', '2026-06-20T17:00:00Z'::timestamptz, 'group_f'::public.match_stage),
    (202600034, 'Tunez', 'Japon', '2026-06-20T04:00:00Z'::timestamptz, 'group_f'::public.match_stage),
    (202600035, 'Japon', 'Suecia', '2026-06-25T23:00:00Z'::timestamptz, 'group_f'::public.match_stage),
    (202600036, 'Tunez', 'Paises Bajos', '2026-06-25T23:00:00Z'::timestamptz, 'group_f'::public.match_stage),

    (202600037, 'Belgica', 'Egipto', '2026-06-15T19:00:00Z'::timestamptz, 'group_g'::public.match_stage),
    (202600038, 'Iran', 'Nueva Zelanda', '2026-06-16T01:00:00Z'::timestamptz, 'group_g'::public.match_stage),
    (202600039, 'Belgica', 'Iran', '2026-06-21T19:00:00Z'::timestamptz, 'group_g'::public.match_stage),
    (202600040, 'Nueva Zelanda', 'Egipto', '2026-06-22T01:00:00Z'::timestamptz, 'group_g'::public.match_stage),
    (202600041, 'Egipto', 'Iran', '2026-06-27T03:00:00Z'::timestamptz, 'group_g'::public.match_stage),
    (202600042, 'Nueva Zelanda', 'Belgica', '2026-06-27T03:00:00Z'::timestamptz, 'group_g'::public.match_stage),

    (202600043, 'Espana', 'Cabo Verde', '2026-06-15T16:00:00Z'::timestamptz, 'group_h'::public.match_stage),
    (202600044, 'Arabia Saudi', 'Uruguay', '2026-06-15T22:00:00Z'::timestamptz, 'group_h'::public.match_stage),
    (202600045, 'Espana', 'Arabia Saudi', '2026-06-21T16:00:00Z'::timestamptz, 'group_h'::public.match_stage),
    (202600046, 'Uruguay', 'Cabo Verde', '2026-06-21T22:00:00Z'::timestamptz, 'group_h'::public.match_stage),
    (202600047, 'Cabo Verde', 'Arabia Saudi', '2026-06-27T00:00:00Z'::timestamptz, 'group_h'::public.match_stage),
    (202600048, 'Uruguay', 'Espana', '2026-06-27T00:00:00Z'::timestamptz, 'group_h'::public.match_stage),

    (202600049, 'Francia', 'Senegal', '2026-06-16T19:00:00Z'::timestamptz, 'group_i'::public.match_stage),
    (202600050, 'Irak', 'Noruega', '2026-06-16T22:00:00Z'::timestamptz, 'group_i'::public.match_stage),
    (202600051, 'Francia', 'Irak', '2026-06-22T21:00:00Z'::timestamptz, 'group_i'::public.match_stage),
    (202600052, 'Noruega', 'Senegal', '2026-06-23T00:00:00Z'::timestamptz, 'group_i'::public.match_stage),
    (202600053, 'Noruega', 'Francia', '2026-06-26T19:00:00Z'::timestamptz, 'group_i'::public.match_stage),
    (202600054, 'Senegal', 'Irak', '2026-06-26T19:00:00Z'::timestamptz, 'group_i'::public.match_stage),

    (202600055, 'Argentina', 'Argelia', '2026-06-17T01:00:00Z'::timestamptz, 'group_j'::public.match_stage),
    (202600056, 'Austria', 'Jordania', '2026-06-16T04:00:00Z'::timestamptz, 'group_j'::public.match_stage),
    (202600057, 'Argentina', 'Austria', '2026-06-22T17:00:00Z'::timestamptz, 'group_j'::public.match_stage),
    (202600058, 'Jordania', 'Argelia', '2026-06-23T03:00:00Z'::timestamptz, 'group_j'::public.match_stage),
    (202600059, 'Argelia', 'Austria', '2026-06-28T02:00:00Z'::timestamptz, 'group_j'::public.match_stage),
    (202600060, 'Jordania', 'Argentina', '2026-06-28T02:00:00Z'::timestamptz, 'group_j'::public.match_stage),

    (202600061, 'Portugal', 'RD de Congo/Jamaica', '2026-06-17T17:00:00Z'::timestamptz, 'group_k'::public.match_stage),
    (202600062, 'Uzbekistan', 'Colombia', '2026-06-18T02:00:00Z'::timestamptz, 'group_k'::public.match_stage),
    (202600063, 'Portugal', 'Uzbekistan', '2026-06-23T17:00:00Z'::timestamptz, 'group_k'::public.match_stage),
    (202600064, 'Colombia', 'RD de Congo/Jamaica', '2026-06-24T02:00:00Z'::timestamptz, 'group_k'::public.match_stage),
    (202600065, 'Colombia', 'Portugal', '2026-06-27T23:30:00Z'::timestamptz, 'group_k'::public.match_stage),
    (202600066, 'RD de Congo/Jamaica', 'Uzbekistan', '2026-06-27T23:30:00Z'::timestamptz, 'group_k'::public.match_stage),

    (202600067, 'Inglaterra', 'Croacia', '2026-06-17T20:00:00Z'::timestamptz, 'group_l'::public.match_stage),
    (202600068, 'Ghana', 'Panama', '2026-06-17T23:00:00Z'::timestamptz, 'group_l'::public.match_stage),
    (202600069, 'Inglaterra', 'Ghana', '2026-06-23T20:00:00Z'::timestamptz, 'group_l'::public.match_stage),
    (202600070, 'Panama', 'Croacia', '2026-06-23T23:00:00Z'::timestamptz, 'group_l'::public.match_stage),
    (202600071, 'Panama', 'Inglaterra', '2026-06-27T21:00:00Z'::timestamptz, 'group_l'::public.match_stage),
    (202600072, 'Croacia', 'Ghana', '2026-06-27T21:00:00Z'::timestamptz, 'group_l'::public.match_stage)
)
insert into public.matches (
  api_fixture_id,
  home_team,
  away_team,
  home_score,
  away_score,
  status,
  match_time,
  stage
)
select
  s.api_fixture_id,
  s.home_team,
  s.away_team,
  null,
  null,
  'pending'::public.match_status,
  s.match_time,
  s.stage
from seed_matches s
on conflict (stage, match_time, home_team, away_team)
do update set
  api_fixture_id = excluded.api_fixture_id,
  home_score = coalesce(public.matches.home_score, excluded.home_score),
  away_score = coalesce(public.matches.away_score, excluded.away_score),
  status = case
    when public.matches.status in ('in_progress', 'finished') then public.matches.status
    else excluded.status
  end,
  updated_at = timezone('utc', now());
