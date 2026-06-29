-- 0038_fix_all_knockout_maps.sql
-- Refactorización Completa del Fixture de Octavos de Final (Bracket Matches 89-96)
-- Implementa el mapeo oficial de cruces y relocaliza a los equipos clasificados.

BEGIN;

-- 1. Actualizar los tokens de semilla (punteros lógicos del torneo)
UPDATE public.matches SET home_seed_token = 'W75', away_seed_token = 'W78' WHERE bracket_match_no = 89;
UPDATE public.matches SET home_seed_token = 'W73', away_seed_token = 'W76' WHERE bracket_match_no = 90;
UPDATE public.matches SET home_seed_token = 'W74', away_seed_token = 'W77' WHERE bracket_match_no = 91;
UPDATE public.matches SET home_seed_token = 'W79', away_seed_token = 'W80' WHERE bracket_match_no = 92;
UPDATE public.matches SET home_seed_token = 'W83', away_seed_token = 'W84' WHERE bracket_match_no = 93;
UPDATE public.matches SET home_seed_token = 'W81', away_seed_token = 'W82' WHERE bracket_match_no = 94;
UPDATE public.matches SET home_seed_token = 'W86', away_seed_token = 'W87' WHERE bracket_match_no = 95;
UPDATE public.matches SET home_seed_token = 'W85', away_seed_token = 'W88' WHERE bracket_match_no = 96;

-- 2. Reset visual de las llaves (Limpiar ganadores previos mal ubicados)
-- Esto no borra ninguna prediccion, solo limpia los strings "Brasil", "Japon", etc. de los 8vos de final
-- para dejarlos como "Ganador W75" temporalmente.
UPDATE public.matches
SET 
  home_team = 'Ganador ' || home_seed_token,
  away_team = 'Ganador ' || away_seed_token,
  home_team_code = NULL,
  away_team_code = NULL,
  home_team_logo_url = NULL,
  away_team_logo_url = NULL,
  updated_at = timezone('utc', now())
WHERE bracket_match_no BETWEEN 89 AND 96;

-- 3. Reactivacion del Trigger Inteligente
-- Obligamos a los partidos de 16vos que ya finalizaron a repoblar el bracket.
-- Al actualizar la columna "status" con su mismo valor, Postgres dispara el trigger
-- "tr_matches_apply_knockout_progression", y el motor insertará automáticamente a
-- Brasil, Canadá, etc., en sus llaves correctas basándose en el paso 1.
UPDATE public.matches
SET status = 'finished'
WHERE bracket_match_no BETWEEN 73 AND 88
  AND status = 'finished';

COMMIT;
