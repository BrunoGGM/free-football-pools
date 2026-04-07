alter table public.quiniela_rules
add column if not exists allow_member_predictions_view boolean not null default false;

create or replace function public.get_quiniela_rules_with_visibility(
  p_quiniela_id uuid
)
returns table (
  exact_score_points integer,
  correct_outcome_points integer,
  champion_bonus_points integer,
  exact_hit_min_points integer,
  streak_hit_min_points integer,
  streak_bonus_3_points integer,
  streak_bonus_5_points integer,
  allow_member_predictions_view boolean
)
language sql
stable
as $$
  select
    coalesce(qr.exact_score_points, 3) as exact_score_points,
    coalesce(qr.correct_outcome_points, 1) as correct_outcome_points,
    coalesce(qr.champion_bonus_points, 10) as champion_bonus_points,
    coalesce(qr.exact_hit_min_points, 3) as exact_hit_min_points,
    coalesce(qr.streak_hit_min_points, 1) as streak_hit_min_points,
    coalesce(qr.streak_bonus_3_points, 1) as streak_bonus_3_points,
    coalesce(qr.streak_bonus_5_points, 2) as streak_bonus_5_points,
    coalesce(qr.allow_member_predictions_view, false) as allow_member_predictions_view
  from public.quinielas q
  left join public.quiniela_rules qr on qr.quiniela_id = q.id
  where q.id = p_quiniela_id;
$$;

grant execute on function public.get_quiniela_rules_with_visibility(uuid) to authenticated, anon;

drop policy if exists "Users can read own predictions" on public.predictions;
create policy "Users can read predictions by quiniela visibility"
on public.predictions
for select
to authenticated
using (
  (
    auth.uid() = user_id
    and public.is_member_of_quiniela(quiniela_id, auth.uid())
  )
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
  or (
    public.is_member_of_quiniela(quiniela_id, auth.uid())
    and exists (
      select 1
      from public.quiniela_rules qr
      where qr.quiniela_id = predictions.quiniela_id
        and qr.allow_member_predictions_view = true
    )
  )
);
