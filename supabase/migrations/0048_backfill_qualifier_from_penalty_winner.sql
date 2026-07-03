update public.predictions
set predicts_qualifier = predicts_penalty_winner
where predicts_qualifier is null
  and predicts_penalty_winner in ('home', 'away');