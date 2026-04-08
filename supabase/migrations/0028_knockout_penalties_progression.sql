alter table public.matches
  add column if not exists home_penalty_score integer,
  add column if not exists away_penalty_score integer;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_penalty_scores_non_negative'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      drop constraint matches_penalty_scores_non_negative;
  end if;
end;
$$;

alter table public.matches
  add constraint matches_penalty_scores_non_negative
  check (
    (home_penalty_score is null or home_penalty_score >= 0)
    and (away_penalty_score is null or away_penalty_score >= 0)
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_penalty_scores_pair'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      drop constraint matches_penalty_scores_pair;
  end if;
end;
$$;

alter table public.matches
  add constraint matches_penalty_scores_pair
  check (
    (home_penalty_score is null and away_penalty_score is null)
    or (home_penalty_score is not null and away_penalty_score is not null)
  );

do $$
begin
  if to_regclass('public.simulation_match_snapshots') is not null then
    alter table public.simulation_match_snapshots
      add column if not exists home_penalty_score integer,
      add column if not exists away_penalty_score integer;
  end if;
end;
$$;

create or replace function public.apply_knockout_progression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage_code text;
  v_match_number integer;
  v_slot_token text;
  v_winner_team text;
  v_loser_team text;
  v_winner_code text;
  v_loser_code text;
  v_winner_logo text;
  v_loser_logo text;
begin
  if new.stage not in ('round_32', 'round_16', 'quarter_final', 'semi_final') then
    return new;
  end if;

  if new.status <> 'finished' then
    return new;
  end if;

  if new.home_score is null or new.away_score is null then
    return new;
  end if;

  v_stage_code := case new.stage
    when 'round_32' then 'R32'
    when 'round_16' then 'R16'
    when 'quarter_final' then 'QF'
    when 'semi_final' then 'SF'
    else null
  end;

  if v_stage_code is null then
    return new;
  end if;

  select ranked.rn
  into v_match_number
  from (
    select
      m.id,
      row_number() over (
        order by m.match_time asc, m.api_fixture_id asc, m.id asc
      ) as rn
    from public.matches m
    where m.stage = new.stage
  ) ranked
  where ranked.id = new.id;

  if v_match_number is null then
    return new;
  end if;

  v_slot_token := v_stage_code || '-' || lpad(v_match_number::text, 2, '0');

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

  update public.matches
  set
    home_team = v_winner_team,
    home_team_code = v_winner_code,
    home_team_logo_url = v_winner_logo,
    updated_at = timezone('utc', now())
  where home_team = 'Ganador ' || v_slot_token;

  update public.matches
  set
    away_team = v_winner_team,
    away_team_code = v_winner_code,
    away_team_logo_url = v_winner_logo,
    updated_at = timezone('utc', now())
  where away_team = 'Ganador ' || v_slot_token;

  if new.stage = 'semi_final' then
    update public.matches
    set
      home_team = v_loser_team,
      home_team_code = v_loser_code,
      home_team_logo_url = v_loser_logo,
      updated_at = timezone('utc', now())
    where home_team = 'Perdedor ' || v_slot_token;

    update public.matches
    set
      away_team = v_loser_team,
      away_team_code = v_loser_code,
      away_team_logo_url = v_loser_logo,
      updated_at = timezone('utc', now())
    where away_team = 'Perdedor ' || v_slot_token;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_matches_apply_knockout_progression on public.matches;
create trigger tr_matches_apply_knockout_progression
after insert or update of home_score, away_score, home_penalty_score, away_penalty_score, status
on public.matches
for each row
execute function public.apply_knockout_progression();
