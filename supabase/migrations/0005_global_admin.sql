alter table public.profiles
add column if not exists is_global_admin boolean not null default false;

create or replace function public.is_global_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_global_admin = true
  );
$$;

grant execute on function public.is_global_admin(uuid) to authenticated, anon;

-- Requested global admin user
update public.profiles
set is_global_admin = true,
    updated_at = timezone('utc', now())
where id = '0b05eb1f-4d31-43d3-a53f-45305c852f1c';

-- quinielas

drop policy if exists "Users can create own quiniela" on public.quinielas;
create policy "Users can create own quiniela"
on public.quinielas
for insert
to authenticated
with check (auth.uid() = admin_id or public.is_global_admin(auth.uid()));

drop policy if exists "Admins can update own quiniela" on public.quinielas;
create policy "Admins can update own quiniela"
on public.quinielas
for update
to authenticated
using (auth.uid() = admin_id or public.is_global_admin(auth.uid()))
with check (auth.uid() = admin_id or public.is_global_admin(auth.uid()));

drop policy if exists "Admins can delete own quiniela" on public.quinielas;
create policy "Admins can delete own quiniela"
on public.quinielas
for delete
to authenticated
using (auth.uid() = admin_id or public.is_global_admin(auth.uid()));

-- quiniela_members

drop policy if exists "Admins can add members" on public.quiniela_members;
create policy "Admins can add members"
on public.quiniela_members
for insert
to authenticated
with check (
  public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);

drop policy if exists "Admins can manage members" on public.quiniela_members;
create policy "Admins can manage members"
on public.quiniela_members
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

drop policy if exists "Members can leave quiniela" on public.quiniela_members;
create policy "Members can leave quiniela"
on public.quiniela_members
for delete
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_of_quiniela(quiniela_id, auth.uid())
  or public.is_global_admin(auth.uid())
);
