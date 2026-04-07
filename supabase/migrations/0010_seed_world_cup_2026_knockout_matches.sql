with knockout_matches (
  api_fixture_id,
  home_team,
  away_team,
  match_time,
  source_time,
  stage,
  venue
) as (
  values
    (202600101, '2A', '2B', '2026-06-28T19:00:00Z'::timestamptz, '15:00:00'::time, 'round_32'::public.match_stage, 'Inglewood, Calif.'),
    (202600102, '1C', '2F', '2026-06-29T17:00:00Z'::timestamptz, '13:00:00'::time, 'round_32'::public.match_stage, 'Houston'),
    (202600103, '1E', 'Mejor 3ro A/B/C/D/F', '2026-06-29T20:30:00Z'::timestamptz, '16:30:00'::time, 'round_32'::public.match_stage, 'Foxborough, Mass.'),
    (202600104, '1F', '2C', '2026-06-30T01:00:00Z'::timestamptz, '21:00:00'::time, 'round_32'::public.match_stage, 'Guadalupe, Mexico'),
    (202600105, '2E', '2I', '2026-06-30T17:00:00Z'::timestamptz, '13:00:00'::time, 'round_32'::public.match_stage, 'Arlington, Texas'),
    (202600106, '1I', 'Mejor 3ro C/D/F/G/H', '2026-06-30T21:00:00Z'::timestamptz, '17:00:00'::time, 'round_32'::public.match_stage, 'East Rutherford, N.J.'),
    (202600107, '1A', 'Mejor 3ro C/E/F/H/I', '2026-07-01T01:00:00Z'::timestamptz, '21:00:00'::time, 'round_32'::public.match_stage, 'Mexico City'),
    (202600108, '1L', 'Mejor 3ro E/H/I/J/K', '2026-07-01T16:00:00Z'::timestamptz, '12:00:00'::time, 'round_32'::public.match_stage, 'Atlanta'),
    (202600109, '1G', 'Mejor 3ro A/E/H/I/J', '2026-07-01T20:00:00Z'::timestamptz, '16:00:00'::time, 'round_32'::public.match_stage, 'Seattle'),
    (202600110, '1D', 'Mejor 3ro B/E/F/I/J', '2026-07-02T00:00:00Z'::timestamptz, '20:00:00'::time, 'round_32'::public.match_stage, 'Santa Clara, Calif.'),
    (202600111, '1H', '2J', '2026-07-02T19:00:00Z'::timestamptz, '15:00:00'::time, 'round_32'::public.match_stage, 'Inglewood, Calif.'),
    (202600112, '2K', '2L', '2026-07-02T23:00:00Z'::timestamptz, '19:00:00'::time, 'round_32'::public.match_stage, 'Toronto'),
    (202600113, '1B', 'Mejor 3ro E/F/G/I/J', '2026-07-03T03:00:00Z'::timestamptz, '23:00:00'::time, 'round_32'::public.match_stage, 'Vancouver, Canada'),
    (202600114, '2D', '2G', '2026-07-03T18:00:00Z'::timestamptz, '14:00:00'::time, 'round_32'::public.match_stage, 'Arlington, Texas'),
    (202600115, '1J', '2H', '2026-07-03T22:00:00Z'::timestamptz, '18:00:00'::time, 'round_32'::public.match_stage, 'Miami Gardens, Fla.'),
    (202600116, '1K', 'Mejor 3ro D/E/I/J/L', '2026-07-04T01:30:00Z'::timestamptz, '21:30:00'::time, 'round_32'::public.match_stage, 'Kansas City, Mo.'),

    (202600117, 'Ganador R32-01', 'Ganador R32-02', '2026-07-04T17:00:00Z'::timestamptz, '13:00:00'::time, 'round_16'::public.match_stage, 'Houston'),
    (202600118, 'Ganador R32-03', 'Ganador R32-04', '2026-07-04T21:00:00Z'::timestamptz, '17:00:00'::time, 'round_16'::public.match_stage, 'Philadelphia'),
    (202600119, 'Ganador R32-05', 'Ganador R32-06', '2026-07-05T20:00:00Z'::timestamptz, '16:00:00'::time, 'round_16'::public.match_stage, 'East Rutherford, N.J.'),
    (202600120, 'Ganador R32-07', 'Ganador R32-08', '2026-07-06T00:00:00Z'::timestamptz, '20:00:00'::time, 'round_16'::public.match_stage, 'Mexico City'),
    (202600121, 'Ganador R32-09', 'Ganador R32-10', '2026-07-06T19:00:00Z'::timestamptz, '15:00:00'::time, 'round_16'::public.match_stage, 'Arlington, Texas'),
    (202600122, 'Ganador R32-11', 'Ganador R32-12', '2026-07-06T21:00:00Z'::timestamptz, '17:00:00'::time, 'round_16'::public.match_stage, 'Seattle'),
    (202600123, 'Ganador R32-13', 'Ganador R32-14', '2026-07-07T16:00:00Z'::timestamptz, '12:00:00'::time, 'round_16'::public.match_stage, 'Atlanta'),
    (202600124, 'Ganador R32-15', 'Ganador R32-16', '2026-07-07T20:00:00Z'::timestamptz, '16:00:00'::time, 'round_16'::public.match_stage, 'Vancouver, Canada'),

    (202600125, 'Ganador R16-01', 'Ganador R16-02', '2026-07-09T20:00:00Z'::timestamptz, '16:00:00'::time, 'quarter_final'::public.match_stage, 'Foxborough, Mass.'),
    (202600126, 'Ganador R16-03', 'Ganador R16-04', '2026-07-10T19:00:00Z'::timestamptz, '15:00:00'::time, 'quarter_final'::public.match_stage, 'Inglewood, Calif.'),
    (202600127, 'Ganador R16-05', 'Ganador R16-06', '2026-07-11T21:00:00Z'::timestamptz, '17:00:00'::time, 'quarter_final'::public.match_stage, 'Miami Gardens, Fla.'),
    (202600128, 'Ganador R16-07', 'Ganador R16-08', '2026-07-12T01:00:00Z'::timestamptz, '21:00:00'::time, 'quarter_final'::public.match_stage, 'Kansas City, Mo.'),

    (202600129, 'Ganador QF-01', 'Ganador QF-02', '2026-07-14T19:00:00Z'::timestamptz, '15:00:00'::time, 'semi_final'::public.match_stage, 'Arlington, Texas'),
    (202600130, 'Ganador QF-03', 'Ganador QF-04', '2026-07-15T19:00:00Z'::timestamptz, '15:00:00'::time, 'semi_final'::public.match_stage, 'Atlanta'),

    (202600131, 'Perdedor SF-01', 'Perdedor SF-02', '2026-07-18T21:00:00Z'::timestamptz, '17:00:00'::time, 'third_place'::public.match_stage, 'Miami Gardens, Fla.'),
    (202600132, 'Ganador SF-01', 'Ganador SF-02', '2026-07-19T19:00:00Z'::timestamptz, '15:00:00'::time, 'final'::public.match_stage, 'East Rutherford, N.J.')
)
insert into public.matches (
  api_fixture_id,
  home_team,
  away_team,
  home_team_code,
  away_team_code,
  home_team_logo_url,
  away_team_logo_url,
  home_score,
  away_score,
  status,
  match_time,
  source_time,
  source_timezone,
  stage,
  venue
)
select
  k.api_fixture_id,
  k.home_team,
  k.away_team,
  null,
  null,
  null,
  null,
  null,
  null,
  'pending'::public.match_status,
  k.match_time,
  k.source_time,
  'America/New_York',
  k.stage,
  k.venue
from knockout_matches k
on conflict (stage, match_time, home_team, away_team)
do update set
  api_fixture_id = excluded.api_fixture_id,
  source_time = excluded.source_time,
  source_timezone = excluded.source_timezone,
  venue = excluded.venue,
  status = case
    when public.matches.status in ('in_progress', 'finished') then public.matches.status
    else excluded.status
  end,
  updated_at = timezone('utc', now());
