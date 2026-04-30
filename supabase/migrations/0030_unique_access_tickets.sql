create table if not exists public.quiniela_access_tickets (
  id uuid primary key default gen_random_uuid(),
  quiniela_id uuid not null references public.quinielas(id) on delete cascade,
  label text,
  status text not null default 'active',
  expires_at timestamptz,
  redeemed_count integer not null default 0,
  last_redeemed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_access_tickets_status_check check (status in ('active', 'revoked')),
  constraint quiniela_access_tickets_redeemed_count_non_negative check (redeemed_count >= 0),
  constraint quiniela_access_tickets_label_length check (label is null or char_length(label) <= 80)
);

create index if not exists idx_quiniela_access_tickets_quiniela_id
on public.quiniela_access_tickets(quiniela_id);

create index if not exists idx_quiniela_access_tickets_status_expires
on public.quiniela_access_tickets(status, expires_at);

create table if not exists public.quiniela_access_ticket_redemptions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.quiniela_access_tickets(id) on delete set null,
  quiniela_id uuid references public.quinielas(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null,
  message text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint quiniela_access_ticket_redemptions_status_check check (
    status in ('redeemed', 'already_member', 'expired', 'revoked', 'blocked', 'invalid')
  ),
  constraint quiniela_access_ticket_redemptions_message_length check (message is null or char_length(message) <= 240)
);

create index if not exists idx_quiniela_access_ticket_redemptions_ticket_id
on public.quiniela_access_ticket_redemptions(ticket_id);

create index if not exists idx_quiniela_access_ticket_redemptions_quiniela_id
on public.quiniela_access_ticket_redemptions(quiniela_id);

create index if not exists idx_quiniela_access_ticket_redemptions_user_id
on public.quiniela_access_ticket_redemptions(user_id);

create index if not exists idx_quiniela_access_ticket_redemptions_created_at
on public.quiniela_access_ticket_redemptions(created_at desc);

drop trigger if exists tr_quiniela_access_tickets_set_updated_at on public.quiniela_access_tickets;
create trigger tr_quiniela_access_tickets_set_updated_at
before update on public.quiniela_access_tickets
for each row
execute function public.set_updated_at();

alter table public.quiniela_access_tickets enable row level security;
alter table public.quiniela_access_ticket_redemptions enable row level security;

drop policy if exists "Admins can read access tickets" on public.quiniela_access_tickets;
create policy "Admins can read access tickets"
on public.quiniela_access_tickets
for select
to authenticated
using (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Admins can create access tickets" on public.quiniela_access_tickets;
create policy "Admins can create access tickets"
on public.quiniela_access_tickets
for insert
to authenticated
with check (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Admins can update access tickets" on public.quiniela_access_tickets;
create policy "Admins can update access tickets"
on public.quiniela_access_tickets
for update
to authenticated
using (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
)
with check (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Admins can read access ticket redemptions" on public.quiniela_access_ticket_redemptions;
create policy "Admins can read access ticket redemptions"
on public.quiniela_access_ticket_redemptions
for select
to authenticated
using (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);
