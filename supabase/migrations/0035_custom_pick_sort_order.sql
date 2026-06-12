alter table public.quiniela_custom_picks
add column if not exists sort_order integer not null default 0;

alter table public.quiniela_custom_picks
drop constraint if exists quiniela_custom_picks_sort_order_range;

alter table public.quiniela_custom_picks
add constraint quiniela_custom_picks_sort_order_range
check (sort_order between 0 and 9999);

create index if not exists idx_quiniela_custom_picks_quiniela_sort
  on public.quiniela_custom_picks(quiniela_id, sort_order asc, created_at asc);
