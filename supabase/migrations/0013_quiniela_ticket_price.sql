alter table public.quinielas
add column if not exists ticket_price numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quinielas_ticket_price_non_negative'
  ) then
    alter table public.quinielas
    add constraint quinielas_ticket_price_non_negative check (ticket_price >= 0);
  end if;
end;
$$;
