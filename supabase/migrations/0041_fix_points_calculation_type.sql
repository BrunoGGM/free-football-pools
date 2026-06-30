-- Drop the old one taking 'text'
drop function if exists public.calculate_prediction_points_for_quiniela_v3(uuid, integer, integer, integer, integer, boolean, boolean, text, boolean, integer, integer, text);

-- Recreate with match_stage
create or replace function public.calculate_prediction_points_for_quiniela_v3(
  p_quiniela_id uuid,
  p_actual_home_score integer,
  p_actual_away_score integer,
  p_pred_home_score integer,
  p_pred_away_score integer,
  p_predicts_extra_time boolean,
  p_predicts_penalties boolean,
  p_predicts_qualifier text,
  p_has_penalties boolean,
  p_actual_home_penalties integer,
  p_actual_away_penalties integer,
  p_stage match_stage
) returns integer as $$
declare
  v_points integer := 0;
  v_max_exact integer;
  v_outcome integer;
  
  v_actual_diff integer;
  v_pred_diff integer;
  v_actual_sign integer;
  v_pred_sign integer;

  v_actual_qualifier text;
  v_is_knockout boolean;
begin
  select exact_score_points, correct_outcome_points
  into v_max_exact, v_outcome
  from public.quinielas
  where id = p_quiniela_id;

  if not found then
    v_max_exact := 3;
    v_outcome := 1;
  end if;

  if p_actual_home_score = p_pred_home_score and p_actual_away_score = p_pred_away_score then
    v_points := v_max_exact;
  else
    v_actual_diff := p_actual_home_score - p_actual_away_score;
    v_pred_diff := p_pred_home_score - p_pred_away_score;

    v_actual_sign := sign(v_actual_diff);
    v_pred_sign := sign(v_pred_diff);

    if v_actual_sign = v_pred_sign then
      v_points := v_outcome;
    end if;
  end if;

  v_is_knockout := p_stage in ('round_32', 'round_16', 'quarter_final', 'semi_final', 'third_place', 'final');

  if v_is_knockout then
    if p_predicts_extra_time = true and p_actual_home_score = p_actual_away_score then
      v_points := v_points + 1;
    end if;

    if p_predicts_penalties = true and p_has_penalties = true then
      v_points := v_points + 2;
    end if;

    if p_actual_home_score > p_actual_away_score then
      v_actual_qualifier := 'home';
    elsif p_actual_home_score < p_actual_away_score then
      v_actual_qualifier := 'away';
    else
      if p_has_penalties = true then
        if p_actual_home_penalties > p_actual_away_penalties then
          v_actual_qualifier := 'home';
        else
          v_actual_qualifier := 'away';
        end if;
      end if;
    end if;

    if p_predicts_qualifier is not null and p_predicts_qualifier = v_actual_qualifier then
      v_points := v_points + 1;
    end if;
  end if;

  return v_points;
end;
$$ language plpgsql stable;

grant execute on function public.calculate_prediction_points_for_quiniela_v3(uuid, integer, integer, integer, integer, boolean, boolean, text, boolean, integer, integer, match_stage) to authenticated, anon;
