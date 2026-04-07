do $$
begin
  if exists (
    select 1
    from pg_type t
    where t.typname = 'match_stage'
      and t.typnamespace = 'public'::regnamespace
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'match_stage'
      and t.typnamespace = 'public'::regnamespace
      and e.enumlabel = 'third_place'
  ) then
    alter type public.match_stage rename to match_stage_old;

    create type public.match_stage as enum (
      'group_a',
      'group_b',
      'group_c',
      'group_d',
      'group_e',
      'group_f',
      'group_g',
      'group_h',
      'group_i',
      'group_j',
      'group_k',
      'group_l',
      'round_32',
      'round_16',
      'quarter_final',
      'semi_final',
      'third_place',
      'final'
    );

    alter table public.matches
      alter column stage type public.match_stage
      using stage::text::public.match_stage;

    drop type public.match_stage_old;
  end if;
end $$;
