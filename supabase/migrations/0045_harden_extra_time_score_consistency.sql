alter table public.matches
drop constraint if exists matches_extra_time_regular_draw;

alter table public.matches
add constraint matches_extra_time_regular_draw check (
  not coalesce(went_to_extra_time, false)
  or home_score is null
  or away_score is null
  or home_score = away_score
) not valid;

alter table public.matches
drop constraint if exists matches_extra_time_scores_paired;

alter table public.matches
add constraint matches_extra_time_scores_paired check (
  (home_extra_time_score is null and away_extra_time_score is null)
  or (home_extra_time_score is not null and away_extra_time_score is not null)
) not valid;

alter table public.matches
drop constraint if exists matches_finished_extra_time_requires_scores;

alter table public.matches
add constraint matches_finished_extra_time_requires_scores check (
  status <> 'finished'
  or not coalesce(went_to_extra_time, false)
  or (home_extra_time_score is not null and away_extra_time_score is not null)
) not valid;