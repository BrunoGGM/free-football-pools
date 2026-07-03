create or replace function public.calculate_weekly_ranking(
  p_quiniela_id uuid,
  p_week_start_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_weekly_ranking_for_week(
    p_quiniela_id,
    p_week_start_date
  );
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