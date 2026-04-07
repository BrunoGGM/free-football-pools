alter table public.matches
add column if not exists venue text;

alter table public.matches
add column if not exists source_time time;

alter table public.matches
add column if not exists source_timezone text not null default 'America/New_York';

alter table public.matches
add column if not exists home_team_code text;

alter table public.matches
add column if not exists away_team_code text;

create extension if not exists unaccent;

create or replace function public.normalize_team_key(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(unaccent(coalesce(p_name, ''))),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.map_team_code(p_name text)
returns text
language sql
immutable
as $$
  select case public.normalize_team_key(p_name)
    when 'mexico' then 'MX'
    when 'sudafrica' then 'ZA'
    when 'southafrica' then 'ZA'
    when 'republicadecorea' then 'KR'
    when 'coreadelsur' then 'KR'
    when 'southkorea' then 'KR'
    when 'korearepublic' then 'KR'
    when 'republicacheca' then 'CZ'
    when 'chequia' then 'CZ'
    when 'czechrepublic' then 'CZ'
    when 'czechia' then 'CZ'
    when 'canada' then 'CA'
    when 'bosniayherzegovina' then 'BA'
    when 'bosniaandherzegovina' then 'BA'
    when 'catar' then 'QA'
    when 'qatar' then 'QA'
    when 'suiza' then 'CH'
    when 'switzerland' then 'CH'
    when 'brasil' then 'BR'
    when 'brazil' then 'BR'
    when 'marruecos' then 'MA'
    when 'morocco' then 'MA'
    when 'haiti' then 'HT'
    when 'escocia' then 'GB'
    when 'scotland' then 'GB'
    when 'estadosunidos' then 'US'
    when 'eeuu' then 'US'
    when 'usa' then 'US'
    when 'unitedstates' then 'US'
    when 'paraguay' then 'PY'
    when 'australia' then 'AU'
    when 'turquia' then 'TR'
    when 'alemania' then 'DE'
    when 'germany' then 'DE'
    when 'curazao' then 'CW'
    when 'costademarfil' then 'CI'
    when 'cotedivoire' then 'CI'
    when 'ivorycoast' then 'CI'
    when 'ecuador' then 'EC'
    when 'paisesbajos' then 'NL'
    when 'holanda' then 'NL'
    when 'netherlands' then 'NL'
    when 'japon' then 'JP'
    when 'japan' then 'JP'
    when 'suecia' then 'SE'
    when 'sweden' then 'SE'
    when 'tunez' then 'TN'
    when 'tunisia' then 'TN'
    when 'belgica' then 'BE'
    when 'belgium' then 'BE'
    when 'egipto' then 'EG'
    when 'iran' then 'IR'
    when 'rideiran' then 'IR'
    when 'nuevazelanda' then 'NZ'
    when 'newzealand' then 'NZ'
    when 'espana' then 'ES'
    when 'spain' then 'ES'
    when 'caboverde' then 'CV'
    when 'islasdecaboverde' then 'CV'
    when 'capeverde' then 'CV'
    when 'arabiasaudi' then 'SA'
    when 'saudiarabia' then 'SA'
    when 'uruguay' then 'UY'
    when 'francia' then 'FR'
    when 'senegal' then 'SN'
    when 'irak' then 'IQ'
    when 'noruega' then 'NO'
    when 'argentina' then 'AR'
    when 'argelia' then 'DZ'
    when 'austria' then 'AT'
    when 'jordania' then 'JO'
    when 'portugal' then 'PT'
    when 'rdcongo' then 'CD'
    when 'rddecongo' then 'CD'
    when 'drcongo' then 'CD'
    when 'rddecongojamaica' then 'CD'
    when 'jamaicarddecongo' then 'CD'
    when 'jamaica' then 'JM'
    when 'uzbekistan' then 'UZ'
    when 'colombia' then 'CO'
    when 'inglaterra' then 'GB'
    when 'england' then 'GB'
    when 'croacia' then 'HR'
    when 'ghana' then 'GH'
    when 'panama' then 'PA'
    else null
  end;
$$;

with seed_venues(stage, match_time, home_team, away_team, venue) as (
  values
    ('group_a'::public.match_stage, '2026-06-11T19:00:00Z'::timestamptz, 'Mexico', 'Sudafrica', 'Estadio Ciudad de Mexico'),
    ('group_a'::public.match_stage, '2026-06-12T02:00:00Z'::timestamptz, 'Republica de Corea', 'Republica Checa', 'Estadio Guadalajara'),
    ('group_a'::public.match_stage, '2026-06-18T16:00:00Z'::timestamptz, 'Republica Checa', 'Sudafrica', 'Atlanta Stadium'),
    ('group_a'::public.match_stage, '2026-06-19T01:00:00Z'::timestamptz, 'Mexico', 'Republica de Corea', 'Estadio Guadalajara'),
    ('group_a'::public.match_stage, '2026-06-25T01:00:00Z'::timestamptz, 'Republica Checa', 'Mexico', 'Estadio Ciudad de Mexico'),
    ('group_a'::public.match_stage, '2026-06-25T01:00:00Z'::timestamptz, 'Sudafrica', 'Republica de Corea', 'Estadio Monterrey'),

    ('group_b'::public.match_stage, '2026-06-12T19:00:00Z'::timestamptz, 'Canada', 'Bosnia y Herzegovina', 'Toronto Stadium'),
    ('group_b'::public.match_stage, '2026-06-13T19:00:00Z'::timestamptz, 'Catar', 'Suiza', 'San Francisco Bay Area Stadium'),
    ('group_b'::public.match_stage, '2026-06-18T19:00:00Z'::timestamptz, 'Suiza', 'Bosnia y Herzegovina', 'Los Angeles Stadium'),
    ('group_b'::public.match_stage, '2026-06-18T22:00:00Z'::timestamptz, 'Canada', 'Catar', 'BC Place Vancouver'),
    ('group_b'::public.match_stage, '2026-06-24T19:00:00Z'::timestamptz, 'Suiza', 'Canada', 'BC Place Vancouver'),
    ('group_b'::public.match_stage, '2026-06-24T19:00:00Z'::timestamptz, 'Bosnia y Herzegovina', 'Catar', 'Seattle Stadium'),

    ('group_c'::public.match_stage, '2026-06-13T22:00:00Z'::timestamptz, 'Brasil', 'Marruecos', 'New York New Jersey Stadium'),
    ('group_c'::public.match_stage, '2026-06-14T01:00:00Z'::timestamptz, 'Haiti', 'Escocia', 'Boston Stadium'),
    ('group_c'::public.match_stage, '2026-06-19T22:00:00Z'::timestamptz, 'Escocia', 'Marruecos', 'Boston Stadium'),
    ('group_c'::public.match_stage, '2026-06-20T01:00:00Z'::timestamptz, 'Brasil', 'Haiti', 'Philadelphia Stadium'),
    ('group_c'::public.match_stage, '2026-06-24T22:00:00Z'::timestamptz, 'Brasil', 'Escocia', 'Miami Stadium'),
    ('group_c'::public.match_stage, '2026-06-24T22:00:00Z'::timestamptz, 'Marruecos', 'Haiti', 'Atlanta Stadium'),

    ('group_d'::public.match_stage, '2026-06-13T01:00:00Z'::timestamptz, 'Estados Unidos', 'Paraguay', 'Los Angeles Stadium'),
    ('group_d'::public.match_stage, '2026-06-13T04:00:00Z'::timestamptz, 'Australia', 'Turquia', 'BC Place Vancouver'),
    ('group_d'::public.match_stage, '2026-06-19T19:00:00Z'::timestamptz, 'Estados Unidos', 'Australia', 'Seattle Stadium'),
    ('group_d'::public.match_stage, '2026-06-19T04:00:00Z'::timestamptz, 'Turquia', 'Paraguay', 'San Francisco Bay Area Stadium'),
    ('group_d'::public.match_stage, '2026-06-26T02:00:00Z'::timestamptz, 'Turquia', 'Estados Unidos', 'Los Angeles Stadium'),
    ('group_d'::public.match_stage, '2026-06-26T02:00:00Z'::timestamptz, 'Paraguay', 'Australia', 'San Francisco Bay Area Stadium'),

    ('group_e'::public.match_stage, '2026-06-14T17:00:00Z'::timestamptz, 'Alemania', 'Curazao', 'Houston Stadium'),
    ('group_e'::public.match_stage, '2026-06-14T23:00:00Z'::timestamptz, 'Costa de Marfil', 'Ecuador', 'Philadelphia Stadium'),
    ('group_e'::public.match_stage, '2026-06-20T20:00:00Z'::timestamptz, 'Alemania', 'Costa de Marfil', 'Toronto Stadium'),
    ('group_e'::public.match_stage, '2026-06-21T02:00:00Z'::timestamptz, 'Ecuador', 'Curazao', 'Kansas City Stadium'),
    ('group_e'::public.match_stage, '2026-06-25T20:00:00Z'::timestamptz, 'Curazao', 'Costa de Marfil', 'Philadelphia Stadium'),
    ('group_e'::public.match_stage, '2026-06-25T20:00:00Z'::timestamptz, 'Ecuador', 'Alemania', 'New York New Jersey Stadium'),

    ('group_f'::public.match_stage, '2026-06-14T20:00:00Z'::timestamptz, 'Paises Bajos', 'Japon', 'Dallas Stadium'),
    ('group_f'::public.match_stage, '2026-06-15T02:00:00Z'::timestamptz, 'Suecia', 'Tunez', 'Estadio Monterrey'),
    ('group_f'::public.match_stage, '2026-06-20T17:00:00Z'::timestamptz, 'Paises Bajos', 'Suecia', 'Houston Stadium'),
    ('group_f'::public.match_stage, '2026-06-20T04:00:00Z'::timestamptz, 'Tunez', 'Japon', 'Estadio Monterrey'),
    ('group_f'::public.match_stage, '2026-06-25T23:00:00Z'::timestamptz, 'Japon', 'Suecia', 'Dallas Stadium'),
    ('group_f'::public.match_stage, '2026-06-25T23:00:00Z'::timestamptz, 'Tunez', 'Paises Bajos', 'Kansas City Stadium'),

    ('group_g'::public.match_stage, '2026-06-15T19:00:00Z'::timestamptz, 'Belgica', 'Egipto', 'Seattle Stadium'),
    ('group_g'::public.match_stage, '2026-06-16T01:00:00Z'::timestamptz, 'Iran', 'Nueva Zelanda', 'Los Angeles Stadium'),
    ('group_g'::public.match_stage, '2026-06-21T19:00:00Z'::timestamptz, 'Belgica', 'Iran', 'Los Angeles Stadium'),
    ('group_g'::public.match_stage, '2026-06-22T01:00:00Z'::timestamptz, 'Nueva Zelanda', 'Egipto', 'BC Place Vancouver'),
    ('group_g'::public.match_stage, '2026-06-27T03:00:00Z'::timestamptz, 'Egipto', 'Iran', 'Seattle Stadium'),
    ('group_g'::public.match_stage, '2026-06-27T03:00:00Z'::timestamptz, 'Nueva Zelanda', 'Belgica', 'BC Place Vancouver'),

    ('group_h'::public.match_stage, '2026-06-15T16:00:00Z'::timestamptz, 'Espana', 'Cabo Verde', 'Atlanta Stadium'),
    ('group_h'::public.match_stage, '2026-06-15T22:00:00Z'::timestamptz, 'Arabia Saudi', 'Uruguay', 'Miami Stadium'),
    ('group_h'::public.match_stage, '2026-06-21T16:00:00Z'::timestamptz, 'Espana', 'Arabia Saudi', 'Atlanta Stadium'),
    ('group_h'::public.match_stage, '2026-06-21T22:00:00Z'::timestamptz, 'Uruguay', 'Cabo Verde', 'Miami Stadium'),
    ('group_h'::public.match_stage, '2026-06-27T00:00:00Z'::timestamptz, 'Cabo Verde', 'Arabia Saudi', 'Houston Stadium'),
    ('group_h'::public.match_stage, '2026-06-27T00:00:00Z'::timestamptz, 'Uruguay', 'Espana', 'Estadio Guadalajara'),

    ('group_i'::public.match_stage, '2026-06-16T19:00:00Z'::timestamptz, 'Francia', 'Senegal', 'New York New Jersey Stadium'),
    ('group_i'::public.match_stage, '2026-06-16T22:00:00Z'::timestamptz, 'Irak', 'Noruega', 'Boston Stadium'),
    ('group_i'::public.match_stage, '2026-06-22T21:00:00Z'::timestamptz, 'Francia', 'Irak', 'Philadelphia Stadium'),
    ('group_i'::public.match_stage, '2026-06-23T00:00:00Z'::timestamptz, 'Noruega', 'Senegal', 'New York New Jersey Stadium'),
    ('group_i'::public.match_stage, '2026-06-26T19:00:00Z'::timestamptz, 'Noruega', 'Francia', 'Boston Stadium'),
    ('group_i'::public.match_stage, '2026-06-26T19:00:00Z'::timestamptz, 'Senegal', 'Irak', 'Toronto Stadium'),

    ('group_j'::public.match_stage, '2026-06-17T01:00:00Z'::timestamptz, 'Argentina', 'Argelia', 'Kansas City Stadium'),
    ('group_j'::public.match_stage, '2026-06-16T04:00:00Z'::timestamptz, 'Austria', 'Jordania', 'San Francisco Bay Area Stadium'),
    ('group_j'::public.match_stage, '2026-06-22T17:00:00Z'::timestamptz, 'Argentina', 'Austria', 'Dallas Stadium'),
    ('group_j'::public.match_stage, '2026-06-23T03:00:00Z'::timestamptz, 'Jordania', 'Argelia', 'San Francisco Bay Area Stadium'),
    ('group_j'::public.match_stage, '2026-06-28T02:00:00Z'::timestamptz, 'Argelia', 'Austria', 'Kansas City Stadium'),
    ('group_j'::public.match_stage, '2026-06-28T02:00:00Z'::timestamptz, 'Jordania', 'Argentina', 'Dallas Stadium'),

    ('group_k'::public.match_stage, '2026-06-17T17:00:00Z'::timestamptz, 'Portugal', 'RD de Congo/Jamaica', 'Houston Stadium'),
    ('group_k'::public.match_stage, '2026-06-18T02:00:00Z'::timestamptz, 'Uzbekistan', 'Colombia', 'Estadio Ciudad de Mexico'),
    ('group_k'::public.match_stage, '2026-06-23T17:00:00Z'::timestamptz, 'Portugal', 'Uzbekistan', 'Houston Stadium'),
    ('group_k'::public.match_stage, '2026-06-24T02:00:00Z'::timestamptz, 'Colombia', 'RD de Congo/Jamaica', 'Estadio Guadalajara'),
    ('group_k'::public.match_stage, '2026-06-27T23:30:00Z'::timestamptz, 'Colombia', 'Portugal', 'Miami Stadium'),
    ('group_k'::public.match_stage, '2026-06-27T23:30:00Z'::timestamptz, 'RD de Congo/Jamaica', 'Uzbekistan', 'Atlanta Stadium'),

    ('group_l'::public.match_stage, '2026-06-17T20:00:00Z'::timestamptz, 'Inglaterra', 'Croacia', 'Dallas Stadium'),
    ('group_l'::public.match_stage, '2026-06-17T23:00:00Z'::timestamptz, 'Ghana', 'Panama', 'Toronto Stadium'),
    ('group_l'::public.match_stage, '2026-06-23T20:00:00Z'::timestamptz, 'Inglaterra', 'Ghana', 'Boston Stadium'),
    ('group_l'::public.match_stage, '2026-06-23T23:00:00Z'::timestamptz, 'Panama', 'Croacia', 'Toronto Stadium'),
    ('group_l'::public.match_stage, '2026-06-27T21:00:00Z'::timestamptz, 'Panama', 'Inglaterra', 'New York New Jersey Stadium'),
    ('group_l'::public.match_stage, '2026-06-27T21:00:00Z'::timestamptz, 'Croacia', 'Ghana', 'Philadelphia Stadium')
)
update public.matches m
set venue = s.venue
from seed_venues s
where m.stage = s.stage
  and m.match_time = s.match_time
  and m.home_team = s.home_team
  and m.away_team = s.away_team
  and (m.venue is null or m.venue = '');

update public.matches
set source_timezone = coalesce(source_timezone, 'America/New_York');

update public.matches
set source_time = coalesce(source_time, (match_time at time zone source_timezone)::time);

update public.matches
set home_team_code = coalesce(home_team_code, public.map_team_code(home_team)),
    away_team_code = coalesce(away_team_code, public.map_team_code(away_team));

create index if not exists idx_matches_home_team_code on public.matches(home_team_code);
create index if not exists idx_matches_away_team_code on public.matches(away_team_code);
