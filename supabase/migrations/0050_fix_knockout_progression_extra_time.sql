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
  v_effective_home_score integer;
  v_effective_away_score integer;
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

  v_effective_home_score := public.effective_match_home_score(
    new.home_score,
    new.home_extra_time_score,
    new.away_extra_time_score,
    new.went_to_extra_time
  );

  v_effective_away_score := public.effective_match_away_score(
    new.away_score,
    new.home_extra_time_score,
    new.away_extra_time_score,
    new.went_to_extra_time
  );

  if v_effective_home_score > v_effective_away_score then
    v_winner_team := new.home_team;
    v_winner_code := new.home_team_code;
    v_winner_logo := new.home_team_logo_url;
    v_loser_team := new.away_team;
    v_loser_code := new.away_team_code;
    v_loser_logo := new.away_team_logo_url;
  elsif v_effective_away_score > v_effective_home_score then
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
after insert or update of home_score, away_score, home_extra_time_score, away_extra_time_score, went_to_extra_time, home_penalty_score, away_penalty_score, status
on public.matches
for each row
execute function public.apply_knockout_progression();

update public.matches
set home_score = home_score
where stage in ('round_32', 'round_16', 'quarter_final', 'semi_final')
  and status = 'finished'
  and home_score is not null
  and away_score is not null;