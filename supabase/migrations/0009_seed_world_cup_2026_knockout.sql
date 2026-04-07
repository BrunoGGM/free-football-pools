do $$
begin
  if exists (
    select 1
    from pg_type t
    where t.typname = 'match_stage'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'match_stage'
      and e.enumlabel = 'third_place'
  ) then
    alter type public.match_stage add value 'third_place' before 'final';
  end if;
end $$;
