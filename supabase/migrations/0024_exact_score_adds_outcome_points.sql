create or replace function public.calculate_prediction_points_for_quiniela(
  p_quiniela_id uuid,
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
)
returns integer
language plpgsql
stable
as $$
declare
  predicted_outcome integer;
  actual_outcome integer;
  v_exact_points integer := 3;
  v_outcome_points integer := 1;
begin
  if predicted_home is null
    or predicted_away is null
    or actual_home is null
    or actual_away is null then
    return 0;
  end if;

  select
    rules.exact_score_points,
    rules.correct_outcome_points
  into v_exact_points, v_outcome_points
  from public.get_quiniela_rules(p_quiniela_id) rules;

  if predicted_home = actual_home and predicted_away = actual_away then
    return greatest(coalesce(v_outcome_points, 1) + coalesce(v_exact_points, 3), 0);
  end if;

  predicted_outcome := sign(predicted_home - predicted_away);
  actual_outcome := sign(actual_home - actual_away);

  if predicted_outcome = actual_outcome then
    return greatest(coalesce(v_outcome_points, 1), 0);
  end if;

  return 0;
end;
$$;

do $$
declare
  v_qid uuid;
begin
  for v_qid in
    select q.id
    from public.quinielas q
  loop
    perform public.recalculate_quiniela_scoring(v_qid);
  end loop;
end;
$$;
